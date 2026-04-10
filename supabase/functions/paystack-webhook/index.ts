import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";
import { finalizePayment } from "../_shared/finalize-payment.ts";

// Payment type labels for SMS/email
const PAYMENT_LABELS: Record<string, string> = {
  tenant_registration: "Tenant registration",
  landlord_registration: "Landlord registration",
  rent_card: "Rent Card purchase",
  rent_card_bulk: "Rent Card purchase",
  agreement_sale: "Agreement form purchase",
  complaint_fee: "Complaint filing fee",
  listing_fee: "Marketplace listing fee",
  viewing_fee: "Property viewing fee",
  rent_tax: "Rent tax payment",
  rent_tax_bulk: "Bulk advance rent tax",
  rent_payment: "Monthly rent",
  rent_combined: "Rent + Tax combined",
  renewal_payment: "Tenancy renewal",
  add_tenant_fee: "Add tenant fee",
  termination_fee: "Termination request fee",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return new Response("Server error", { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");

    if (signature !== hash) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("Paystack webhook event:", body.event);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Error logging helper ──
    const logError = async (opts: {
      escrow_transaction_id?: string;
      reference?: string;
      function_name?: string;
      error_stage: string;
      error_message: string;
      error_context?: Record<string, any>;
      severity?: string;
    }) => {
      try {
        await supabase.from("payment_processing_errors").insert({
          function_name: "paystack-webhook",
          severity: "warning",
          ...opts,
        });
        if ((opts.severity || "warning") === "critical") {
          const { data: admins } = await supabase.from("admin_staff").select("user_id").in("admin_type", ["main_admin", "super_admin"]);
          if (admins && admins.length > 0) {
            await supabase.from("notifications").insert(
              admins.map((a: any) => ({
                user_id: a.user_id,
                title: "⚠️ Critical Payment Error",
                body: `[${opts.error_stage}] ${opts.error_message.slice(0, 120)}`,
                link: "/regulator/payment-errors",
              }))
            );
          }
        }
      } catch (e) {
        console.error("Failed to log error:", e);
      }
    };

    // ── Handle charge.failed ──
    if (body.event === "charge.failed") {
      const data = body.data;
      const reference = data.reference || "";
      const amountFailed = (data.amount || 0) / 100;

      const { data: escrowTx } = await supabase
        .from("escrow_transactions")
        .update({ status: "failed" })
        .eq("reference", reference)
        .select("user_id, payment_type")
        .maybeSingle();

      if (escrowTx) {
        const userId = escrowTx.user_id;
        const paymentLabel = (escrowTx.payment_type || "payment").replace(/_/g, " ");

        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Payment Failed",
          body: `Your payment of GH₵ ${amountFailed.toFixed(2)} for ${paymentLabel} could not be processed. Please try again.`,
          link: "/",
        });

        try {
          const { data: profile } = await supabase.from("profiles").select("phone").eq("user_id", userId).single();
          if (profile?.phone) {
            let phone = profile.phone.replace(/\s/g, "").replace(/^0/, "233");
            if (!phone.startsWith("233")) phone = "233" + phone;
            const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
            if (ARKESEL_API_KEY) {
              await fetch("https://api.arkesel.com/api/v2/sms/send", {
                method: "POST",
                headers: { "api-key": ARKESEL_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender: "RentGhana",
                  message: `RentGhana: Your payment of GH₵ ${amountFailed.toFixed(2)} for ${paymentLabel} failed. Please try again or contact support.`,
                  recipients: [phone],
                }),
              });
            }
          }
        } catch (e: any) {
          console.error("SMS error (failed payment):", e);
          await logError({ reference, error_stage: "sms_failed_payment", error_message: e.message || String(e), severity: "warning" });
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── Handle transfer events ──
    if (body.event === "transfer.success" || body.event === "transfer.failed" || body.event === "transfer.reversed") {
      const tData = body.data;
      const transferCode = tData.transfer_code || "";
      const tReference = tData.reference || "";

      if (body.event === "transfer.success") {
        await supabase.from("payout_transfers")
          .update({ status: "success", completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        const { data: transfer } = await supabase.from("payout_transfers")
          .select("escrow_split_id").eq("paystack_reference", tReference).single();

        if (transfer?.escrow_split_id) {
          await supabase.from("escrow_splits")
            .update({ disbursement_status: "released", released_at: new Date().toISOString() })
            .eq("id", transfer.escrow_split_id);
        }

      } else if (body.event === "transfer.failed") {
        const reason = tData.reason || tData.message || "Unknown failure";
        await supabase.from("payout_transfers")
          .update({ status: "failed", failure_reason: reason, completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        await logError({ reference: tReference, error_stage: "transfer_failed", error_message: reason, severity: "critical", error_context: { transfer_code: transferCode } });

        const { data: adminStaff } = await supabase.from("admin_staff").select("user_id").in("admin_type", ["main_admin", "super_admin"]);
        if (adminStaff && adminStaff.length > 0) {
          await supabase.from("notifications").insert(
            adminStaff.map((a: any) => ({
              user_id: a.user_id,
              title: "Transfer Failed",
              body: `Paystack transfer ${tReference} failed: ${reason}. Please review in the Escrow Dashboard.`,
              link: "/regulator/escrow",
            }))
          );
        }

      } else if (body.event === "transfer.reversed") {
        await supabase.from("payout_transfers")
          .update({ status: "reversed", failure_reason: "Transfer reversed by Paystack", completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        await logError({ reference: tReference, error_stage: "transfer_reversed", error_message: "Transfer reversed by Paystack", severity: "critical", error_context: { transfer_code: transferCode } });

        const { data: transfer } = await supabase.from("payout_transfers")
          .select("escrow_split_id").eq("paystack_reference", tReference).single();

        if (transfer?.escrow_split_id) {
          await supabase.from("escrow_splits")
            .update({ disbursement_status: "held", released_at: null })
            .eq("id", transfer.escrow_split_id);
        }

        const { data: adminStaff } = await supabase.from("admin_staff").select("user_id").in("admin_type", ["main_admin", "super_admin"]);
        if (adminStaff && adminStaff.length > 0) {
          await supabase.from("notifications").insert(
            adminStaff.map((a: any) => ({
              user_id: a.user_id,
              title: "Transfer Reversed",
              body: `Paystack transfer ${tReference} was reversed. Funds returned to main account.`,
              link: "/regulator/escrow",
            }))
          );
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── Only process charge.success from here ──
    if (body.event !== "charge.success") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const data = body.data;
    const reference = data.reference || "";
    const amountPaid = (data.amount || 0) / 100;
    const transactionId = String(data.id || "");

    // ══════════════════════════════════════════════════════════
    // UNIFIED FINALIZATION — single shared pipeline
    // This handles: escrow completion, split creation, receipts,
    // transfer recipients, payout transfers, side effects
    // (tenant activation, rent card creation, renewal, etc.)
    // ══════════════════════════════════════════════════════════
    const result = await finalizePayment({
      supabaseAdmin: supabase,
      reference,
      amountPaid,
      transactionId,
      logError,
    });

    console.log("finalizePayment result:", JSON.stringify(result));

    // ── Post-finalization: Send SMS + Email ──
    // (finalizePayment already creates in-app notifications and receipts)
    try {
      const { data: escrow } = await supabase
        .from("escrow_transactions")
        .select("user_id, payment_type, metadata")
        .eq("reference", reference)
        .maybeSingle();

      if (escrow) {
        const userId = escrow.user_id;
        const paymentType = escrow.payment_type;
        const description = PAYMENT_LABELS[paymentType] || paymentType.replace(/_/g, " ");

        // Get receipt number
        const { data: receipt } = await supabase
          .from("payment_receipts")
          .select("receipt_number")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const receiptNo = receipt?.receipt_number || reference;

        // Send SMS
        try {
          const { data: profile } = await supabase.from("profiles").select("phone, email, full_name").eq("user_id", userId).single();
          if (profile?.phone) {
            let phone = profile.phone.replace(/\s/g, "").replace(/^0/, "233");
            if (!phone.startsWith("233")) phone = "233" + phone;
            const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
            if (ARKESEL_API_KEY) {
              await fetch("https://api.arkesel.com/api/v2/sms/send", {
                method: "POST",
                headers: { "api-key": ARKESEL_API_KEY, "Content-Type": "application/json" },
                body: JSON.stringify({
                  sender: "RentGhana",
                  message: `RentGhana: Payment of GH₵ ${amountPaid.toFixed(2)} for ${description} confirmed. Receipt: ${receiptNo}. Thank you!`,
                  recipients: [phone],
                }),
              });
            }
          }

          // Send email
          if (profile?.email) {
            try {
              const messageId = crypto.randomUUID();
              await supabase.from("email_send_log").insert({
                message_id: messageId,
                template_name: "payment_successful",
                recipient_email: profile.email,
                status: "pending",
              });
              await supabase.rpc("enqueue_email", {
                queue_name: "transactional_emails",
                payload: {
                  message_id: messageId,
                  to: profile.email,
                  from: "RentControlGhana <noreply@notify.rentcontrolghana.com>",
                  sender_domain: "notify.rentcontrolghana.com",
                  subject: "Payment Successful — RentControlGhana",
                  html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Plus Jakarta Sans',system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;"><tr><td style="background-color:#2d7a4f;padding:24px 32px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:20px;">RentControlGhana</h1></td></tr><tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;"><p>Hello ${profile.full_name || "User"},</p><p>Your payment has been processed successfully.</p><table style="margin:16px 0;"><tr><td style="padding:4px 12px 4px 0;color:#666;">Amount:</td><td>GHS ${amountPaid.toFixed(2)}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666;">Description:</td><td>${description}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666;">Receipt:</td><td>${receiptNo}</td></tr></table><p>Please log in to view details.</p></td></tr><tr><td style="padding:16px 32px 24px;color:#666;font-size:13px;border-top:1px solid #e5e5e5;"><p style="margin:0;">Regards,<br/><strong>RentControlGhana</strong></p></td></tr></table></td></tr></table></body></html>`,
                  text: `Payment of GHS ${amountPaid.toFixed(2)} for ${description} confirmed. Receipt: ${receiptNo}`,
                  purpose: "transactional",
                  label: "payment_successful",
                  queued_at: new Date().toISOString(),
                },
              });
            } catch (emailErr: any) {
              console.error("Payment email error:", emailErr);
              await logError({ error_stage: "email", error_message: emailErr.message || String(emailErr), severity: "warning" });
            }
          }
        } catch (smsErr: any) {
          console.error("SMS error:", smsErr);
          await logError({ error_stage: "sms", error_message: smsErr.message || String(smsErr), severity: "warning" });
        }
      }
    } catch (notifErr: any) {
      console.error("Post-finalization notification error:", notifErr);
      await logError({ reference, error_stage: "post_finalization_notifications", error_message: notifErr.message || String(notifErr), severity: "warning" });
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    try {
      const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await db.from("payment_processing_errors").insert({ function_name: "paystack-webhook", error_stage: "top_level", error_message: error.message || String(error), severity: "critical" });
    } catch {}
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }
});

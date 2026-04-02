import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Notification messages for each payment type
const NOTIFICATION_MESSAGES: Record<string, { title: string; body: (amt: number, meta?: any) => string; link?: string }> = {
  tenant_registration: { title: "Registration Confirmed!", body: () => "Your tenant registration payment has been confirmed. Your account is now active.", link: "/tenant/dashboard" },
  landlord_registration: { title: "Registration Confirmed!", body: () => "Your landlord registration payment has been confirmed. Your account is now active.", link: "/landlord/dashboard" },
  rent_card: { title: "Rent Cards Purchased", body: (amt, meta) => `${meta?.quantity || 1} Rent Card(s) purchased successfully for GH₵ ${amt.toFixed(2)}.`, link: "/landlord/rent-cards" },
  agreement_sale: { title: "Agreement Form Purchased", body: (amt) => `Agreement form purchased for GH₵ ${amt.toFixed(2)}.`, link: "/landlord/agreements" },
  complaint_fee: { title: "Complaint Fee Paid", body: () => "Your complaint filing fee has been paid. Your complaint is now being reviewed.", link: "/tenant/my-cases" },
  listing_fee: { title: "Property Listed!", body: () => "Your property has been listed on the marketplace.", link: "/landlord/properties" },
  viewing_fee: { title: "Viewing Request Sent", body: () => "Your viewing fee has been paid. The landlord has been notified of your request.", link: "/tenant/marketplace" },
  rent_tax: { title: "Rent Tax Paid", body: (amt) => `Rent tax payment of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/payments" },
  rent_tax_bulk: { title: "Bulk Rent Tax Paid", body: (amt) => `Bulk advance rent tax of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/payments" },
  rent_payment: { title: "Rent Payment Received", body: (amt) => `Monthly rent payment of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/payments" },
  rent_combined: { title: "Rent + Tax Payment Confirmed", body: (amt) => `Combined rent and tax payment of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/payments" },
  renewal_payment: { title: "Renewal Payment Confirmed", body: (amt) => `Tenancy renewal payment of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/dashboard" },
  add_tenant_fee: { title: "Add Tenant Fee Paid", body: (amt) => `Add tenant fee of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/landlord/add-tenant" },
  termination_fee: { title: "Termination Fee Paid", body: (amt) => `Termination request fee of GH₵ ${amt.toFixed(2)} confirmed.`, link: "/tenant/termination" },
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
      // Note: logError not available yet (supabase not created), but we log to console
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
        // Notify main admins on critical errors
        if ((opts.severity || "warning") === "critical") {
          const { data: admins } = await supabase.from("admin_staff").select("user_id").eq("admin_type", "main_admin");
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
          await logError({ reference: data.reference, error_stage: "sms_failed_payment", error_message: e.message || String(e), severity: "warning" });
        }
      }

      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // ── Handle transfer events (transfer.success / transfer.failed / transfer.reversed) ──
    if (body.event === "transfer.success" || body.event === "transfer.failed" || body.event === "transfer.reversed") {
      const tData = body.data;
      const transferCode = tData.transfer_code || "";
      const tReference = tData.reference || "";

      if (body.event === "transfer.success") {
        await supabase
          .from("payout_transfers")
          .update({ status: "success", completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        const { data: transfer } = await supabase
          .from("payout_transfers")
          .select("escrow_split_id")
          .eq("paystack_reference", tReference)
          .single();

        if (transfer?.escrow_split_id) {
          await supabase
            .from("escrow_splits")
            .update({ disbursement_status: "released", released_at: new Date().toISOString() })
            .eq("id", transfer.escrow_split_id);
        }

      } else if (body.event === "transfer.failed") {
        const reason = tData.reason || tData.message || "Unknown failure";
        await supabase
          .from("payout_transfers")
          .update({ status: "failed", failure_reason: reason, completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        await logError({ reference: tReference, error_stage: "transfer_failed", error_message: reason, severity: "critical", error_context: { transfer_code: transferCode, event: "transfer.failed" } });

        const { data: adminStaff } = await supabase
          .from("admin_staff")
          .select("user_id")
          .eq("admin_type", "main_admin");
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
        await supabase
          .from("payout_transfers")
          .update({ status: "reversed", failure_reason: "Transfer reversed by Paystack", completed_at: new Date().toISOString(), transfer_code: transferCode })
          .eq("paystack_reference", tReference);

        await logError({ reference: tReference, error_stage: "transfer_reversed", error_message: "Transfer reversed by Paystack", severity: "critical", error_context: { transfer_code: transferCode, event: "transfer.reversed" } });

        const { data: transfer } = await supabase
          .from("payout_transfers")
          .select("escrow_split_id")
          .eq("paystack_reference", tReference)
          .single();

        if (transfer?.escrow_split_id) {
          await supabase
            .from("escrow_splits")
            .update({ disbursement_status: "held", released_at: null })
            .eq("id", transfer.escrow_split_id);
        }

        const { data: adminStaff } = await supabase
          .from("admin_staff")
          .select("user_id")
          .eq("admin_type", "main_admin");
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

    if (body.event !== "charge.success") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const data = body.data;
    const reference = data.reference || "";
    const amountPaid = (data.amount || 0) / 100;
    const transactionId = String(data.id || "");

    // ── Check office payout mode ──
    const getOfficePayoutMode = async (): Promise<boolean> => {
      try {
        const { data: flag } = await supabase
          .from("feature_flags")
          .select("is_enabled")
          .eq("feature_key", "office_payout_mode")
          .single();
        return flag?.is_enabled ?? false;
      } catch {
        return false;
      }
    };

    // ── Recipient mapping for settlement accounts ──
    const RECIPIENT_TO_ACCOUNT_TYPE: Record<string, string> = {
      rent_control: "igf",
      admin: "admin",
      platform: "platform",
      gra: "gra",
    };

    // ── Helper: Get or create Paystack transfer recipient ──
    const getOrCreateRecipient = async (accountDetails: {
      table: string;
      lookupField: string;
      lookupValue: string;
      payment_method: string;
      account_name?: string;
      bank_name?: string;
      account_number?: string;
      momo_number?: string;
      momo_provider?: string;
      paystack_recipient_code?: string;
    }): Promise<string | null> => {
      const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!PAYSTACK_SECRET_KEY) return null;

      // Return cached recipient code if available
      if (accountDetails.paystack_recipient_code) {
        return accountDetails.paystack_recipient_code;
      }

      try {
        const recipientPayload: any = {
          type: accountDetails.payment_method === "momo" ? "mobile_money" : "nuban",
          name: accountDetails.account_name || "Settlement Account",
          currency: "GHS",
        };

        if (accountDetails.payment_method === "momo") {
          recipientPayload.account_number = accountDetails.momo_number;
          const provider = (accountDetails.momo_provider || "").toLowerCase();
          recipientPayload.bank_code = provider === "mtn" ? "MTN" : provider === "vodafone" ? "VOD" : provider === "airteltigo" ? "ATL" : accountDetails.momo_provider;
        } else {
          recipientPayload.account_number = accountDetails.account_number;
          recipientPayload.bank_code = accountDetails.bank_name;
        }

        const res = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify(recipientPayload),
        });
        const result = await res.json();

        if (result.status && result.data?.recipient_code) {
          const recipientCode = result.data.recipient_code;
          // Cache the recipient code
          await supabase
            .from(accountDetails.table)
            .update({ paystack_recipient_code: recipientCode })
            .eq(accountDetails.lookupField, accountDetails.lookupValue);
          return recipientCode;
        }
        console.error("Failed to create recipient:", result.message);
        await logError({ reference, error_stage: "recipient_creation", error_message: result.message || "Failed to create Paystack recipient", severity: "critical", error_context: { account_type: accountDetails.lookupValue, payment_method: accountDetails.payment_method } });
        return null;
      } catch (e: any) {
        console.error("getOrCreateRecipient error:", e);
        await logError({ reference, error_stage: "recipient_creation", error_message: e.message || String(e), severity: "critical", error_context: { account_type: accountDetails.lookupValue } });
        return null;
      }
    };

    // ── Helper: Initiate a Paystack transfer ──
    const initiateTransfer = async (recipientCode: string, amount: number, reason: string, reference: string): Promise<{ success: boolean; transferCode?: string }> => {
      const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (!PAYSTACK_SECRET_KEY) return { success: false };

      try {
        const res = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(amount * 100),
            recipient: recipientCode,
            reason,
            reference,
            currency: "GHS",
          }),
        });
        const result = await res.json();
        if (result.status) {
          return { success: true, transferCode: result.data?.transfer_code };
        }
        console.error("Transfer failed:", result.message);
        await logError({ reference, error_stage: "transfer_initiation", error_message: result.message || "Transfer initiation failed", severity: "critical", error_context: { amount, recipient: recipientCode } });
        return { success: false };
      } catch (e: any) {
        console.error("initiateTransfer error:", e);
        await logError({ reference, error_stage: "transfer_initiation", error_message: e.message || String(e), severity: "critical", error_context: { amount, recipient: recipientCode } });
        return { success: false };
      }
    };

    // ── Helper: Trigger payouts for eligible splits ──
    const triggerPayouts = async (db: any, escrowTransactionId: string, splits: any[], officeId: string | null) => {
      try {
        // Check idempotency — skip if transfers already exist
        const { data: existingTransfers } = await db
          .from("payout_transfers")
          .select("id")
          .eq("escrow_transaction_id", escrowTransactionId)
          .limit(1);
        if (existingTransfers && existingTransfers.length > 0) return;

        const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (!PAYSTACK_SECRET_KEY) {
          console.log("PAYSTACK_SECRET_KEY not set — skipping transfers");
          return;
        }

        for (const split of splits) {
          // Skip landlord (manual) and held splits
          if (split.recipient === "landlord" || split.disbursement_status === "held") continue;
          if (split.amount <= 0) continue;

          const accountType = RECIPIENT_TO_ACCOUNT_TYPE[split.recipient];
          let recipientCode: string | null = null;
          let recipientType = split.recipient;

          if (accountType) {
            // System settlement account (igf, admin, platform, gra)
            const { data: account } = await db
              .from("system_settlement_accounts")
              .select("*")
              .eq("account_type", accountType)
              .single();

            if (account) {
              recipientCode = await getOrCreateRecipient({
                table: "system_settlement_accounts",
                lookupField: "account_type",
                lookupValue: accountType,
                payment_method: account.payment_method,
                account_name: account.account_name,
                bank_name: account.bank_name,
                account_number: account.account_number,
                momo_number: account.momo_number,
                momo_provider: account.momo_provider,
                paystack_recipient_code: account.paystack_recipient_code,
              });
              recipientType = accountType;
            }
          } else if (split.recipient === "admin" && officeId) {
            // Office payout account
            const { data: officeAccount } = await db
              .from("office_payout_accounts")
              .select("*")
              .eq("office_id", officeId)
              .single();

            if (officeAccount) {
              recipientCode = await getOrCreateRecipient({
                table: "office_payout_accounts",
                lookupField: "office_id",
                lookupValue: officeId,
                payment_method: officeAccount.payment_method,
                account_name: officeAccount.account_name,
                bank_name: officeAccount.bank_name,
                account_number: officeAccount.account_number,
                momo_number: officeAccount.momo_number,
                momo_provider: officeAccount.momo_provider,
                paystack_recipient_code: officeAccount.paystack_recipient_code,
              });
              recipientType = "office";
            }
          }

          const payoutRef = `payout_${escrowTransactionId.slice(0, 8)}_${split.id?.slice(0, 8) || Date.now()}`;

          if (recipientCode) {
            const { success, transferCode } = await initiateTransfer(
              recipientCode,
              split.amount,
              `${recipientType} share`,
              payoutRef
            );

            await db.from("payout_transfers").insert({
              escrow_split_id: split.id || null,
              escrow_transaction_id: escrowTransactionId,
              recipient_type: recipientType,
              recipient_code: recipientCode,
              transfer_code: transferCode || null,
              amount: split.amount,
              status: success ? "pending" : "failed",
              paystack_reference: payoutRef,
              failure_reason: success ? null : "Transfer initiation failed",
            });

            if (success && split.id) {
              await db.from("escrow_splits").update({ disbursement_status: "released", released_at: new Date().toISOString() }).eq("id", split.id);
            }
          } else {
            // No recipient configured — record as failed
            await db.from("payout_transfers").insert({
              escrow_split_id: split.id || null,
              escrow_transaction_id: escrowTransactionId,
              recipient_type: recipientType,
              recipient_code: null,
              amount: split.amount,
              status: "failed",
              paystack_reference: payoutRef,
              failure_reason: "No payout account configured for " + recipientType,
            });
          }
        }
      } catch (e: any) {
        console.error("triggerPayouts error:", e);
        await logError({ escrow_transaction_id: escrowTransactionId, error_stage: "trigger_payouts", error_message: e.message || String(e), severity: "critical" });
      }
    };

    // ── Helper: Complete escrow + create splits + generate receipt ──
    const completeEscrow = async (ref: string, userId: string, paymentType: string, totalAmt: number, splits: { recipient: string; amount: number; description: string }[], tenancyId?: string) => {
      try {
        const { data: escrowTx } = await supabase
          .from("escrow_transactions")
          .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
          .eq("reference", ref)
          .select("id, office_id, case_id, metadata")
          .maybeSingle();

        const escrowId = escrowTx?.id;
        const officeId = escrowTx?.office_id || (escrowTx?.metadata as any)?.office_id || null;

        // Check auto-release mode
        const autoRelease = await getOfficePayoutMode();

        if (escrowId && splits.length > 0) {
          // Check auto-release mode
          const autoRelease = await getOfficePayoutMode();

          const splitRows = splits.map(s => {
            const isAdminSplit = s.recipient === "admin";
            const releaseMode = (isAdminSplit && autoRelease) ? "auto" : "manual";
            // Under main-account-first model:
            // - landlord splits stay "held" (manual payout)
            // - admin (office) splits: "pending_transfer" if auto, "held" if manual
            // - igf/gra/platform: "pending_transfer" — will be paid via Paystack transfer
            const disbStatus = s.recipient === "landlord" ? "held"
              : (isAdminSplit && !autoRelease) ? "held"
              : "pending_transfer";

            return {
              escrow_transaction_id: escrowId,
              recipient: s.recipient,
              amount: s.amount,
              description: s.description,
              disbursement_status: disbStatus,
              released_at: null,
              office_id: officeId,
              release_mode: releaseMode,
            };
          });

          const { data: insertedSplits } = await supabase.from("escrow_splits").insert(splitRows).select("id, recipient, amount, disbursement_status");

          // If auto-release is on, create auto-approved fund request for admin splits
          if (autoRelease && officeId) {
            const adminTotal = splits
              .filter(s => s.recipient === "admin")
              .reduce((sum, s) => sum + s.amount, 0);

            if (adminTotal > 0) {
              await supabase.from("office_fund_requests").insert({
                office_id: officeId,
                amount: adminTotal,
                purpose: `Auto-released from ${paymentType.replace(/_/g, " ")} payment`,
                requested_by: userId,
                status: "approved",
                reviewed_by: userId,
                reviewed_at: new Date().toISOString(),
                reviewer_notes: "Auto-approved by system (Auto Release Mode)",
                payout_reference: `auto_${ref}`,
              });
            }
          }

          // Trigger Paystack transfers for eligible splits
          await triggerPayouts(supabase, escrowId, insertedSplits || [], officeId);
        }

        // Update case status
        if (escrowTx?.case_id) {
          await supabase.from("cases").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", escrowTx.case_id);
        }

        const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("user_id", userId).single();

        const splitBreakdown = splits.map(s => ({ recipient: s.recipient, amount: s.amount }));
        const receiptData = {
          escrow_transaction_id: escrowId,
          user_id: userId,
          payer_name: profile?.full_name || "Customer",
          payer_email: profile?.email || "",
          total_amount: totalAmt,
          payment_type: paymentType,
          description: `Payment for ${paymentType.replace(/_/g, " ")}`,
          split_breakdown: splitBreakdown,
          tenancy_id: tenancyId || null,
          qr_code_data: `${Deno.env.get("SUPABASE_URL")}/verify-receipt?ref=${ref}`,
          status: "active",
          office_id: officeId,
        };

        const { data: receipt } = await supabase.from("payment_receipts").insert(receiptData).select("receipt_number").single();
        return receipt?.receipt_number || ref;
      } catch (e: any) {
        console.error("Escrow completion error:", e);
        await logError({ reference: ref, error_stage: "escrow_completion", error_message: e.message || String(e), severity: "critical", error_context: { payment_type: paymentType, user_id: userId, total_amount: totalAmt } });
        return ref;
      }
    };

    // ── Helper: Send SMS ──
    const sendPaymentSms = async (userId: string, amount: number, description: string, receiptNo: string) => {
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
                message: `RentGhana: Payment of GH₵ ${amount.toFixed(2)} for ${description} confirmed. Receipt: ${receiptNo}. Thank you!`,
                recipients: [phone],
              }),
            });
          }
        }
      } catch (e) {
        console.error("SMS error:", e);
      }
    };

    // ── Helper: Send payment email ──
    const sendPaymentEmail = async (userId: string, amount: number, description: string, receiptNo: string) => {
      try {
        const { data: profile } = await supabase.from("profiles").select("email, full_name").eq("user_id", userId).single();
        if (profile?.email) {
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
              html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Plus Jakarta Sans',system-ui,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;"><tr><td style="background-color:#2d7a4f;padding:24px 32px;text-align:center;"><h1 style="color:#ffffff;margin:0;font-size:20px;">RentControlGhana</h1></td></tr><tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;"><p>Hello ${profile.full_name || "User"},</p><p>Your payment has been processed successfully.</p><table style="margin:16px 0;"><tr><td style="padding:4px 12px 4px 0;color:#666;">Amount:</td><td>GHS ${amount.toFixed(2)}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666;">Description:</td><td>${description}</td></tr><tr><td style="padding:4px 12px 4px 0;color:#666;">Receipt:</td><td>${receiptNo}</td></tr></table><p>Please log in to view details.</p></td></tr><tr><td style="padding:16px 32px 24px;color:#666;font-size:13px;border-top:1px solid #e5e5e5;"><p style="margin:0;">Regards,<br/><strong>RentControlGhana</strong></p></td></tr></table></td></tr></table></body></html>`,
              text: `Payment of GHS ${amount.toFixed(2)} for ${description} confirmed. Receipt: ${receiptNo}`,
              purpose: "transactional",
              label: "payment_successful",
              queued_at: new Date().toISOString(),
            },
          });
        }
      } catch (e) {
        console.error("Payment email error:", e);
      }
    };

    const sendPaymentNotifications = async (userId: string, amount: number, description: string, receiptNo: string) => {
      await sendPaymentSms(userId, amount, description, receiptNo);
      await sendPaymentEmail(userId, amount, description, receiptNo);
    };

    const sendNotification = async (userId: string, paymentType: string, amount: number, meta?: any) => {
      const config = NOTIFICATION_MESSAGES[paymentType];
      if (!config) return;
      try {
        await supabase.from("notifications").insert({
          user_id: userId,
          title: config.title,
          body: config.body(amount, meta),
          link: config.link || "/",
        });
      } catch (e) {
        console.error("Notification insert error:", e);
      }
    };

    // ── Helper: Get splits from escrow metadata (stored by checkout) ──
    const getSplitsFromEscrow = async (ref: string): Promise<{ recipient: string; amount: number; description: string }[]> => {
      try {
        const { data: escrowTx } = await supabase.from("escrow_transactions").select("metadata").eq("reference", ref).single();
        const splitPlan = (escrowTx?.metadata as any)?.split_plan;
        if (Array.isArray(splitPlan) && splitPlan.length > 0) return splitPlan;
      } catch {}
      return [];
    };

    // ── Determine payment type from reference and process ──
    if (reference.startsWith("rentbulk_")) {
      const tenancyId = reference.split("_")[1];
      const { error } = await supabase
        .from("rent_payments")
        .update({ tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", receiver: transactionId })
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false);
      if (error) console.error("Bulk rent payment update error:", error.message);

      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax (bulk advance)" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_tax_bulk", amountPaid, splits, tenancyId);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Bulk advance rent tax", receiptNo);
        await sendNotification(userId, "rent_tax_bulk", amountPaid);
      }

    } else if (reference.startsWith("rent_")) {
      const paymentId = reference.replace("rent_", "");
      const { error } = await supabase
        .from("rent_payments")
        .update({ tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", amount_paid: amountPaid, receiver: transactionId })
        .eq("id", paymentId);
      if (error) console.error("Rent payment update error:", error.message);

      const { data: payment } = await supabase.from("rent_payments").select("tenancy_id").eq("id", paymentId).single();
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", payment?.tenancy_id).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_tax", amountPaid, splits, payment?.tenancy_id);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Rent tax payment", receiptNo);
        await sendNotification(userId, "rent_tax", amountPaid);
      }

    } else if (reference.startsWith("rentpay_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "landlord", amount: amountPaid, description: "Monthly rent (held in escrow)" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_payment", amountPaid, splits, tenancyId);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Monthly rent", receiptNo);
        await sendNotification(userId, "rent_payment", amountPaid);
      }

    } else if (reference.startsWith("rentcombo_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splitPlan = await getSplitsFromEscrow(reference);
      if (splitPlan.length > 0) {
        const receiptNo = await completeEscrow(reference, userId, "rent_combined", amountPaid, splitPlan, tenancyId);
        if (userId) {
          await sendPaymentNotifications(userId, amountPaid, "Rent + Tax combined", receiptNo);
          await sendNotification(userId, "rent_combined", amountPaid);
        }
      }

    } else if (reference.startsWith("treg_")) {
      const userId = reference.split("_")[1];
      await supabase
        .from("tenants")
        .update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("user_id", userId);
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "platform", amount: 10, description: "Platform fixed fee" }, { recipient: "rent_control", amount: amountPaid * 0.65 - 6.5, description: "IGF" }, { recipient: "admin", amount: amountPaid * 0.25 - 2.5, description: "Admin" }];
      const receiptNo = await completeEscrow(reference, userId, "tenant_registration", amountPaid, splits);
      await sendPaymentNotifications(userId, amountPaid, "Tenant registration", receiptNo);
      await sendNotification(userId, "tenant_registration", amountPaid);

    } else if (reference.startsWith("lreg_")) {
      const userId = reference.split("_")[1];
      await supabase
        .from("landlords")
        .update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("user_id", userId);
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "platform", amount: 10, description: "Platform fixed fee" }, { recipient: "rent_control", amount: 13, description: "IGF" }, { recipient: "admin", amount: 5, description: "Admin" }, { recipient: "platform", amount: 2, description: "Platform share" }];
      const receiptNo = await completeEscrow(reference, userId, "landlord_registration", amountPaid, splits);
      await sendPaymentNotifications(userId, amountPaid, "Landlord registration", receiptNo);
      await sendNotification(userId, "landlord_registration", amountPaid);

    } else if (reference.startsWith("rcard_")) {
      const userId = reference.split("_")[1];
      const { data: escrowTx } = await supabase.from("escrow_transactions").select("metadata, id").eq("reference", reference).single();
      const qty = (escrowTx?.metadata as any)?.quantity || 1;
      const cardCount = qty * 2;
      const escrowId = escrowTx?.id || null;
      const rentCards = [];
      for (let i = 0; i < cardCount; i++) {
        rentCards.push({ landlord_user_id: userId, status: "valid", escrow_transaction_id: escrowId });
      }
      await supabase.from("rent_cards").insert(rentCards);
      const splits = (await getSplitsFromEscrow(reference)).length > 0
        ? await getSplitsFromEscrow(reference)
        : [{ recipient: "rent_control", amount: 15 * qty, description: "Rent Control" }, { recipient: "admin", amount: 10 * qty, description: "Admin" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_card", amountPaid, splits);
      await sendPaymentNotifications(userId, amountPaid, `Rent Card purchase (${qty} pair${qty > 1 ? "s" : ""}, ${cardCount} cards)`, receiptNo);
      await sendNotification(userId, "rent_card", amountPaid, { quantity: cardCount });

    } else if (reference.startsWith("agrsale_")) {
      const userId = data.metadata?.userId || "";
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "agreement_sale", amountPaid, splits.length > 0 ? splits : [{ recipient: "rent_control", amount: 10, description: "Rent Control" }, { recipient: "admin", amount: 20, description: "Admin" }]);
      await sendPaymentNotifications(userId, amountPaid, "Agreement form purchase", receiptNo);
      if (userId) await sendNotification(userId, "agreement_sale", amountPaid);

    } else if (reference.startsWith("comp_")) {
      const complaintId = reference.replace("comp_", "");
      await supabase.from("complaints").update({ status: "submitted" }).eq("id", complaintId);
      const userId = data.metadata?.userId || "";
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "complaint_fee", amountPaid, splits.length > 0 ? splits : [{ recipient: "platform", amount: amountPaid, description: "Complaint filing fee" }]);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Complaint filing fee", receiptNo);
        await sendNotification(userId, "complaint_fee", amountPaid);
      }

    } else if (reference.startsWith("list_")) {
      const propertyId = reference.split("_")[1];
      await supabase.from("properties").update({ listed_on_marketplace: true }).eq("id", propertyId);
      const userId = data.metadata?.userId || "";
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "listing_fee", amountPaid, splits.length > 0 ? splits : [{ recipient: "platform", amount: amountPaid, description: "Listing fee" }]);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Marketplace listing fee", receiptNo);
        await sendNotification(userId, "listing_fee", amountPaid);
      }

    } else if (reference.startsWith("view_")) {
      const viewingRequestId = reference.replace("view_", "");
      await supabase.from("viewing_requests").update({ status: "pending" }).eq("id", viewingRequestId).eq("status", "awaiting_payment");
      const userId = data.metadata?.userId || "";
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "viewing_fee", amountPaid, splits.length > 0 ? splits : [{ recipient: "platform", amount: amountPaid, description: "Viewing fee" }]);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Property viewing fee", receiptNo);
        await sendNotification(userId, "viewing_fee", amountPaid);
      }

    } else if (reference.startsWith("renew_")) {
      const tenancyId = reference.split("_")[1];
      const { data: oldTenancy } = await supabase.from("tenancies").select("*").eq("id", tenancyId).single();

      if (oldTenancy) {
        const rent = Number(oldTenancy.proposed_rent ?? oldTenancy.agreed_rent);
        const months = oldTenancy.renewal_duration_months ?? 12;
        const advanceMonths = Math.min(oldTenancy.advance_months ?? 6, 6);

        const newStart = new Date(oldTenancy.end_date);
        const newEnd = new Date(newStart);
        newEnd.setMonth(newEnd.getMonth() + months);

        const { data: newTenancy, error: insertErr } = await supabase
          .from("tenancies")
          .insert({
            tenant_user_id: oldTenancy.tenant_user_id,
            landlord_user_id: oldTenancy.landlord_user_id,
            unit_id: oldTenancy.unit_id,
            agreed_rent: rent,
            advance_months: advanceMonths,
            start_date: newStart.toISOString().split("T")[0],
            end_date: newEnd.toISOString().split("T")[0],
            move_in_date: newStart.toISOString().split("T")[0],
            tenant_id_code: oldTenancy.tenant_id_code,
            registration_code: `REN-${oldTenancy.registration_code}`,
            status: "active",
            tenancy_type: "renewal",
            previous_tenancy_id: tenancyId,
            tenant_accepted: true,
            landlord_accepted: true,
            office_id: oldTenancy.office_id || null,
          })
          .select("id")
          .single();

        if (!insertErr && newTenancy) {
          await supabase.from("tenancies").update({ status: "expired" }).eq("id", tenancyId);
          const payments = [];
          for (let i = 0; i < months; i++) {
            const dueDate = new Date(newStart);
            dueDate.setMonth(dueDate.getMonth() + i);
            const taxAmount = rent * 0.08;
            payments.push({
              tenancy_id: newTenancy.id,
              due_date: dueDate.toISOString().split("T")[0],
              month_label: dueDate.toLocaleString("en-GB", { month: "long", year: "numeric" }),
              monthly_rent: rent,
              tax_amount: taxAmount,
              amount_to_landlord: rent,
              status: i < advanceMonths ? "tenant_paid" : "pending",
              tenant_marked_paid: i < advanceMonths,
            });
          }
          if (payments.length > 0) await supabase.from("rent_payments").insert(payments);

          await supabase.from("notifications").insert([
            { user_id: oldTenancy.tenant_user_id, title: "Tenancy Renewed!", body: `Your tenancy has been renewed at GH₵ ${rent.toLocaleString()}/month for ${months} months.`, link: "/tenant/dashboard" },
            { user_id: oldTenancy.landlord_user_id, title: "Tenancy Renewed", body: `Tenancy ${oldTenancy.registration_code} has been renewed for ${months} months.`, link: "/landlord/dashboard" },
          ]);
        }

        const splits = await getSplitsFromEscrow(reference);
        const receiptNo = await completeEscrow(reference, oldTenancy.tenant_user_id, "renewal_payment", amountPaid, splits.length > 0 ? splits : [{ recipient: "rent_control", amount: amountPaid, description: `Renewal tax` }], tenancyId);
        await sendPaymentNotifications(oldTenancy.tenant_user_id, amountPaid, "Tenancy renewal", receiptNo);
      }

    } else if (reference.startsWith("addten_")) {
      const userId = reference.split("_")[1];
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "add_tenant_fee", amountPaid, splits.length > 0 ? splits : [{ recipient: "platform", amount: amountPaid, description: "Add tenant fee" }]);
      await sendPaymentNotifications(userId, amountPaid, "Add tenant fee", receiptNo);
      await sendNotification(userId, "add_tenant_fee", amountPaid);

    } else if (reference.startsWith("term_")) {
      const userId = reference.split("_")[1];
      const splits = await getSplitsFromEscrow(reference);
      const receiptNo = await completeEscrow(reference, userId, "termination_fee", amountPaid, splits.length > 0 ? splits : [{ recipient: "platform", amount: amountPaid, description: "Termination request fee" }]);
      await sendPaymentNotifications(userId, amountPaid, "Termination request fee", receiptNo);
      await sendNotification(userId, "termination_fee", amountPaid);

    } else {
      console.log("Unknown reference format:", reference);
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }
});

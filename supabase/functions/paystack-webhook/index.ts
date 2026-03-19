import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

// Split rules (must match checkout)
const SPLIT_RULES: Record<string, { splits: { recipient: string; amount: number; description: string }[] }> = {
  tenant_registration: {
    splits: [
      { recipient: "rent_control", amount: 15, description: "Rent Control registration fee" },
      { recipient: "admin", amount: 15, description: "Admin registration fee" },
      { recipient: "platform", amount: 10, description: "Platform fee" },
    ],
  },
  landlord_registration: {
    splits: [
      { recipient: "rent_control", amount: 13, description: "Rent Control registration fee" },
      { recipient: "admin", amount: 7, description: "Admin registration fee" },
      { recipient: "platform", amount: 10, description: "Platform fee" },
    ],
  },
  rent_card: {
    splits: [
      { recipient: "rent_control", amount: 15, description: "Rent Control - Rent Card" },
      { recipient: "admin", amount: 10, description: "Admin - Rent Card" },
    ],
  },
  agreement_sale: {
    splits: [
      { recipient: "rent_control", amount: 10, description: "Rent Control - Agreement" },
      { recipient: "admin", amount: 20, description: "Admin - Agreement" },
    ],
  },
  complaint_fee: { splits: [{ recipient: "platform", amount: 2, description: "Complaint filing fee" }] },
  listing_fee: { splits: [{ recipient: "platform", amount: 2, description: "Listing fee" }] },
  viewing_fee: { splits: [{ recipient: "platform", amount: 2, description: "Viewing fee" }] },
};

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
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("Paystack webhook event:", body.event);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Handle charge.failed ──
    if (body.event === "charge.failed") {
      const data = body.data;
      const reference = data.reference || "";
      const amountFailed = (data.amount || 0) / 100;

      // Update escrow transaction to failed
      const { data: escrowTx } = await supabase
        .from("escrow_transactions")
        .update({ status: "failed" })
        .eq("reference", reference)
        .select("user_id, payment_type")
        .maybeSingle();

      if (escrowTx) {
        const userId = escrowTx.user_id;
        const paymentLabel = (escrowTx.payment_type || "payment").replace(/_/g, " ");

        // In-app notification
        await supabase.from("notifications").insert({
          user_id: userId,
          title: "Payment Failed",
          body: `Your payment of GH₵ ${amountFailed.toFixed(2)} for ${paymentLabel} could not be processed. Please try again.`,
          link: "/",
        });

        // SMS notification
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
        } catch (e) {
          console.error("SMS error (failed payment):", e);
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

    // ── Helper: Complete escrow + create splits + generate receipt ──
    const completeEscrow = async (ref: string, userId: string, paymentType: string, totalAmt: number, splits: { recipient: string; amount: number; description: string }[], tenancyId?: string) => {
      try {
        const { data: escrowTx } = await supabase
          .from("escrow_transactions")
          .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
          .eq("reference", ref)
          .select("id")
          .maybeSingle();

        const escrowId = escrowTx?.id;

        if (escrowId && splits.length > 0) {
          await supabase.from("escrow_splits").insert(
            splits.map(s => ({
              escrow_transaction_id: escrowId,
              recipient: s.recipient,
              amount: s.amount,
              description: s.description,
              disbursement_status: s.recipient === "landlord" ? "held" : "released",
              released_at: s.recipient !== "landlord" ? new Date().toISOString() : null,
            }))
          );
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
        };

        const { data: receipt } = await supabase.from("payment_receipts").insert(receiptData).select("receipt_number").single();
        return receipt?.receipt_number || ref;
      } catch (e) {
        console.error("Escrow completion error:", e);
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

    // ── Helper: Send SMS + Email for payment (combined) ──
    const sendPaymentNotifications = async (userId: string, amount: number, description: string, receiptNo: string) => {
      await sendPaymentSms(userId, amount, description, receiptNo);
      await sendPaymentEmail(userId, amount, description, receiptNo);
    };

    // ── Helper: Send in-app notification ──
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

    // ── Determine payment type from reference and process ──
    const metadataType = data.metadata?.type || "";

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
      const splits = [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax (bulk advance)" }];
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
      const splits = [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_tax", amountPaid, splits, payment?.tenancy_id);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Rent tax payment", receiptNo);
        await sendNotification(userId, "rent_tax", amountPaid);
      }

    } else if (reference.startsWith("rentpay_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = [{ recipient: "landlord", amount: amountPaid, description: "Monthly rent (held in escrow)" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_payment", amountPaid, splits, tenancyId);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Monthly rent", receiptNo);
        await sendNotification(userId, "rent_payment", amountPaid);
      }

    } else if (reference.startsWith("rentcombo_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id, agreed_rent, unit_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const { data: escrowTx } = await supabase.from("escrow_transactions").select("metadata").eq("reference", reference).single();
      const splitPlan = (escrowTx?.metadata as any)?.split_plan || [];
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
      const receiptNo = await completeEscrow(reference, userId, "tenant_registration", amountPaid, SPLIT_RULES.tenant_registration.splits);
      await sendPaymentNotifications(userId, amountPaid, "Tenant registration", receiptNo);
      await sendNotification(userId, "tenant_registration", amountPaid);

    } else if (reference.startsWith("lreg_")) {
      const userId = reference.split("_")[1];
      await supabase
        .from("landlords")
        .update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
        .eq("user_id", userId);
      const receiptNo = await completeEscrow(reference, userId, "landlord_registration", amountPaid, SPLIT_RULES.landlord_registration.splits);
      await sendPaymentNotifications(userId, amountPaid, "Landlord registration", receiptNo);
      await sendNotification(userId, "landlord_registration", amountPaid);

    } else if (reference.startsWith("rcard_")) {
      const userId = reference.split("_")[1];
      const { data: escrowTx } = await supabase.from("escrow_transactions").select("metadata, id").eq("reference", reference).single();
      const qty = (escrowTx?.metadata as any)?.quantity || 1;
      const escrowId = escrowTx?.id || null;
      const rentCards = [];
      for (let i = 0; i < qty; i++) {
        rentCards.push({ landlord_user_id: userId, status: "valid", escrow_transaction_id: escrowId });
      }
      await supabase.from("rent_cards").insert(rentCards);
      const splits = SPLIT_RULES.rent_card.splits.map(s => ({ ...s, amount: s.amount * qty }));
      const receiptNo = await completeEscrow(reference, userId, "rent_card", amountPaid, splits);
      await sendPaymentNotifications(userId, amountPaid, `Rent Card purchase (${qty} cards)`, receiptNo);
      await sendNotification(userId, "rent_card", amountPaid, { quantity: qty });

    } else if (reference.startsWith("agrsale_")) {
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "agreement_sale", amountPaid, SPLIT_RULES.agreement_sale.splits);
      await sendPaymentNotifications(userId, amountPaid, "Agreement form purchase", receiptNo);
      if (userId) await sendNotification(userId, "agreement_sale", amountPaid);

    } else if (reference.startsWith("comp_")) {
      const complaintId = reference.replace("comp_", "");
      await supabase.from("complaints").update({ status: "submitted" }).eq("id", complaintId);
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "complaint_fee", amountPaid, SPLIT_RULES.complaint_fee.splits);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Complaint filing fee", receiptNo);
        await sendNotification(userId, "complaint_fee", amountPaid);
      }

    } else if (reference.startsWith("list_")) {
      const propertyId = reference.split("_")[1];
      await supabase.from("properties").update({ listed_on_marketplace: true }).eq("id", propertyId);
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "listing_fee", amountPaid, SPLIT_RULES.listing_fee.splits);
      if (userId) {
        await sendPaymentNotifications(userId, amountPaid, "Marketplace listing fee", receiptNo);
        await sendNotification(userId, "listing_fee", amountPaid);
      }

    } else if (reference.startsWith("view_")) {
      const viewingRequestId = reference.replace("view_", "");
      await supabase.from("viewing_requests").update({ status: "pending" }).eq("id", viewingRequestId).eq("status", "awaiting_payment");
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "viewing_fee", amountPaid, SPLIT_RULES.viewing_fee.splits);
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

        const splits = [{ recipient: "rent_control", amount: amountPaid, description: `Renewal tax (${advanceMonths} months)` }];
        const receiptNo = await completeEscrow(reference, oldTenancy.tenant_user_id, "renewal_payment", amountPaid, splits, tenancyId);
        await sendPaymentNotifications(oldTenancy.tenant_user_id, amountPaid, "Tenancy renewal", receiptNo);
      }

    } else if (reference.startsWith("addten_")) {
      const userId = reference.split("_")[1];
      const splits = [{ recipient: "platform", amount: amountPaid, description: "Add tenant fee" }];
      const receiptNo = await completeEscrow(reference, userId, "add_tenant_fee", amountPaid, splits);
      await sendPaymentNotifications(userId, amountPaid, "Add tenant fee", receiptNo);
      await sendNotification(userId, "add_tenant_fee", amountPaid);

    } else if (reference.startsWith("term_")) {
      const userId = reference.split("_")[1];
      const splits = [{ recipient: "platform", amount: amountPaid, description: "Termination request fee" }];
      const receiptNo = await completeEscrow(reference, userId, "termination_fee", amountPaid, splits);
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

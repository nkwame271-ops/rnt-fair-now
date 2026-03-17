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

    if (body.event !== "charge.success") {
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const data = body.data;
    const reference = data.reference || "";
    const amountPaid = (data.amount || 0) / 100;
    const transactionId = String(data.id || "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Helper: Complete escrow + create splits + generate receipt ──
    const completeEscrow = async (ref: string, userId: string, paymentType: string, totalAmt: number, splits: { recipient: string; amount: number; description: string }[], tenancyId?: string) => {
      try {
        // Update escrow transaction
        const { data: escrowTx } = await supabase
          .from("escrow_transactions")
          .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
          .eq("reference", ref)
          .select("id")
          .maybeSingle();

        const escrowId = escrowTx?.id;

        // Insert splits
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

        // Get payer info
        const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("user_id", userId).single();

        // Generate receipt
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

    // ── Determine payment type from reference and process ──
    const metadataType = data.metadata?.type || "";

    if (reference.startsWith("rentbulk_")) {
      const tenancyId = reference.split("_")[1];

      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Paystack",
          receiver: transactionId,
        })
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false);

      if (error) console.error("Bulk rent payment update error:", error.message);

      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax (bulk advance)" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_tax_bulk", amountPaid, splits, tenancyId);
      if (userId) await sendPaymentSms(userId, amountPaid, "Bulk advance rent tax", receiptNo);

    } else if (reference.startsWith("rent_")) {
      const paymentId = reference.replace("rent_", "");
      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Paystack",
          amount_paid: amountPaid,
          receiver: transactionId,
        })
        .eq("id", paymentId);

      if (error) console.error("Rent payment update error:", error.message);

      const { data: payment } = await supabase.from("rent_payments").select("tenancy_id").eq("id", paymentId).single();
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", payment?.tenancy_id).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = [{ recipient: "rent_control", amount: amountPaid, description: "Rent tax" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_tax", amountPaid, splits, payment?.tenancy_id);
      if (userId) await sendPaymentSms(userId, amountPaid, "Rent tax payment", receiptNo);

    } else if (reference.startsWith("rentpay_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;
      const splits = [{ recipient: "landlord", amount: amountPaid, description: "Monthly rent (held in escrow)" }];
      const receiptNo = await completeEscrow(reference, userId, "rent_payment", amountPaid, splits, tenancyId);
      if (userId) await sendPaymentSms(userId, amountPaid, "Monthly rent", receiptNo);

    } else if (reference.startsWith("rentcombo_")) {
      const tenancyId = reference.split("_")[1];
      const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id, agreed_rent, unit_id").eq("id", tenancyId).single();
      const userId = tenancy?.tenant_user_id || data.metadata?.userId;

      // Determine tax from escrow metadata
      const { data: escrowTx } = await supabase.from("escrow_transactions").select("metadata").eq("reference", reference).single();
      const splitPlan = (escrowTx?.metadata as any)?.split_plan || [];

      if (splitPlan.length > 0) {
        const receiptNo = await completeEscrow(reference, userId, "rent_combined", amountPaid, splitPlan, tenancyId);
        if (userId) await sendPaymentSms(userId, amountPaid, "Rent + Tax combined", receiptNo);
      }

    } else if (reference.startsWith("treg_")) {
      const userId = reference.split("_")[1];
      await supabase
        .from("tenants")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      const receiptNo = await completeEscrow(reference, userId, "tenant_registration", amountPaid, SPLIT_RULES.tenant_registration.splits);
      await sendPaymentSms(userId, amountPaid, "Tenant registration", receiptNo);

    } else if (reference.startsWith("lreg_")) {
      const userId = reference.split("_")[1];
      await supabase
        .from("landlords")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      const receiptNo = await completeEscrow(reference, userId, "landlord_registration", amountPaid, SPLIT_RULES.landlord_registration.splits);
      await sendPaymentSms(userId, amountPaid, "Landlord registration", receiptNo);

    } else if (reference.startsWith("rcard_")) {
      const userId = reference.split("_")[1];
      await supabase.from("landlords").update({ rent_card_delivery_requested: true }).eq("user_id", userId);
      const receiptNo = await completeEscrow(reference, userId, "rent_card", amountPaid, SPLIT_RULES.rent_card.splits);
      await sendPaymentSms(userId, amountPaid, "Rent Card purchase", receiptNo);

    } else if (reference.startsWith("agrsale_")) {
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "agreement_sale", amountPaid, SPLIT_RULES.agreement_sale.splits);
      await sendPaymentSms(userId, amountPaid, "Agreement form purchase", receiptNo);

    } else if (reference.startsWith("comp_")) {
      const complaintId = reference.replace("comp_", "");
      await supabase.from("complaints").update({ status: "submitted" }).eq("id", complaintId);
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "complaint_fee", amountPaid, SPLIT_RULES.complaint_fee.splits);

    } else if (reference.startsWith("list_")) {
      const propertyId = reference.split("_")[1];
      await supabase.from("properties").update({ listed_on_marketplace: true }).eq("id", propertyId);
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "listing_fee", amountPaid, SPLIT_RULES.listing_fee.splits);

    } else if (reference.startsWith("view_")) {
      const viewingRequestId = reference.replace("view_", "");
      await supabase.from("viewing_requests").update({ status: "pending" }).eq("id", viewingRequestId).eq("status", "awaiting_payment");
      const userId = data.metadata?.userId || "";
      const receiptNo = await completeEscrow(reference, userId, "viewing_fee", amountPaid, SPLIT_RULES.viewing_fee.splits);

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
        await sendPaymentSms(oldTenancy.tenant_user_id, amountPaid, "Tenancy renewal", receiptNo);
      }

    } else {
      console.log("Unknown reference format:", reference);
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }
});

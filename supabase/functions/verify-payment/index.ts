import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logError = async (opts: { escrow_transaction_id?: string; reference?: string; error_stage: string; error_message: string; error_context?: Record<string, any>; severity?: string }) => {
    try {
      await supabaseAdmin.from("payment_processing_errors").insert({ function_name: "verify-payment", severity: "warning", ...opts });
    } catch (e) { console.error("Failed to log error:", e); }
  };

  try {
    // Parse reference from request body or query params
    let reference: string;
    const url = new URL(req.url);
    if (req.method === "POST") {
      const body = await req.json();
      reference = body.reference || url.searchParams.get("reference") || "";
    } else {
      reference = url.searchParams.get("reference") || "";
    }
    if (!reference) throw new Error("reference is required");

    // Try to authenticate (optional — may fail after redirect)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user } } = await supabaseUser.auth.getUser();
      userId = user?.id ?? null;
    }

    // 1. Check if escrow exists
    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, payment_type, user_id, total_amount, related_property_id, related_tenancy_id, reference, metadata")
      .eq("reference", reference)
      .maybeSingle();

    if (!escrow) throw new Error("Transaction not found");

    // If authenticated, verify ownership
    if (userId && escrow.user_id !== userId) throw new Error("Unauthorized");

    // Already completed — just confirm
    if (escrow.status === "completed") {
      return new Response(JSON.stringify({ verified: true, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verify with Paystack API
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const paystackData = await paystackRes.json();

    if (!paystackData.status || paystackData.data?.status !== "success") {
      return new Response(JSON.stringify({ verified: false, status: paystackData.data?.status || "not_paid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Payment is verified — finalize
    const amountPaid = (paystackData.data.amount || 0) / 100;
    const transactionId = String(paystackData.data.id || "");
    const escrowUserId = escrow.user_id;

    // Update escrow to completed (idempotent — only if still pending)
    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
      .eq("id", escrow.id)
      .eq("status", "pending");

    // 4. Handle payment-type-specific finalization
    const paymentType = escrow.payment_type;
    const meta = (escrow.metadata as any) || {};

    if (paymentType === "tenant_registration") {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("registration_fee_paid")
        .eq("user_id", escrowUserId)
        .single();
      if (tenant && !tenant.registration_fee_paid) {
        await supabaseAdmin
          .from("tenants")
          .update({
            registration_fee_paid: true,
            registration_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("user_id", escrowUserId);
      }
    } else if (paymentType === "landlord_registration") {
      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("registration_fee_paid")
        .eq("user_id", escrowUserId)
        .single();
      if (landlord && !landlord.registration_fee_paid) {
        await supabaseAdmin
          .from("landlords")
          .update({
            registration_fee_paid: true,
            registration_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("user_id", escrowUserId);
      }
    } else if (paymentType === "listing_fee") {
      const propertyId = escrow.related_property_id;
      if (propertyId) {
        await supabaseAdmin
          .from("properties")
          .update({ listed_on_marketplace: true })
          .eq("id", propertyId);
      }
    } else if (paymentType === "complaint_fee") {
      const complaintId = meta?.complaintId;
      if (complaintId) {
        await supabaseAdmin
          .from("complaints")
          .update({ status: "submitted" })
          .eq("id", complaintId)
          .eq("status", "pending_payment");
      }
    } else if (paymentType === "viewing_fee") {
      const viewingRequestId = meta?.viewingRequestId;
      if (viewingRequestId) {
        await supabaseAdmin
          .from("viewing_requests")
          .update({ status: "pending" })
          .eq("id", viewingRequestId)
          .eq("status", "awaiting_payment");
      }
    } else if (paymentType === "rent_tax_bulk") {
      const tenancyId = escrow.related_tenancy_id;
      if (tenancyId) {
        await supabaseAdmin
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
      }
    } else if (paymentType === "rent_tax") {
      const paymentIds = meta?.paymentIds;
      if (Array.isArray(paymentIds) && paymentIds.length > 0) {
        await supabaseAdmin
          .from("rent_payments")
          .update({
            tenant_marked_paid: true,
            status: "tenant_paid",
            paid_date: new Date().toISOString(),
            payment_method: "Paystack",
            amount_paid: amountPaid,
            receiver: transactionId,
          })
          .in("id", paymentIds);
      } else {
        const ref = escrow.reference || "";
        if (ref.startsWith("rent_")) {
          const paymentId = ref.replace("rent_", "");
          await supabaseAdmin
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
        }
      }
    } else if (paymentType === "rent_card_bulk" || paymentType === "rent_card") {
      const qty = meta?.quantity || 1;
      const cardCount = qty * 2;
      const { data: existingCards } = await supabaseAdmin
        .from("rent_cards")
        .select("id")
        .eq("escrow_transaction_id", escrow.id);

      if (!existingCards || existingCards.length === 0) {
        const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
        const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
        const rentCards = [];
        for (let i = 0; i < cardCount; i++) {
          rentCards.push({
            landlord_user_id: escrowUserId,
            status: "awaiting_serial",
            escrow_transaction_id: escrow.id,
            serial_number: null,
            purchase_id: purchaseId,
          });
        }
        await supabaseAdmin.from("rent_cards").insert(rentCards);
      }
    }

    // 5. Create receipt if not exists
    const { data: existingReceipt } = await supabaseAdmin
      .from("payment_receipts")
      .select("id")
      .eq("escrow_transaction_id", escrow.id)
      .maybeSingle();

    if (!existingReceipt) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name, email")
        .eq("user_id", escrowUserId)
        .single();

      const splitPlan = meta?.split_plan || [];
      const splitBreakdown = splitPlan.map((s: any) => ({ recipient: s.recipient, amount: s.amount }));

      await supabaseAdmin.from("payment_receipts").insert({
        escrow_transaction_id: escrow.id,
        user_id: escrowUserId,
        payer_name: profile?.full_name || "Customer",
        payer_email: profile?.email || "",
        total_amount: amountPaid,
        payment_type: paymentType,
        description: meta?.description || `Payment for ${paymentType.replace(/_/g, " ")}`,
        split_breakdown: splitBreakdown.length > 0 ? splitBreakdown : null,
        qr_code_data: `https://www.rentcontrolghana.com/verify/receipt/${reference}`,
        status: "active",
      });
    }

    // 6. Send notification if not already sent
    const { data: existingNotif } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", escrowUserId)
      .ilike("body", `%${reference.slice(0, 12)}%`)
      .maybeSingle();

    if (!existingNotif) {
      const notifMap: Record<string, { title: string; body: string; link: string }> = {
        tenant_registration: { title: "Registration Confirmed!", body: "Your tenant registration payment has been confirmed. Your account is now active.", link: "/tenant/dashboard" },
        landlord_registration: { title: "Registration Confirmed!", body: "Your landlord registration payment has been confirmed. Your account is now active.", link: "/landlord/dashboard" },
        listing_fee: { title: "Property Listed!", body: "Your property has been listed on the marketplace.", link: "/landlord/my-properties" },
        rent_card_bulk: { title: "Rent Cards Purchased", body: `${meta?.quantity || 1} Rent Card(s) purchased successfully for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
        rent_card: { title: "Rent Card Purchased", body: `Rent Card purchased for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
        add_tenant_fee: { title: "Add Tenant Fee Paid", body: `Add tenant fee of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/landlord/add-tenant" },
        complaint_fee: { title: "Complaint Filed", body: `Your complaint filing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed. Your case is now under review.`, link: "/tenant/my-cases" },
        viewing_fee: { title: "Viewing Request Sent", body: `Your viewing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed. The landlord will respond to your request.`, link: "/tenant/marketplace" },
      };
      const notif = notifMap[paymentType];
      if (notif) {
        await supabaseAdmin.from("notifications").insert({
          user_id: escrowUserId,
          title: notif.title,
          body: notif.body,
          link: notif.link,
        });
      }
    }

    // 7. Trigger payouts (idempotent — skips if payout_transfers already exist)
    try {
      const { data: existingPayouts } = await supabaseAdmin
        .from("payout_transfers")
        .select("id")
        .eq("escrow_transaction_id", escrow.id)
        .limit(1);

      if (!existingPayouts || existingPayouts.length === 0) {
        const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (PAYSTACK_SK) {
          const { data: splits } = await supabaseAdmin
            .from("escrow_splits")
            .select("id, recipient, amount, disbursement_status")
            .eq("escrow_transaction_id", escrow.id);

          if (splits && splits.length > 0) {
            const RECIPIENT_MAP: Record<string, string> = { rent_control: "igf", admin: "admin", platform: "platform", gra: "gra" };

            for (const split of splits) {
              if (split.recipient === "landlord" || split.disbursement_status === "held" || split.amount <= 0) continue;

              const accountType = RECIPIENT_MAP[split.recipient];
              if (!accountType) continue;

              const { data: account } = await supabaseAdmin
                .from("system_settlement_accounts")
                .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
                .eq("account_type", accountType)
                .single();

              if (!account) continue;

              let recipientCode = account.paystack_recipient_code;
              if (!recipientCode) {
                const recipientPayload: any = {
                  type: account.payment_method === "momo" ? "mobile_money" : "nuban",
                  name: account.account_name || "Settlement Account",
                  currency: "GHS",
                };
                if (account.payment_method === "momo") {
                  recipientPayload.account_number = account.momo_number;
                  const p = (account.momo_provider || "").toLowerCase();
                  recipientPayload.bank_code = p === "mtn" ? "MTN" : p === "vodafone" ? "VOD" : p === "airteltigo" ? "ATL" : account.momo_provider;
                } else {
                  recipientPayload.account_number = account.account_number;
                  recipientPayload.bank_code = account.bank_name;
                }
                const rRes = await fetch("https://api.paystack.co/transferrecipient", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
                  body: JSON.stringify(recipientPayload),
                });
                const rData = await rRes.json();
                if (rData.status && rData.data?.recipient_code) {
                  recipientCode = rData.data.recipient_code;
                  await supabaseAdmin.from("system_settlement_accounts").update({ paystack_recipient_code: recipientCode }).eq("account_type", accountType);
                }
              }

              const payoutRef = `vpayout_${escrow.id.slice(0, 8)}_${split.id.slice(0, 8)}`;
              if (recipientCode) {
                const tRes = await fetch("https://api.paystack.co/transfer", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ source: "balance", amount: Math.round(split.amount * 100), recipient: recipientCode, reason: `${accountType} share`, reference: payoutRef, currency: "GHS" }),
                });
                const tData = await tRes.json();
                await supabaseAdmin.from("payout_transfers").insert({
                  escrow_split_id: split.id,
                  escrow_transaction_id: escrow.id,
                  recipient_type: accountType,
                  recipient_code: recipientCode,
                  transfer_code: tData.data?.transfer_code || null,
                  amount: split.amount,
                  status: tData.status ? "pending" : "failed",
                  paystack_reference: payoutRef,
                  failure_reason: tData.status ? null : (tData.message || "Transfer failed"),
                });
                if (tData.status) {
                  await supabaseAdmin.from("escrow_splits").update({ disbursement_status: "released", released_at: new Date().toISOString() }).eq("id", split.id);
                }
              }
            }
          }
        }
      }
    } catch (payoutErr: any) {
      console.error("Verify-payment payout trigger error:", payoutErr.message);
      await logError({ escrow_transaction_id: escrow.id, reference, error_stage: "payout_trigger", error_message: payoutErr.message || String(payoutErr), severity: "critical" });
    }

    return new Response(JSON.stringify({ verified: true, status: "completed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Verify payment error:", error.message);
    await logError({ error_stage: "top_level", error_message: error.message || String(error), severity: "critical" });
    return new Response(JSON.stringify({ error: error.message, verified: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

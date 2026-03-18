import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { reference } = await req.json();
    if (!reference) throw new Error("reference is required");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Check if escrow exists
    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, payment_type, user_id, total_amount, related_property_id, metadata")
      .eq("reference", reference)
      .maybeSingle();

    if (!escrow) throw new Error("Transaction not found");
    if (escrow.user_id !== user.id) throw new Error("Unauthorized");

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

    // Update escrow to completed (idempotent — only if still pending)
    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
      .eq("id", escrow.id)
      .eq("status", "pending");

    // 4. Handle payment-type-specific finalization
    const paymentType = escrow.payment_type;
    const userId = escrow.user_id;
    const meta = (escrow.metadata as any) || {};

    if (paymentType === "tenant_registration") {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (tenant && !tenant.registration_fee_paid) {
        await supabaseAdmin
          .from("tenants")
          .update({
            registration_fee_paid: true,
            registration_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
    } else if (paymentType === "landlord_registration") {
      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (landlord && !landlord.registration_fee_paid) {
        await supabaseAdmin
          .from("landlords")
          .update({
            registration_fee_paid: true,
            registration_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("user_id", userId);
      }
    } else if (paymentType === "listing_fee") {
      // Mark property as listed
      const propertyId = escrow.related_property_id;
      if (propertyId) {
        await supabaseAdmin
          .from("properties")
          .update({ listed_on_marketplace: true })
          .eq("id", propertyId);
      }
    } else if (paymentType === "complaint_fee") {
      // Update complaint status from pending_payment to submitted
      const complaintId = meta?.complaintId;
      if (complaintId) {
        await supabaseAdmin
          .from("complaints")
          .update({ status: "submitted" })
          .eq("id", complaintId)
          .eq("status", "pending_payment");
      }
    } else if (paymentType === "viewing_fee") {
      // Update viewing request status from awaiting_payment to pending
      const viewingRequestId = meta?.viewingRequestId;
      if (viewingRequestId) {
        await supabaseAdmin
          .from("viewing_requests")
          .update({ status: "pending" })
          .eq("id", viewingRequestId)
          .eq("status", "awaiting_payment");
      }
    } else if (paymentType === "rent_card_bulk" || paymentType === "rent_card") {
      // Create rent cards if not already created
      const qty = meta?.quantity || 1;
      const { data: existingCards } = await supabaseAdmin
        .from("rent_cards")
        .select("id")
        .eq("escrow_transaction_id", escrow.id);

      if (!existingCards || existingCards.length === 0) {
        const rentCards = [];
        for (let i = 0; i < qty; i++) {
          rentCards.push({ landlord_user_id: userId, status: "valid", escrow_transaction_id: escrow.id });
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
        .eq("user_id", userId)
        .single();

      const splitPlan = meta?.split_plan || [];
      const splitBreakdown = splitPlan.map((s: any) => ({ recipient: s.recipient, amount: s.amount }));

      await supabaseAdmin.from("payment_receipts").insert({
        escrow_transaction_id: escrow.id,
        user_id: userId,
        payer_name: profile?.full_name || "Customer",
        payer_email: profile?.email || "",
        total_amount: amountPaid,
        payment_type: paymentType,
        description: meta?.description || `Payment for ${paymentType.replace(/_/g, " ")}`,
        split_breakdown: splitBreakdown.length > 0 ? splitBreakdown : null,
        qr_code_data: `https://rentghanapilot.lovable.app/verify/receipt/${reference}`,
        status: "active",
      });
    }

    // 6. Send notification if not already sent for this escrow
    const { data: existingNotif } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
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
      };
      const notif = notifMap[paymentType];
      if (notif) {
        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          title: notif.title,
          body: notif.body,
          link: notif.link,
        });
      }
    }

    return new Response(JSON.stringify({ verified: true, status: "completed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Verify payment error:", error.message);
    return new Response(JSON.stringify({ error: error.message, verified: false }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

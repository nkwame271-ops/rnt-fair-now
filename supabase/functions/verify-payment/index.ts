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

    // 1. Check if escrow is already completed
    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, payment_type, user_id, total_amount")
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

    // 4. Handle registration-specific finalization
    const paymentType = escrow.payment_type;
    const userId = escrow.user_id;

    if (paymentType === "tenant_registration") {
      // Only update if not already paid (idempotent)
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

      await supabaseAdmin.from("payment_receipts").insert({
        escrow_transaction_id: escrow.id,
        user_id: userId,
        payer_name: profile?.full_name || "Customer",
        payer_email: profile?.email || "",
        total_amount: amountPaid,
        payment_type: paymentType,
        description: `Payment for ${paymentType.replace(/_/g, " ")}`,
        status: "active",
      });
    }

    // 6. Send notification if not already sent
    const { data: existingNotif } = await supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("user_id", userId)
      .ilike("title", "%Registration Confirmed%")
      .maybeSingle();

    if (!existingNotif) {
      const roleLabel = paymentType === "tenant_registration" ? "tenant" : "landlord";
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: "Registration Confirmed!",
        body: `Your ${roleLabel} registration payment has been confirmed. Your account is now active.`,
        link: `/${roleLabel}/dashboard`,
      });
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

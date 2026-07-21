// Creates a Premium Service subscription draft and returns branded-checkout
// details. The subscription row is only created on payment verify.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { property_id, subscriber_role } = await req.json();
    if (!subscriber_role) return json({ error: "subscriber_role is required" }, 400);
    if (!property_id) return json({ error: "property_id is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: flag } = await supabaseAdmin
      .from("feature_flags")
      .select("fee_amount, fee_enabled, billing_frequency")
      .eq("feature_key", "premium_service_subscription")
      .maybeSingle();
    const feeAmount = Number(flag?.fee_amount || 0);
    const feeEnabled = flag?.fee_enabled ?? true;
    const billingFrequency = flag?.billing_frequency || "monthly";

    if (!feeEnabled || feeAmount <= 0) {
      return json({ error: "Premium Service is not currently available." }, 400);
    }

    const reference = `PREM_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

    const { error: dErr } = await supabaseAdmin.from("pending_premium_drafts").insert({
      user_id: user.id,
      subscriber_role,
      property_id,
      fee_amount: feeAmount,
      billing_frequency: billingFrequency,
      reference,
      status: "pending_payment",
    });
    if (dErr) throw dErr;

    const email = user.email;
    if (!email) return json({ error: "Your account needs an email address to check out." }, 400);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const PAYSTACK_PUBLIC_KEY = Deno.env.get("PAYSTACK_PUBLIC_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment gateway not configured" }, 500);

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(feeAmount * 100),
        currency: "GHS",
        reference,
        metadata: {
          type: "premium_service_subscription",
          property_id,
          subscriber_role,
          user_id: user.id,
          description: "Premium Service subscription",
        },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) return json({ error: initJson?.message || "Failed to start payment" }, 400);

    try {
      await supabaseAdmin.from("escrow_transactions").insert({
        reference,
        user_id: user.id,
        total_amount: feeAmount,
        currency: "GHS",
        status: "pending",
        payment_type: "premium_service_subscription",
        related_property_id: property_id,
        metadata: { subscriber_role, billing_frequency: billingFrequency },
      });
    } catch (e) {
      console.warn("premium-checkout escrow insert failed:", (e as Error).message);
    }

    return json({
      reference,
      access_code: initJson.data?.access_code,
      authorization_url: initJson.data?.authorization_url,
      publicKey: PAYSTACK_PUBLIC_KEY,
      amount: feeAmount,
      currency: "GHS",
      email,
      description: `Premium Service (${billingFrequency})`,
    });
  } catch (e: any) {
    console.error("premium-checkout error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

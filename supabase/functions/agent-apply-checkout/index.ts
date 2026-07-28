// Initializes payment for an Agent Application. The application row must
// already exist with status='awaiting_payment' and payment_status='pending'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { application_id } = await req.json();
    if (!application_id) return json({ error: "application_id is required" }, 200);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth is optional — some agents apply before signing in. Try to identify them.
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      const anon = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
      try {
        const { data } = await (anon.auth as any).getClaims(token);
        userId = data?.claims?.sub ?? null;
        userEmail = data?.claims?.email ?? null;
      } catch (_) { /* ignore */ }
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from("agent_applications")
      .select("id, applicant_user_id, email, full_name, payment_status, status")
      .eq("id", application_id)
      .maybeSingle();
    if (appErr) throw appErr;
    if (!app) return json({ error: "Application not found" }, 200);
    if (app.payment_status === "paid") {
      return json({ error: "This application has already been paid for." }, 200);
    }

    // Fee config
    const { data: flag } = await supabaseAdmin
      .from("feature_flags")
      .select("fee_amount, fee_enabled")
      .eq("feature_key", "agent_application_fee")
      .maybeSingle();
    const feeAmount = Number(flag?.fee_amount || 100);
    const feeEnabled = flag?.fee_enabled ?? true;
    if (!feeEnabled || feeAmount <= 0) {
      // Free: mark paid and let admins review.
      await supabaseAdmin
        .from("agent_applications")
        .update({ payment_status: "waived", status: "pending" })
        .eq("id", application_id);
      return json({ waived: true });
    }

    const email = app.email || userEmail;
    if (!email) return json({ error: "An email address is required to check out." }, 200);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const PAYSTACK_PUBLIC_KEY = Deno.env.get("PAYSTACK_PUBLIC_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment gateway not configured" }, 200);

    const reference = `AGENT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

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
          type: "agent_application_fee",
          application_id,
          full_name: app.full_name,
          description: "Agent application fee",
        },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) return json({ error: initJson?.message || "Failed to start payment" }, 200);

    await supabaseAdmin
      .from("agent_applications")
      .update({ payment_reference: reference, payment_amount: feeAmount })
      .eq("id", application_id);

    try {
      await supabaseAdmin.from("escrow_transactions").insert({
        reference,
        user_id: app.applicant_user_id || userId,
        total_amount: feeAmount,
        currency: "GHS",
        status: "pending",
        payment_type: "agent_application_fee",
        metadata: { application_id },
      });
    } catch (e) {
      console.warn("escrow insert failed:", (e as Error).message);
    }

    return json({
      reference,
      access_code: initJson.data?.access_code,
      authorization_url: initJson.data?.authorization_url,
      publicKey: PAYSTACK_PUBLIC_KEY,
      amount: feeAmount,
      currency: "GHS",
      email,
      description: "Agent application fee",
    });
  } catch (e: any) {
    console.error("agent-apply-checkout error:", e?.message);
    return json({ error: e?.message || String(e) }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

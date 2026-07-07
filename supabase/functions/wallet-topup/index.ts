// Initializes a Paystack transaction that credits the user's own wallet
// (or another user's wallet when funding a payment link). Uses the branded
// in-app checkout — the front-end never sees the processor name.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      amount, // GHS major units
      recipient_user_id, // wallet owner to credit — defaults to caller
      payer_email,
      description,
      payment_link_id,
    } = body || {};

    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
      return json({ error: "amount is required" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Try to identify the caller for their own top-up.
    let callerId: string | null = null;
    let callerEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      callerId = user?.id ?? null;
      callerEmail = user?.email ?? null;
    }

    const recipientId = recipient_user_id || callerId;
    if (!recipientId) return json({ error: "recipient_user_id required for anonymous top-ups" }, 400);

    const email = payer_email || callerEmail;
    if (!email) return json({ error: "payer_email is required" }, 400);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const PAYSTACK_PUBLIC_KEY = Deno.env.get("PAYSTACK_PUBLIC_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment gateway not configured" }, 500);

    const reference = `WTOP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

    // Initialize with Paystack
    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(Number(amount) * 100),
        currency: "GHS",
        reference,
        metadata: {
          type: "wallet_topup",
          recipient_user_id: recipientId,
          payment_link_id: payment_link_id || null,
          description: description || "Wallet top-up",
        },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) {
      return json({ error: initJson?.message || "Failed to initialize payment" }, 400);
    }

    // Record an escrow_transactions row so verify-payment / audit tooling
    // recognises it, tagged as a wallet top-up.
    try {
      await supabaseAdmin.from("escrow_transactions").insert({
        reference,
        user_id: recipientId,
        amount: Number(amount),
        currency: "GHS",
        status: "pending",
        transaction_type: "wallet_topup",
        metadata: {
          payment_link_id: payment_link_id || null,
          payer_email: email,
          description: description || "Wallet top-up",
        },
      });
    } catch (e) {
      console.warn("wallet-topup: escrow insert failed (non-fatal):", (e as Error).message);
    }

    return json({
      reference,
      access_code: initJson.data?.access_code,
      authorization_url: initJson.data?.authorization_url,
      publicKey: PAYSTACK_PUBLIC_KEY,
      amount: Number(amount),
      currency: "GHS",
      email,
      description: description || "Wallet top-up",
    });
  } catch (e: any) {
    console.error("wallet-topup error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

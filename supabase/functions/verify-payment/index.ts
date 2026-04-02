import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { finalizePayment } from "../_shared/finalize-payment.ts";

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
    // Parse reference
    let reference: string;
    const url = new URL(req.url);
    if (req.method === "POST") {
      const body = await req.json();
      reference = body.reference || url.searchParams.get("reference") || "";
    } else {
      reference = url.searchParams.get("reference") || "";
    }
    if (!reference) throw new Error("reference is required");

    // Optional auth check
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

    // Check escrow exists
    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, user_id")
      .eq("reference", reference)
      .maybeSingle();

    if (!escrow) throw new Error("Transaction not found");
    if (userId && escrow.user_id !== userId) throw new Error("Unauthorized");

    // Already completed — run finalize anyway to fill any missing splits/receipts/payouts
    if (escrow.status === "completed") {
      // Still call finalize to ensure splits, receipts, and payouts exist (idempotent)
      await finalizePayment({ supabaseAdmin, reference, amountPaid: 0, transactionId: "", logError });
      return new Response(JSON.stringify({ verified: true, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify with Paystack API
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

    // Payment verified — run shared finalization pipeline
    const amountPaid = (paystackData.data.amount || 0) / 100;
    const transactionId = String(paystackData.data.id || "");

    const result = await finalizePayment({ supabaseAdmin, reference, amountPaid, transactionId, logError });

    return new Response(JSON.stringify(result), {
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

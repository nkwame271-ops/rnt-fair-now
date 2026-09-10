// Safety net for payments whose browser never came back (window closed, phone
// died, network dropped). Re-checks every transaction still pending after a few
// minutes with the processor and finalises it when the money actually arrived.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { finalizePayment } from "../_shared/finalize-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_AGE_MINUTES = 10;
const MAX_AGE_HOURS = 48;
const BATCH = 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logError = async (opts: {
    escrow_transaction_id?: string;
    reference?: string;
    error_stage: string;
    error_message: string;
    error_context?: Record<string, unknown>;
    severity?: string;
  }) => {
    try {
      await supabaseAdmin.from("payment_processing_errors").insert({
        function_name: "sweep-pending-payments",
        severity: "warning",
        ...opts,
      });
    } catch (e) {
      console.error("Failed to log error:", e);
    }
  };

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const now = Date.now();
    const notAfter = new Date(now - MIN_AGE_MINUTES * 60_000).toISOString();
    const notBefore = new Date(now - MAX_AGE_HOURS * 3_600_000).toISOString();

    const { data: pending, error } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, reference, status, total_amount, created_at")
      .eq("status", "pending")
      .lt("created_at", notAfter)
      .gt("created_at", notBefore)
      .order("created_at", { ascending: false })
      .limit(BATCH);
    if (error) throw error;

    let checked = 0;
    let completed = 0;
    let abandoned = 0;

    for (const tx of pending || []) {
      checked++;
      try {
        const res = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(tx.reference)}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
        );
        const body = await res.json();
        const status = body?.data?.status || "not_found";

        if (body?.status && status === "success") {
          await finalizePayment({
            supabaseAdmin,
            reference: tx.reference,
            amountPaid: (body.data.amount || 0) / 100,
            transactionId: String(body.data.id || ""),
            logError,
          });
          completed++;
          continue;
        }

        // Not paid. Abandoned/failed attempts are retries the payer already
        // replaced with a newer session — close them so dashboards stay clean.
        if (["abandoned", "failed", "reversed"].includes(status)) {
          await supabaseAdmin
            .from("escrow_transactions")
            .update({ status: "failed" })
            .eq("id", tx.id)
            .eq("status", "pending");
          abandoned++;
        }
      } catch (e) {
        await logError({
          reference: tx.reference,
          escrow_transaction_id: tx.id,
          error_stage: "sweep_verify",
          error_message: (e as Error).message || String(e),
        });
      }
    }

    const summary = { checked, completed, abandoned };
    console.log("sweep-pending-payments:", JSON.stringify(summary));
    return new Response(JSON.stringify({ ok: true, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = (e as Error).message || String(e);
    console.error("sweep-pending-payments error:", message);
    await logError({ error_stage: "top_level", error_message: message, severity: "critical" });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

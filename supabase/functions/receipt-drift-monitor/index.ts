import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { finalizePayment } from "../_shared/finalize-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const logError = async (opts: any) => {
    try {
      await supabaseAdmin.from("payment_processing_errors").insert(opts);
    } catch (_e) { /* best-effort */ }
  };

  const result = {
    checked_at: new Date().toISOString(),
    repaired_escrows: 0,
    repaired_case_payments: 0,
    repaired_reconciliations: 0,
    failures_logged: 0,
    drift: null as any,
  };

  // 1. Paid escrows older than 5 min with no receipt → re-run finalize
  const { data: orphanEscrows } = await supabaseAdmin
    .from("escrow_transactions")
    .select("id, reference, amount, paystack_reference")
    .in("status", ["success", "completed", "paid"])
    .lt("created_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(50);

  for (const esc of orphanEscrows ?? []) {
    const { data: existing } = await supabaseAdmin
      .from("payment_receipts")
      .select("id")
      .eq("escrow_transaction_id", esc.id)
      .maybeSingle();
    if (existing) continue;
    try {
      await finalizePayment({
        supabaseAdmin,
        reference: esc.reference,
        amountPaid: Number(esc.amount),
        transactionId: esc.paystack_reference ?? esc.reference,
        logError,
      });
      result.repaired_escrows += 1;
      await supabaseAdmin
        .from("receipt_generation_failures")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolution_notes: "Auto-healed by receipt-drift-monitor",
        })
        .eq("escrow_transaction_id", esc.id)
        .eq("resolved", false);
    } catch (e: any) {
      result.failures_logged += 1;
      await supabaseAdmin.from("receipt_generation_failures").insert({
        escrow_transaction_id: esc.id,
        payment_reference: esc.reference,
        failure_stage: "drift_monitor_finalize",
        failure_reason: e?.message ?? String(e),
      });
    }
  }

  // 2. Paid case_payments missing receipt_number → relink
  const { data: missingNum } = await supabaseAdmin
    .from("case_payments")
    .select("id, payment_reference")
    .eq("payment_status", "paid")
    .is("receipt_number", null)
    .lt("paid_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(100);

  for (const cp of missingNum ?? []) {
    const { data: rcpt } = await supabaseAdmin
      .from("payment_receipts")
      .select("receipt_number")
      .eq("platform_reference", cp.payment_reference)
      .maybeSingle();
    if (rcpt?.receipt_number) {
      await supabaseAdmin
        .from("case_payments")
        .update({ receipt_number: rcpt.receipt_number })
        .eq("id", cp.id);
      result.repaired_case_payments += 1;
    }
  }

  // 3. Unreconciled paid payments → re-run reconciliation RPC
  const { data: unreconciled } = await supabaseAdmin
    .from("case_payments")
    .select("payment_reference")
    .eq("payment_status", "paid")
    .neq("reconciliation_status", "reconciled")
    .lt("paid_at", new Date(Date.now() - 5 * 60_000).toISOString())
    .limit(100);

  for (const cp of unreconciled ?? []) {
    const { error } = await supabaseAdmin.rpc("reconcile_case_payment", {
      p_payment_reference: cp.payment_reference,
      p_actor: null,
      p_notes: "Auto-reconciled by receipt-drift-monitor",
    });
    if (!error) result.repaired_reconciliations += 1;
  }

  // 4. Snapshot of post-repair drift
  const { data: drift } = await supabaseAdmin.rpc("detect_receipt_drift");
  result.drift = drift;

  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});

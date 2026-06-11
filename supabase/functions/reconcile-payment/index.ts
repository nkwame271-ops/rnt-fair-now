import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { finalizePayment } from "../_shared/finalize-payment.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Payment Reconciliation & Recovery
 *
 * Admin posts a Paystack reference (or platform reference). The function:
 *  1. Verifies admin permission (has_payment_permission "reconcile_payment").
 *  2. Calls Paystack /transaction/verify to confirm the charge is genuinely SUCCESS.
 *  3. Looks up the platform escrow_transactions row by reference.
 *  4. Runs the shared idempotent finalizePayment pipeline (splits + receipts + payouts).
 *  5. Upserts a payment_fulfillments row keyed on paystack_reference (idempotency layer).
 *  6. Writes an entry to payment_reconciliation_audit_log.
 *
 * Actions:
 *  - dry_run     : verify only (no DB write)
 *  - reconcile   : run the full pipeline
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const logError = async (opts: any) => {
    try {
      await supabaseAdmin.from("payment_processing_errors").insert({
        function_name: "reconcile-payment",
        severity: "warning",
        ...opts,
      });
    } catch (e) { console.error("Failed to log error:", e); }
  };

  const audit = async (row: any) => {
    try {
      await supabaseAdmin.from("payment_reconciliation_audit_log").insert(row);
    } catch (e) { console.error("Failed to write audit log:", e); }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    // Permission gate
    const { data: canReconcile } = await supabaseAdmin
      .rpc("has_payment_permission", { _user_id: user.id, _perm: "reconcile_payment" });
    if (!canReconcile) throw new Error("Forbidden — reconcile_payment permission required");

    const body = await req.json();
    const action: string = body.action || "reconcile";
    const reference: string = (body.reference || body.paystack_reference || "").trim();
    const officerId: string | null = body.officer_id || null;
    const notes: string = body.notes || "";

    if (!reference) throw new Error("reference is required");

    // 1. Verify with Paystack
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const psData = await psRes.json();
    const psStatus = psData?.data?.status;

    if (!psData?.status || psStatus !== "success") {
      await audit({
        actor_type: "admin",
        actor_id: user.id,
        action: "verify_failed",
        paystack_reference: reference,
        new_status: psStatus || "not_found",
        failure_reason: psData?.message || "Paystack reports not-success",
        notes,
      });
      return new Response(JSON.stringify({
        verified: false,
        paystack_status: psStatus || "not_found",
        message: psData?.message || "Paystack did not confirm a successful charge",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const amountPaid = (psData.data.amount || 0) / 100;
    const paystackTxId = String(psData.data.id || "");
    const paystackFee = (psData.data.fees || 0) / 100;
    const customerEmail = psData.data?.customer?.email || null;
    const paidAt = psData.data?.paid_at ? new Date(psData.data.paid_at).toISOString() : null;

    if (action === "dry_run") {
      // Find escrow without mutating anything
      const { data: existingEscrow } = await supabaseAdmin
        .from("escrow_transactions")
        .select("id, status, payment_type, total_amount, user_id, office_id, reference")
        .eq("reference", reference)
        .maybeSingle();

      const { data: existingReceipt } = await supabaseAdmin
        .from("payment_receipts")
        .select("id, receipt_number, receipt_status")
        .or(`platform_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .maybeSingle();

      const { data: existingFulfillment } = await supabaseAdmin
        .from("payment_fulfillments")
        .select("id, fulfillment_status, fulfilled_at")
        .eq("paystack_reference", reference)
        .maybeSingle();

      await audit({
        actor_type: "admin",
        actor_id: user.id,
        action: "dry_run",
        paystack_reference: reference,
        platform_reference: existingEscrow?.reference || reference,
        amount: amountPaid,
        new_status: "verified",
        notes,
      });

      return new Response(JSON.stringify({
        verified: true,
        paystack: {
          amount: amountPaid,
          fee: paystackFee,
          transaction_id: paystackTxId,
          paid_at: paidAt,
          customer_email: customerEmail,
        },
        escrow: existingEscrow,
        receipt: existingReceipt,
        fulfillment: existingFulfillment,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Resolve escrow_transactions row
    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, payment_type, total_amount, user_id, office_id, reference")
      .eq("reference", reference)
      .maybeSingle();

    if (!escrow) {
      await audit({
        actor_type: "admin",
        actor_id: user.id,
        action: "reconcile_failed",
        paystack_reference: reference,
        failure_reason: "No escrow_transactions row found for this reference",
        amount: amountPaid,
        notes,
      });
      throw new Error("No platform transaction found for this Paystack reference. The user may not have initiated the checkout against this app.");
    }

    // 2b. IDEMPOTENCY — if this Paystack reference has already been fulfilled/reconciled,
    //     block any further reconciliation. One payment = one reconciliation = one ledger = one receipt.
    const { data: priorFulfillment } = await supabaseAdmin
      .from("payment_fulfillments")
      .select("id, fulfillment_status, fulfilled_at, fulfilled_via, officer_id, receipt_id, metadata")
      .eq("paystack_reference", reference)
      .in("fulfillment_status", ["fulfilled", "completed", "manually_reconciled", "success"])
      .maybeSingle();

    if (priorFulfillment) {
      const { data: priorReceipt } = await supabaseAdmin
        .from("payment_receipts")
        .select("id, receipt_number")
        .or(`platform_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .maybeSingle();

      await audit({
        actor_type: "admin",
        actor_id: user.id,
        action: "idempotent_skip",
        paystack_reference: reference,
        platform_reference: escrow.reference,
        payment_fulfillment_id: priorFulfillment.id,
        office_id: escrow.office_id || null,
        service_type: escrow.payment_type,
        old_status: escrow.status,
        new_status: priorFulfillment.fulfillment_status,
        amount: amountPaid,
        failure_reason: "Transaction already reconciled — idempotency block",
        notes,
      });

      return new Response(JSON.stringify({
        success: false,
        already_reconciled: true,
        message: "This transaction has already been reconciled. No further reconciliation is allowed.",
        fulfillment: priorFulfillment,
        receipt: priorReceipt || null,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Run shared finalize pipeline (idempotent)
    const result = await finalizePayment({
      supabaseAdmin,
      reference,
      amountPaid,
      transactionId: paystackTxId,
      logError,
    });

    // 4. Upsert payment_fulfillments (idempotency layer)
    //    Unique on paystack_reference — a second attempt silently no-ops via onConflict.
    const fulfillmentRow: any = {
      escrow_transaction_id: escrow.id,
      user_id: escrow.user_id,
      office_id: officerId ? escrow.office_id : escrow.office_id,
      officer_id: officerId,
      service_type: escrow.payment_type,
      platform_reference: escrow.reference,
      paystack_reference: reference,
      paystack_transaction_id: paystackTxId,
      expected_amount: Number(escrow.total_amount || 0),
      paid_amount: amountPaid,
      gross_amount: amountPaid,
      paystack_fee: paystackFee,
      net_amount: +(amountPaid - paystackFee).toFixed(2),
      fulfillment_status: "manually_reconciled",
      fulfilled_via: "admin",
      fulfilled_at: new Date().toISOString(),
      notes,
      allocation_summary: (result as any)?.allocation || {},
      metadata: { reconciled_by: user.id, paystack_paid_at: paidAt, customer_email: customerEmail },
    };

    // Try upsert — payment_fulfillments_paystack_reference_key is the unique index
    const { data: fulfillment, error: fErr } = await supabaseAdmin
      .from("payment_fulfillments")
      .upsert(fulfillmentRow, { onConflict: "paystack_reference" })
      .select("id")
      .single();

    if (fErr) {
      console.error("Fulfillment upsert error:", fErr);
      await logError({
        escrow_transaction_id: escrow.id,
        reference,
        error_stage: "fulfillment_upsert",
        error_message: fErr.message,
        severity: "warning",
      });
    }

    // 5. Link receipt → fulfillment (if a receipt now exists)
    if (fulfillment?.id) {
      const { data: receipt } = await supabaseAdmin
        .from("payment_receipts")
        .select("id")
        .or(`platform_reference.eq.${reference},paystack_reference.eq.${reference}`)
        .maybeSingle();
      if (receipt?.id) {
        await supabaseAdmin
          .from("payment_fulfillments")
          .update({
            receipt_id: receipt.id,
          })
          .eq("id", fulfillment.id);
        // Tag the receipt itself
        await supabaseAdmin
          .from("payment_receipts")
          .update({
            paystack_reference: reference,
            platform_reference: escrow.reference,
            receipt_status: "manually_reconciled",
            reconciliation_date: new Date().toISOString(),
            generated_by_type: "admin",
            generated_by_admin_id: user.id,
            reconciliation_notes: notes,
            officer_id: officerId,
          })
          .eq("id", receipt.id);
      }
    }

    // 6. Audit log
    await audit({
      actor_type: "admin",
      actor_id: user.id,
      action: "reconcile_success",
      paystack_reference: reference,
      platform_reference: escrow.reference,
      payment_fulfillment_id: fulfillment?.id || null,
      office_id: escrow.office_id || null,
      officer_id: officerId,
      service_type: escrow.payment_type,
      old_status: escrow.status,
      new_status: "completed",
      amount: amountPaid,
      allocation_summary: (result as any)?.allocation || {},
      notes,
    });

    return new Response(JSON.stringify({
      success: true,
      reconciled: true,
      escrow_id: escrow.id,
      fulfillment_id: fulfillment?.id || null,
      pipeline_result: result,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("reconcile-payment error:", error.message);
    await logError({
      error_stage: "top_level",
      error_message: error.message || String(error),
      severity: "critical",
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

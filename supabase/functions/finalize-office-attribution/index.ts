import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Finalize-Office-Attribution
 *
 * Re-tags previously deferred admin (office-share) ledger rows with the
 * resolved office_id and flips their status to "pending_transfer". Then,
 * if auto-release is on and a Paystack recipient exists, dispatches the
 * office payout.
 *
 * IMPORTANT: This function does NOT recompute amounts and does NOT create
 * an HQ row. The HQ share row was already posted by finalize-payment.ts at
 * verification time using the secondary-split configuration. Re-applying the
 * percentage here would double-count the admin bucket.
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const { data: adminStaff } = await adminClient
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", user.id)
      .single();

    if (!adminStaff) throw new Error("Only admin staff can perform this action");

    const { escrow_transaction_id, office_id } = await req.json();
    if (!escrow_transaction_id || !office_id) {
      throw new Error("Missing required fields: escrow_transaction_id, office_id");
    }

    // Find deferred admin splits for this escrow (these are the office shares
    // that were waiting for an office assignment). We only touch ACTIVE rows;
    // superseded rows are historical and must never be re-tagged.
    // We do NOT touch admin_hq rows — those were already posted to HQ at
    // finalize-payment time.
    const { data: deferredSplits } = await adminClient
      .from("escrow_splits")
      .select("id, recipient, amount, disbursement_status, description")
      .eq("escrow_transaction_id", escrow_transaction_id)
      .eq("recipient", "admin")
      .eq("status", "active")
      .eq("disbursement_status", "deferred");

    if (!deferredSplits || deferredSplits.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No deferred splits to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const officeSplitIds: string[] = [];
    let totalOfficeAmount = 0;

    // Re-tag each deferred row — keep amount, attach office, unblock payout, mark ready
    for (const split of deferredSplits) {
      const splitAmount = Number(split.amount);
      await adminClient
        .from("escrow_splits")
        .update({ office_id, disbursement_status: "pending_transfer", payout_readiness: "ready" })
        .eq("id", split.id);
      officeSplitIds.push(split.id);
      totalOfficeAmount += splitAmount;
    }

    // Update parent escrow_transaction and receipt office_id
    await adminClient
      .from("escrow_transactions")
      .update({ office_id })
      .eq("id", escrow_transaction_id);

    await adminClient
      .from("payment_receipts")
      .update({ office_id })
      .eq("escrow_transaction_id", escrow_transaction_id);

    // Check office payout mode
    let autoRelease = false;
    try {
      const { data: flag } = await adminClient
        .from("feature_flags")
        .select("is_enabled")
        .eq("feature_key", "office_payout_mode")
        .single();
      autoRelease = flag?.is_enabled ?? false;
    } catch {}

    // Look up office payout account for office share
    const { data: officeAccount } = await adminClient
      .from("office_payout_accounts")
      .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
      .eq("office_id", office_id)
      .single();

    const recipientCode = officeAccount?.paystack_recipient_code || null;
    const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");

    // Process office share payout
    if (autoRelease && recipientCode && PAYSTACK_SK && totalOfficeAmount > 0) {
      const payoutRef = `deferred_${escrow_transaction_id.slice(0, 8)}_${Date.now()}`;

      try {
        const tRes = await fetch("https://api.paystack.co/transfer", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            source: "balance",
            amount: Math.round(totalOfficeAmount * 100),
            recipient: recipientCode,
            reason: "Office share (deferred attribution)",
            reference: payoutRef,
            currency: "GHS",
          }),
        });
        const tData = await tRes.json();

        await adminClient.from("payout_transfers").insert({
          escrow_split_id: officeSplitIds[0] || null,
          escrow_transaction_id,
          recipient_type: "office",
          recipient_code: recipientCode,
          transfer_code: tData.data?.transfer_code || null,
          amount: totalOfficeAmount,
          status: tData.status ? "pending" : "failed",
          paystack_reference: payoutRef,
          failure_reason: tData.status ? null : (tData.message || "Transfer failed"),
        });

        if (tData.status && officeSplitIds.length > 0) {
          await adminClient
            .from("escrow_splits")
            .update({
              disbursement_status: "released",
              released_at: new Date().toISOString(),
              payout_readiness: "released",
            })
            .in("id", officeSplitIds);
        }
      } catch (e: any) {
        await adminClient.from("payout_transfers").insert({
          escrow_split_id: officeSplitIds[0] || null,
          escrow_transaction_id,
          recipient_type: "office",
          recipient_code: recipientCode,
          amount: totalOfficeAmount,
          status: "failed",
          paystack_reference: `deferred_err_${Date.now()}`,
          failure_reason: e.message || "Transfer error",
        });
      }
    } else if (totalOfficeAmount > 0) {
      await adminClient.from("payment_processing_errors").insert({
        escrow_transaction_id,
        reference: `deferred_${escrow_transaction_id.slice(0, 8)}`,
        function_name: "finalize-office-attribution",
        error_stage: "recipient_lookup",
        error_message: `Office ${office_id} has no paystack_recipient_code configured. Payout of GH₵ ${totalOfficeAmount.toFixed(2)} left pending.`,
        severity: "warning",
        error_context: { office_id, amount: totalOfficeAmount, auto_release: autoRelease },
      });

      if (autoRelease) {
        await adminClient.from("office_fund_requests").insert({
          office_id,
          amount: totalOfficeAmount,
          purpose: "Deferred office attribution — auto-release pending recipient setup",
          requested_by: user.id,
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: "Auto-approved (deferred attribution). No recipient code — manual payout needed.",
          payout_reference: `deferred_auto_${escrow_transaction_id.slice(0, 8)}_${Date.now()}`,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      attributed_splits: deferredSplits.length,
      office_id,
      office_amount: totalOfficeAmount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("finalize-office-attribution error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Load secondary split config for a parent recipient */
async function loadSecondarySplits(client: any, parentRecipient: string) {
  try {
    const { data } = await client
      .from("secondary_split_configurations")
      .select("sub_recipient, percentage, description")
      .eq("parent_recipient", parentRecipient);
    return data || [];
  } catch {
    return [];
  }
}

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

    // Load secondary split config
    const secondarySplits = await loadSecondarySplits(adminClient, "admin");
    const officePct = secondarySplits.find((s: any) => s.sub_recipient === "office")?.percentage ?? 0;
    const hqPct = secondarySplits.find((s: any) => s.sub_recipient === "headquarters")?.percentage ?? 100;

    // Find deferred admin splits for this escrow
    const { data: deferredSplits } = await adminClient
      .from("escrow_splits")
      .select("id, recipient, amount, disbursement_status, description")
      .eq("escrow_transaction_id", escrow_transaction_id)
      .eq("recipient", "admin")
      .eq("disbursement_status", "deferred");

    if (!deferredSplits || deferredSplits.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No deferred splits to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const allNewSplitIds: string[] = [];
    const officeSplitIds: string[] = [];
    let totalOfficeAmount = 0;

    for (const split of deferredSplits) {
      const splitAmount = Number(split.amount);

      if (secondarySplits.length === 0 || (officePct + hqPct === 0)) {
        // No secondary config — legacy: full amount to office
        await adminClient
          .from("escrow_splits")
          .update({ office_id, disbursement_status: "pending_transfer" })
          .eq("id", split.id);
        officeSplitIds.push(split.id);
        totalOfficeAmount += splitAmount;
      } else {
        // Sub-split the deferred amount per secondary config
        const officeAmount = +(splitAmount * officePct / 100).toFixed(2);
        const hqAmount = +(splitAmount * hqPct / 100).toFixed(2);

        if (officePct > 0 && officeAmount > 0) {
          // Update original split to be the office portion
          await adminClient
            .from("escrow_splits")
            .update({
              amount: officeAmount,
              office_id,
              disbursement_status: "pending_transfer",
              description: (split.description || "Admin charge") + " (office share)",
            })
            .eq("id", split.id);
          officeSplitIds.push(split.id);
          totalOfficeAmount += officeAmount;
        } else {
          // Office gets 0% — mark this split as released (nothing for office)
          await adminClient
            .from("escrow_splits")
            .update({
              disbursement_status: "released",
              released_at: new Date().toISOString(),
              description: (split.description || "Admin charge") + " (no office share)",
              office_id: null,
              amount: 0,
            })
            .eq("id", split.id);
        }

        if (hqPct > 0 && hqAmount > 0) {
          // Create a new split for HQ's share
          const { data: newSplit } = await adminClient
            .from("escrow_splits")
            .insert({
              escrow_transaction_id,
              recipient: "admin_hq",
              amount: hqAmount,
              description: (split.description || "Admin charge") + " (HQ share)",
              disbursement_status: "pending_transfer",
              released_at: null,
              office_id: null,
              release_mode: "auto",
            })
            .select("id")
            .single();
          if (newSplit) allNewSplitIds.push(newSplit.id);
        }
      }
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
            .update({ disbursement_status: "released", released_at: new Date().toISOString() })
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
        error_context: { office_id, amount: totalOfficeAmount, auto_release: autoRelease, office_pct: officePct },
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

    // Process HQ share payout (admin_hq splits)
    if (PAYSTACK_SK && allNewSplitIds.length > 0) {
      const { data: hqSplits } = await adminClient
        .from("escrow_splits")
        .select("id, amount")
        .in("id", allNewSplitIds);

      if (hqSplits && hqSplits.length > 0) {
        const totalHqAmount = hqSplits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
        if (totalHqAmount > 0) {
          // Look up system admin settlement account
          const { data: adminAccount } = await adminClient
            .from("system_settlement_accounts")
            .select("paystack_recipient_code")
            .eq("account_type", "admin")
            .single();

          const hqRecipientCode = adminAccount?.paystack_recipient_code || null;
          const hqPayoutRef = `deferred_hq_${escrow_transaction_id.slice(0, 8)}_${Date.now()}`;

          if (hqRecipientCode) {
            try {
              const tRes = await fetch("https://api.paystack.co/transfer", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  source: "balance",
                  amount: Math.round(totalHqAmount * 100),
                  recipient: hqRecipientCode,
                  reason: "Admin HQ share (deferred attribution)",
                  reference: hqPayoutRef,
                  currency: "GHS",
                }),
              });
              const tData = await tRes.json();

              await adminClient.from("payout_transfers").insert({
                escrow_split_id: allNewSplitIds[0],
                escrow_transaction_id,
                recipient_type: "admin",
                recipient_code: hqRecipientCode,
                transfer_code: tData.data?.transfer_code || null,
                amount: totalHqAmount,
                status: tData.status ? "pending" : "failed",
                paystack_reference: hqPayoutRef,
                failure_reason: tData.status ? null : (tData.message || "Transfer failed"),
              });

              if (tData.status) {
                await adminClient
                  .from("escrow_splits")
                  .update({ disbursement_status: "released", released_at: new Date().toISOString() })
                  .in("id", allNewSplitIds);
              }
            } catch (e: any) {
              await adminClient.from("payout_transfers").insert({
                escrow_split_id: allNewSplitIds[0],
                escrow_transaction_id,
                recipient_type: "admin",
                recipient_code: hqRecipientCode,
                amount: totalHqAmount,
                status: "failed",
                paystack_reference: `deferred_hq_err_${Date.now()}`,
                failure_reason: e.message || "Transfer error",
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      attributed_splits: deferredSplits.length,
      office_id,
      office_pct: officePct,
      hq_pct: hqPct,
      office_amount: totalOfficeAmount,
      hq_splits_created: allNewSplitIds.length,
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

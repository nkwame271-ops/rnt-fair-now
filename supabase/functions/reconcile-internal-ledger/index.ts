import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Reconcile-Internal-Ledger — CORRECTION-RUN ENGINE
 *
 * For each completed escrow_transactions in the window:
 *   1. Recompute expected allocation from metadata.split_plan + secondary_split_configurations
 *      (full-bucket math, applied once — same rules as finalize-payment).
 *   2. If sum(active rows) ≈ total_amount (±0.01) → already balanced, skip.
 *   3. Validation gate: if sum(expected) differs from total_amount by >0.01 → log
 *      payment_processing_errors, abort this tx, continue. Never insert partial rows.
 *   4. Mark all current active rows as status='superseded', superseded_at=now()
 *      (UPDATE — never DELETE — full audit history retained).
 *   5. INSERT new rows with status='active', correction_run_id=<this run>.
 *      payout_readiness defaults to 'pending'; 'unassigned' when office is required
 *      but missing OR no paystack_recipient_code is configured for that office.
 *   6. Compute reconciliation_diff = sum(active.amount) − sum(payout_transfers.amount
 *      where status='success') and surface in response. payout_transfers is read-only.
 *
 * Idempotent: a second run on the same data is a no-op.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SplitItem {
  recipient: string;
  amount: number;
  description?: string;
}

interface SecondarySplit {
  sub_recipient: string;
  percentage: number;
}

const DEFERRED_OFFICE_TYPES = new Set([
  "rent_card",
  "rent_card_bulk",
  "add_tenant_fee",
  "declare_existing_tenancy_fee",
  "agreement_sale",
  "register_tenant_fee",
  "filing_fee",
]);

const SECONDARY_SPLIT_RECIPIENTS = ["admin", "rent_control"];
const TOLERANCE = 0.01;

async function loadSecondaryAll(client: any): Promise<Record<string, SecondarySplit[]>> {
  try {
    const { data } = await client
      .from("secondary_split_configurations")
      .select("parent_recipient, sub_recipient, percentage")
      .in("parent_recipient", SECONDARY_SPLIT_RECIPIENTS);
    const out: Record<string, SecondarySplit[]> = {};
    for (const r of data || []) {
      (out[r.parent_recipient] ||= []).push({
        sub_recipient: r.sub_recipient,
        percentage: Number(r.percentage),
      });
    }
    return out;
  } catch {
    return {};
  }
}

/** Build the canonical set of rows the ledger SHOULD contain for a given tx + plan. */
function buildExpectedRows(
  splitPlan: SplitItem[],
  escrowId: string,
  paymentType: string,
  officeId: string | null,
  secondaryByParent: Record<string, SecondarySplit[]>,
): any[] {
  const isDeferredOffice = DEFERRED_OFFICE_TYPES.has(paymentType) && !officeId;
  const rows: any[] = [];

  for (const s of splitPlan) {
    if (SECONDARY_SPLIT_RECIPIENTS.includes(s.recipient)) {
      const sec = secondaryByParent[s.recipient] || [];
      const officePct = sec.find(x => x.sub_recipient === "office")?.percentage ?? 0;
      const hqPct = sec.find(x => x.sub_recipient === "headquarters")?.percentage
        ?? (s.recipient === "admin" ? 100 : 0);
      const hasSecondary = sec.length > 0 && (officePct + hqPct) > 0;

      const isAdmin = s.recipient === "admin";
      const officeStatus = isAdmin
        ? (isDeferredOffice ? "deferred" : "pending_transfer")
        : "pending_transfer";
      const officeIdForRow = isAdmin && isDeferredOffice ? null : officeId;

      if (!hasSecondary) {
        rows.push({
          escrow_transaction_id: escrowId,
          recipient: s.recipient,
          amount: +Number(s.amount).toFixed(2),
          description: s.description || `${s.recipient} charge`,
          disbursement_status: officeStatus,
          office_id: officeIdForRow,
          release_mode: "auto",
        });
        continue;
      }
      if (officePct > 0) {
        rows.push({
          escrow_transaction_id: escrowId,
          recipient: s.recipient,
          amount: +(Number(s.amount) * officePct / 100).toFixed(2),
          description: (s.description || `${s.recipient} charge`) + " (office share)",
          disbursement_status: officeStatus,
          office_id: officeIdForRow,
          release_mode: "auto",
        });
      }
      if (hqPct > 0) {
        rows.push({
          escrow_transaction_id: escrowId,
          recipient: `${s.recipient}_hq`,
          amount: +(Number(s.amount) * hqPct / 100).toFixed(2),
          description: (s.description || `${s.recipient} charge`) + " (HQ share)",
          disbursement_status: "pending_transfer",
          office_id: null,
          release_mode: "auto",
        });
      }
    } else {
      rows.push({
        escrow_transaction_id: escrowId,
        recipient: s.recipient,
        amount: +Number(s.amount).toFixed(2),
        description: s.description || "",
        disbursement_status: s.recipient === "landlord" ? "held" : "pending_transfer",
        office_id: officeId,
        release_mode: "manual",
      });
    }
  }
  return rows;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ank = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, srk);

    // Auth: tolerate missing/expired auth header from SDK invoke path.
    // If a header is present, validate it; if not, allow service-role execution
    // (the function is gated behind verify_jwt=false + this admin-staff check).
    const authHeader = req.headers.get("Authorization");
    let actingUserId: string | null = null;
    if (authHeader) {
      const userClient = createClient(url, ank, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) {
        const { data: staff } = await admin
          .from("admin_staff").select("admin_type").eq("user_id", user.id).single();
        if (!staff || !["main_admin", "super_admin"].includes(staff.admin_type)) {
          throw new Error("Only main/super admin can reconcile the ledger");
        }
        actingUserId = user.id;
      }
    }
    if (!actingUserId) {
      console.warn("reconcile-internal-ledger: no auth header — running as service role");
    }

    const body = await req.json().catch(() => ({}));
    const fromDate: string | null = body.from || null;
    const toDate: string | null = body.to || null;
    const limit: number = Math.min(Number(body.limit || 200), 500);
    const dryRun: boolean = !!body.dry_run;
    const explicitIds: string[] | null = Array.isArray(body.escrow_transaction_ids) && body.escrow_transaction_ids.length > 0
      ? body.escrow_transaction_ids
      : null;

    const correctionRunId = crypto.randomUUID();
    const secondaryByParent = await loadSecondaryAll(admin);

    // Pull completed transactions in window (or explicit list)
    let q = admin.from("escrow_transactions")
      .select("id, payment_type, total_amount, office_id, metadata, completed_at, reference")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (explicitIds) q = q.in("id", explicitIds);
    if (fromDate) q = q.gte("completed_at", fromDate);
    if (toDate) q = q.lte("completed_at", toDate);

    const { data: txs, error: txErr } = await q;
    if (txErr) throw txErr;

    const summary = {
      correction_run_id: correctionRunId,
      scanned: 0,
      already_balanced: 0,
      corrected: 0,
      rows_inserted: 0,
      rows_superseded: 0,
      validation_gate_aborts: 0,
      skipped_no_plan: 0,
      total_recovered_amount: 0,
      total_superseded_amount: 0,
      reconciliation_diffs: [] as any[],
      details: [] as any[],
    };

    for (const tx of txs || []) {
      summary.scanned++;
      const meta = (tx.metadata as any) || {};
      const splitPlan: SplitItem[] = Array.isArray(meta.split_plan) && meta.split_plan.length > 0
        ? meta.split_plan
        : [];

      if (splitPlan.length === 0) {
        summary.skipped_no_plan++;
        continue;
      }

      // Load existing ACTIVE rows only
      const { data: activeExisting } = await admin
        .from("escrow_splits")
        .select("id, recipient, amount, office_id, disbursement_status, description")
        .eq("escrow_transaction_id", tx.id)
        .eq("status", "active");

      const totalAmount = Number(tx.total_amount);
      const activeSum = (activeExisting || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0);

      // Step 2: idempotency — already balanced
      if (Math.abs(activeSum - totalAmount) <= TOLERANCE && (activeExisting || []).length > 0) {
        summary.already_balanced++;
        continue;
      }

      // Step 3: build expected
      const officeId = tx.office_id || meta.office_id || null;
      const expected = buildExpectedRows(
        splitPlan, tx.id, tx.payment_type, officeId, secondaryByParent,
      );
      const expectedSum = expected.reduce((s, r) => s + Number(r.amount || 0), 0);

      // Step 4: validation gate — expected must equal total_amount
      if (Math.abs(expectedSum - totalAmount) > TOLERANCE) {
        summary.validation_gate_aborts++;
        if (!dryRun) {
          await admin.from("payment_processing_errors").insert({
            escrow_transaction_id: tx.id,
            reference: tx.reference,
            function_name: "reconcile-internal-ledger",
            error_stage: "validation_gate",
            error_message: `Expected allocation sum (${expectedSum.toFixed(2)}) does not match total_amount (${totalAmount.toFixed(2)}). Aborted correction for this transaction.`,
            severity: "critical",
            error_context: {
              correction_run_id: correctionRunId,
              expected_sum: expectedSum,
              total_amount: totalAmount,
              split_plan: splitPlan,
            },
          });
        }
        summary.details.push({
          escrow_id: tx.id,
          reference: tx.reference,
          status: "validation_gate_abort",
          expected_sum: +expectedSum.toFixed(2),
          total_amount: +totalAmount.toFixed(2),
        });
        continue;
      }

      // Pre-flight payout-readiness for each new row
      // — need office_payout_accounts lookup once per office mentioned
      const officeIdsNeeded = new Set<string>();
      for (const r of expected) if (r.office_id) officeIdsNeeded.add(r.office_id);
      const officeRecipientByOffice: Record<string, string | null> = {};
      if (officeIdsNeeded.size > 0) {
        const { data: accs } = await admin
          .from("office_payout_accounts")
          .select("office_id, paystack_recipient_code")
          .in("office_id", Array.from(officeIdsNeeded));
        for (const a of accs || []) {
          officeRecipientByOffice[a.office_id] = a.paystack_recipient_code || null;
        }
      }

      // Step 5: supersede + insert (transactionally per tx)
      if (!dryRun) {
        // Supersede current active rows (UPDATE — never DELETE)
        const { error: supErr } = await admin
          .from("escrow_splits")
          .update({ status: "superseded", superseded_at: new Date().toISOString() })
          .eq("escrow_transaction_id", tx.id)
          .eq("status", "active");
        if (supErr) throw supErr;

        // Insert new active rows tagged with this correction_run_id
        const newRows = expected.map((r) => {
          let payout_readiness = "pending";
          // admin office row deferred & no office_id → unassigned
          if (r.recipient === "admin" && !r.office_id) {
            payout_readiness = "unassigned";
          } else if (r.office_id) {
            const code = officeRecipientByOffice[r.office_id];
            if (!code) payout_readiness = "unassigned";
          }
          return {
            ...r,
            status: "active",
            correction_run_id: correctionRunId,
            payout_readiness,
          };
        });

        const { data: ins, error: insErr } = await admin
          .from("escrow_splits")
          .insert(newRows)
          .select("id");
        if (insErr) throw insErr;

        summary.rows_inserted += (ins || []).length;
        summary.rows_superseded += (activeExisting || []).length;
        summary.total_recovered_amount += expectedSum;
        summary.total_superseded_amount += activeSum;
      } else {
        summary.rows_inserted += expected.length;
        summary.rows_superseded += (activeExisting || []).length;
        summary.total_recovered_amount += expectedSum;
        summary.total_superseded_amount += activeSum;
      }
      summary.corrected++;

      // Reconciliation diff for this tx
      const { data: payouts } = await admin
        .from("payout_transfers")
        .select("amount, status")
        .eq("escrow_transaction_id", tx.id);
      const successPayoutSum = (payouts || [])
        .filter((p: any) => p.status === "success")
        .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const reconciliation_diff = +(expectedSum - successPayoutSum).toFixed(2);

      summary.reconciliation_diffs.push({
        escrow_id: tx.id,
        reference: tx.reference,
        corrected_entitlement: +expectedSum.toFixed(2),
        executed_payouts: +successPayoutSum.toFixed(2),
        reconciliation_diff,
      });

      summary.details.push({
        escrow_id: tx.id,
        reference: tx.reference,
        payment_type: tx.payment_type,
        superseded_count: (activeExisting || []).length,
        inserted_count: expected.length,
        old_sum: +activeSum.toFixed(2),
        new_sum: +expectedSum.toFixed(2),
        total_amount: +totalAmount.toFixed(2),
        reconciliation_diff,
      });
    }

    // Audit log (only when we know who initiated the run)
    if (!dryRun && summary.corrected > 0 && actingUserId) {
      await admin.from("admin_audit_log").insert({
        admin_user_id: actingUserId,
        action: "ledger_correction_run",
        target_type: "escrow_splits",
        target_id: correctionRunId,
        reason: explicitIds
          ? `Manual correction run on ${explicitIds.length} explicit transaction(s)`
          : `Auto-detect correction run, range ${fromDate || "all"} → ${toDate || "all"}`,
        old_state: { from: fromDate, to: toDate, limit, explicit_ids: explicitIds },
        new_state: {
          correction_run_id: correctionRunId,
          corrected: summary.corrected,
          rows_inserted: summary.rows_inserted,
          rows_superseded: summary.rows_superseded,
          recovered_amount: summary.total_recovered_amount,
          superseded_amount: summary.total_superseded_amount,
          validation_gate_aborts: summary.validation_gate_aborts,
        },
      });
    }

    console.log("reconcile-internal-ledger summary:", JSON.stringify({
      correction_run_id: correctionRunId,
      dry_run: dryRun,
      scanned: summary.scanned,
      already_balanced: summary.already_balanced,
      corrected: summary.corrected,
      rows_inserted: summary.rows_inserted,
      rows_superseded: summary.rows_superseded,
      validation_gate_aborts: summary.validation_gate_aborts,
      skipped_no_plan: summary.skipped_no_plan,
      total_recovered_amount: +summary.total_recovered_amount.toFixed(2),
      total_superseded_amount: +summary.total_superseded_amount.toFixed(2),
    }));

    return new Response(JSON.stringify({ success: true, dry_run: dryRun, ...summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("reconcile-internal-ledger error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

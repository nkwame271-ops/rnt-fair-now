import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Reconcile-Internal-Ledger
 *
 * Walks through completed escrow_transactions in a date range and ensures the
 * internal ledger (escrow_splits) accurately reflects the Engine Room rules
 * (primary split_plan from metadata + secondary_split_configurations).
 *
 * Behaviour:
 *  - Only repairs/posts MISSING ledger entries; never deletes existing splits.
 *  - Existing payouts (payout_transfers) are NOT disturbed. We only reconcile
 *    the ledger view (escrow_splits) so totals match actual payments received.
 *  - Unassigned office shares are still POSTED (status = "deferred") so they
 *    appear in totals — never excluded from the ledger.
 *  - Caps the work per call to avoid timeouts (default 200 transactions).
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

// Recipients that may be sub-split office vs HQ via secondary_split_configurations
const SECONDARY_SPLIT_RECIPIENTS = ["admin", "rent_control"];

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

/** Build the canonical set of (recipient, amount, office_id, status) rows
 *  that the ledger SHOULD contain for a given escrow tx + split plan. */
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ank = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, ank, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const admin = createClient(url, srk);
    const { data: staff } = await admin
      .from("admin_staff").select("admin_type").eq("user_id", user.id).single();
    if (!staff || !["main_admin", "super_admin"].includes(staff.admin_type)) {
      throw new Error("Only main/super admin can reconcile the ledger");
    }

    const body = await req.json().catch(() => ({}));
    const fromDate: string | null = body.from || null;
    const toDate: string | null = body.to || null;
    const limit: number = Math.min(Number(body.limit || 200), 500);
    const dryRun: boolean = !!body.dry_run;

    const adminSecondary = await loadSecondary(admin, "admin");

    // Pull completed transactions in window
    let q = admin.from("escrow_transactions")
      .select("id, payment_type, total_amount, office_id, metadata, completed_at, reference")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (fromDate) q = q.gte("completed_at", fromDate);
    if (toDate) q = q.lte("completed_at", toDate);

    const { data: txs, error: txErr } = await q;
    if (txErr) throw txErr;

    const summary = {
      scanned: 0,
      already_balanced: 0,
      repaired: 0,
      rows_inserted: 0,
      skipped_no_plan: 0,
      total_recovered_amount: 0,
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

      // Load existing splits
      const { data: existing } = await admin.from("escrow_splits")
        .select("id, recipient, amount, office_id, disbursement_status")
        .eq("escrow_transaction_id", tx.id);

      const expected = buildExpectedRows(
        splitPlan, tx.id, tx.payment_type, tx.office_id || meta.office_id || null, adminSecondary,
      );

      // Match by recipient signature (recipient + rounded amount). If a row with
      // matching recipient and amount within 0.01 already exists, treat as posted.
      const isMatched = (e: any) =>
        (existing || []).some((er: any) =>
          er.recipient === e.recipient && Math.abs(Number(er.amount) - Number(e.amount)) < 0.01,
        );

      const missing = expected.filter(e => !isMatched(e));

      if (missing.length === 0) {
        summary.already_balanced++;
        continue;
      }

      const recovered = missing.reduce((s, r) => s + Number(r.amount), 0);
      summary.total_recovered_amount += recovered;
      summary.repaired++;
      summary.details.push({
        escrow_id: tx.id,
        reference: tx.reference,
        payment_type: tx.payment_type,
        missing_count: missing.length,
        recovered_amount: +recovered.toFixed(2),
        missing: missing.map(m => ({ recipient: m.recipient, amount: m.amount })),
      });

      if (!dryRun) {
        const { data: inserted } = await admin.from("escrow_splits").insert(missing).select("id");
        summary.rows_inserted += (inserted || []).length;
      }
    }

    // Audit log
    if (!dryRun && summary.repaired > 0) {
      await admin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        action: "reconcile_internal_ledger",
        target_type: "escrow_splits",
        target_id: `range_${fromDate || "all"}_${toDate || "all"}`,
        reason: "Manual ledger reconciliation",
        old_state: { from: fromDate, to: toDate, limit },
        new_state: { repaired: summary.repaired, rows_inserted: summary.rows_inserted, recovered: summary.total_recovered_amount },
      });
    }

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

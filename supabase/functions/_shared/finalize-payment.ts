/**
 * Shared idempotent payment finalization pipeline.
 * Used by both paystack-webhook and verify-payment.
 *
 * Steps:
 * 1. Mark escrow completed (idempotent)
 * 2. Load split_plan from escrow metadata
 * 3. Create escrow_splits if missing
 * 4. Create receipt if missing
 * 5. Create payout_transfers if missing
 * 6. Handle payment-type-specific side effects
 */

import { verifyUrl } from "./project-domain.ts";

// Recipient → system settlement account type mapping
const RECIPIENT_TO_ACCOUNT_TYPE: Record<string, string> = {
  rent_control: "igf",
  rent_control_hq: "igf",   // HQ share of rent_control → IGF settlement account
  admin: "admin",
  admin_hq: "admin",   // HQ share routes to the same system admin settlement account
  platform: "platform",
  gra: "gra",
  // Student revenue recipients — settle directly to their own system accounts.
  igf: "igf",
  nugs: "nugs",
  cm: "cm",
};

// Student-only payment types — bypass office routing and secondary splits entirely.
const STUDENT_PAYMENT_TYPES = new Set(["student_registration", "student_complaint_fee", "rentcare_application_fee", "student_safety_report_fee"]);

// Recipients that may have a secondary split configuration (office vs. HQ).
// When a primary split row is for one of these recipients AND the recipient has
// secondary_split_configurations rows, the amount is sub-divided into:
//   - office share → recipient stays as-is, tagged with office_id
//   - HQ share     → recipient becomes "<recipient>_hq", office_id = null
const SECONDARY_SPLIT_RECIPIENTS = ["admin", "rent_control"];

interface FinalizeOpts {
  supabaseAdmin: any;
  reference: string;
  amountPaid: number;
  transactionId: string;
  logError: (opts: any) => Promise<void>;
}

interface SplitItem {
  recipient: string;
  amount: number;
  description?: string;
  /** When the split row originates from a complaint basket line, propagate to escrow_splits for ledger traceability. */
  complaint_basket_item_id?: string | null;
}

interface SecondarySplit {
  sub_recipient: string;
  percentage: number;
  description?: string;
}

/** Load secondary split config for a parent recipient (e.g. "admin") */
async function loadSecondarySplits(supabaseAdmin: any, parentRecipient: string): Promise<SecondarySplit[]> {
  try {
    const { data } = await supabaseAdmin
      .from("secondary_split_configurations")
      .select("sub_recipient, percentage, description")
      .eq("parent_recipient", parentRecipient);
    return data || [];
  } catch {
    return [];
  }
}

/**
 * Given a single admin split item, expand it into sub-rows based on secondary_split_configurations.
 * Returns an array of split row objects ready for insert.
 */
/**
 * Given a single primary split item whose recipient supports secondary split
 * (admin OR rent_control), expand it into office-share + HQ-share rows based on
 * secondary_split_configurations. Falls back to a single legacy row when no
 * config exists.
 */
function expandSecondarySplit(
  item: SplitItem,
  parentRecipient: string,
  secondarySplits: SecondarySplit[],
  escrowTxId: string,
  officeId: string | null,
  isDeferredOffice: boolean,
  autoRelease: boolean,
): any[] {
  const officePct = secondarySplits.find(s => s.sub_recipient === "office")?.percentage ?? 0;
  const hqPct = secondarySplits.find(s => s.sub_recipient === "headquarters")?.percentage ?? 0;
  const totalPct = officePct + hqPct;

  // Default disbursement status for office-side row (only "admin" supports deferral)
  const computeOfficeDisbStatus = () => {
    if (parentRecipient === "admin") {
      if (isDeferredOffice) return "deferred";
      if (!autoRelease) return "held";
      return "pending_transfer";
    }
    // rent_control / others: just goes straight to pending_transfer at the office (rare)
    return "pending_transfer";
  };
  const officeReleaseMode = (parentRecipient === "admin" && autoRelease) ? "auto" : (parentRecipient === "admin" ? "manual" : "auto");

  // No secondary config → keep legacy behavior: full amount on the parent recipient
  if (secondarySplits.length === 0 || totalPct === 0) {
    // For non-admin parents, just emit a single row tagged to office (legacy)
    if (parentRecipient !== "admin") {
      return [{
        escrow_transaction_id: escrowTxId,
        recipient: parentRecipient,
        amount: +Number(item.amount).toFixed(2),
        description: item.description || "",
        disbursement_status: "pending_transfer",
        released_at: null,
        office_id: officeId,
        release_mode: "auto",
        complaint_basket_item_id: item.complaint_basket_item_id ?? null,
        is_service_fee: false,
      }];
    }
    // Admin legacy path
    return [{
      escrow_transaction_id: escrowTxId,
      recipient: "admin",
      amount: +Number(item.amount).toFixed(2),
      description: item.description || "",
      disbursement_status: computeOfficeDisbStatus(),
      released_at: null,
      office_id: isDeferredOffice ? null : officeId,
      release_mode: officeReleaseMode,
      complaint_basket_item_id: item.complaint_basket_item_id ?? null,
      is_service_fee: false,
    }];
  }

  const rows: any[] = [];

  // Office portion — keep parent recipient name, tag with office
  if (officePct > 0) {
    const officeAmount = +(Number(item.amount) * officePct / 100).toFixed(2);
    rows.push({
      escrow_transaction_id: escrowTxId,
      recipient: parentRecipient,
      amount: officeAmount,
      description: (item.description || `${parentRecipient} charge`) + " (office share)",
      disbursement_status: computeOfficeDisbStatus(),
      released_at: null,
      office_id: (parentRecipient === "admin" && isDeferredOffice) ? null : officeId,
      release_mode: officeReleaseMode,
      complaint_basket_item_id: item.complaint_basket_item_id ?? null,
      is_service_fee: false,
    });
  }

  // HQ portion — new recipient suffix, never deferred, never tied to office
  if (hqPct > 0) {
    const hqAmount = +(Number(item.amount) * hqPct / 100).toFixed(2);
    rows.push({
      escrow_transaction_id: escrowTxId,
      recipient: `${parentRecipient}_hq`,
      amount: hqAmount,
      description: (item.description || `${parentRecipient} charge`) + " (HQ share)",
      disbursement_status: "pending_transfer",
      released_at: null,
      office_id: null,
      release_mode: "auto",
      complaint_basket_item_id: item.complaint_basket_item_id ?? null,
      is_service_fee: false,
    });
  }

  return rows;
}

export async function finalizePayment({ supabaseAdmin, reference, amountPaid, transactionId, logError }: FinalizeOpts): Promise<{ verified: boolean; status: string }> {
  // 0. Concurrency guard — serialize finalize attempts per reference.
  // paystack-webhook, verify-payment, and receipt-drift-monitor can all fire for
  // the same Paystack reference within milliseconds. The advisory lock means
  // only one runs the splits/receipt/payout pipeline; the others see the work
  // already done and exit through the existing idempotent checks below.
  try {
    const { data: gotLock } = await supabaseAdmin.rpc("try_finalize_lock", { p_reference: reference });
    if (gotLock === false) {
      await logError?.({
        reference,
        error_stage: "advisory_lock_busy",
        error_message: "Another finalize attempt holds the lock for this reference; skipping duplicate run.",
        severity: "info",
      });
      return { verified: true, status: "in_progress" };
    }
  } catch (e: any) {
    // Lock acquisition failure is non-fatal — fall through to the idempotent path.
    await logError?.({
      reference,
      error_stage: "advisory_lock_error",
      error_message: e?.message ?? String(e),
      severity: "warning",
    });
  }

  // 1. Find escrow
  const { data: escrow } = await supabaseAdmin
    .from("escrow_transactions")
    .select("id, status, payment_type, user_id, total_amount, related_property_id, related_tenancy_id, related_complaint_id, reference, metadata, office_id, case_id, sales_channel_id")
    .eq("reference", reference)
    .maybeSingle();

  if (!escrow) throw new Error("Transaction not found");

  const escrowId = escrow.id;
  const userId = escrow.user_id;
  const paymentType = escrow.payment_type;
  const meta = (escrow.metadata as any) || {};
  const isStudentRevenue = STUDENT_PAYMENT_TYPES.has(paymentType);
  const officeId = isStudentRevenue ? null : (escrow.office_id || meta.office_id || null);

  // Detect NUGS-tagged split items and flag the parent escrow accordingly.
  const splitPlanPreview = (meta.split_plan as any[] | undefined) || [];
  const hasNugsRevenue = splitPlanPreview.some((s: any) => s?.is_nugs_revenue === true || s?.recipient === "nugs");

  // 2. Mark completed (idempotent — only if still pending)
  if (escrow.status !== "completed") {
    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId, ...(hasNugsRevenue ? { is_nugs_revenue: true } : {}) })
      .eq("id", escrowId)
      .in("status", ["pending", "processing"]);
  }

  // Load secondary splits for all supported parent recipients in one go
  const { data: secondaryAll } = await supabaseAdmin
    .from("secondary_split_configurations")
    .select("parent_recipient, sub_recipient, percentage, description")
    .in("parent_recipient", SECONDARY_SPLIT_RECIPIENTS);
  const secondaryByParent: Record<string, SecondarySplit[]> = {};
  for (const r of secondaryAll || []) {
    (secondaryByParent[r.parent_recipient] ||= []).push({
      sub_recipient: r.sub_recipient,
      percentage: Number(r.percentage),
      description: r.description,
    });
  }
  const adminSecondarySplits = secondaryByParent["admin"] || [];

  // 2b. For bundle types, create child escrow_transactions per fee component
  const BUNDLE_TYPES = ["existing_tenancy_bundle", "add_tenant_fee"];
  if (BUNDLE_TYPES.includes(paymentType) && Array.isArray(meta.fee_components) && meta.fee_components.length > 0) {
    const firstChildRef = `${reference}_${meta.fee_components[0].type}`;
    const { data: existingChildren } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id")
      .eq("reference", firstChildRef)
      .maybeSingle();

    if (!existingChildren) {
      for (const component of meta.fee_components) {
        const childRef = `${reference}_${component.type}`;
        const childSplitPlan = component.allocations || 
          (Array.isArray(meta.split_plan) 
            ? meta.split_plan.filter((s: any) => s.description?.includes(component.type))
            : [{ recipient: "admin", amount: component.amount, description: component.type }]);

        const { data: childTx } = await supabaseAdmin
          .from("escrow_transactions")
          .insert({
            user_id: userId,
            payment_type: component.type,
            reference: childRef,
            total_amount: component.amount,
            status: "completed",
            completed_at: new Date().toISOString(),
            paystack_transaction_id: transactionId,
            related_property_id: escrow.related_property_id || null,
            related_tenancy_id: escrow.related_tenancy_id || null,
            office_id: officeId,
            case_id: escrow.case_id || null,
            metadata: { parent_reference: reference, split_plan: childSplitPlan, description: `${component.type.replace(/_/g, " ")} (from bundle)` },
          })
          .select("id")
          .single();

        if (childTx) {
          let autoRelease = false;
          try {
            const { data: flag } = await supabaseAdmin.from("feature_flags").select("is_enabled").eq("feature_key", "office_payout_mode").single();
            autoRelease = flag?.is_enabled ?? false;
          } catch {}

          const DEFERRED_OFFICE_TYPES = ["register_tenant_fee", "filing_fee", "agreement_sale"];
          const isDeferredOffice = DEFERRED_OFFICE_TYPES.includes(component.type);

          const childSplitRows: any[] = [];
          for (const s of childSplitPlan as SplitItem[]) {
            if (SECONDARY_SPLIT_RECIPIENTS.includes(s.recipient)) {
              childSplitRows.push(...expandSecondarySplit(
                s, s.recipient, secondaryByParent[s.recipient] || [],
                childTx.id, officeId, isDeferredOffice, autoRelease,
              ));
            } else {
              const isLandlord = s.recipient === "landlord";
              childSplitRows.push({
                escrow_transaction_id: childTx.id,
                recipient: s.recipient,
                amount: s.amount,
                description: s.description || "",
                disbursement_status: isLandlord ? "held" : "pending_transfer",
                released_at: null,
                office_id: officeId,
                release_mode: "manual",
                complaint_basket_item_id: (s as any).complaint_basket_item_id ?? null,
              });
            }
          }

          // All child rows inserted as active ledger entries with payout_readiness='pending'.
          // Recipient-gap rows get 'unassigned' so missing setup never blocks ledger posting.
          const childRowsWithStatus = childSplitRows.map((r: any) => ({
            ...r,
            status: "active",
            payout_readiness: (r.recipient === "admin" && !r.office_id) ? "unassigned" : "pending",
          }));
          await supabaseAdmin.from("escrow_splits").insert(childRowsWithStatus);
        }
      }
    }
  }

  // 3. Handle payment-type-specific side effects
  await handleSideEffects(supabaseAdmin, { paymentType, userId, meta, escrow, amountPaid, transactionId });

  // 4. Load split plan from metadata
  let splitPlan: SplitItem[] = Array.isArray(meta.split_plan) && meta.split_plan.length > 0
    ? meta.split_plan
    : [{ recipient: "platform", amount: amountPaid, description: `${paymentType} payment` }];

  // 4b. Sales Channel override (rent card only, Super-Admin-attributed sales)
  // When the escrow has a sales_channel_id and is a rent card payment, the split
  // plan is computed from rent_card_channel_splits instead of the default plan.
  // The recipient taxonomy stays identical (igf / platform / admin) so existing
  // visibility helpers automatically hide `platform` from non-Super Admins.
  const RENT_CARD_TYPES = new Set(["rent_card", "rent_card_bulk"]);
  if ((escrow as any).sales_channel_id && RENT_CARD_TYPES.has(paymentType)) {
    const { data: channelSplits } = await supabaseAdmin
      .from("rent_card_channel_splits")
      .select("recipient, amount_type, amount, sort_order")
      .eq("channel_id", (escrow as any).sales_channel_id)
      .order("sort_order");
    if (channelSplits && channelSplits.length > 0) {
      const computed: SplitItem[] = [];
      let allocated = 0;
      const percentRows = channelSplits.filter((r: any) => r.amount_type === "percent");
      const flatRows = channelSplits.filter((r: any) => r.amount_type === "flat");
      for (const r of flatRows) {
        const amt = +Number(r.amount).toFixed(2);
        allocated += amt;
        computed.push({ recipient: r.recipient, amount: amt, description: `Sales channel ${r.recipient} (flat)` });
      }
      const remaining = Math.max(0, amountPaid - allocated);
      for (let i = 0; i < percentRows.length; i++) {
        const r: any = percentRows[i];
        const isLast = i === percentRows.length - 1;
        const raw = +(remaining * Number(r.amount) / 100).toFixed(2);
        // Last percent row absorbs rounding remainder
        const amt = isLast
          ? +(remaining - computed.filter(c => percentRows.some((pr: any) => pr.recipient === c.recipient)).reduce((s, c) => s + c.amount, 0)).toFixed(2)
          : raw;
        computed.push({ recipient: r.recipient, amount: Math.max(0, amt), description: `Sales channel ${r.recipient} (${r.amount}%)` });
      }
      if (computed.length > 0) {
        splitPlan = computed;
      }
    }
  }


  // 5. Create escrow_splits if missing — POST LEDGER FIRST, decoupled from payout
  const { data: existingSplits } = await supabaseAdmin
    .from("escrow_splits")
    .select("id, recipient, amount, disbursement_status")
    .eq("escrow_transaction_id", escrowId)
    .eq("status", "active");

  let splits = existingSplits || [];

  if (splits.length === 0 && splitPlan.length > 0) {
    let autoRelease = false;
    try {
      const { data: flag } = await supabaseAdmin
        .from("feature_flags")
        .select("is_enabled")
        .eq("feature_key", "office_payout_mode")
        .single();
      autoRelease = flag?.is_enabled ?? false;
    } catch {}

    const DEFERRED_OFFICE_TYPES = ["rent_card", "rent_card_bulk", "add_tenant_fee", "declare_existing_tenancy_fee", "agreement_sale"];
    const isDeferredOffice = DEFERRED_OFFICE_TYPES.includes(paymentType);

    const splitRows: any[] = [];
    for (const s of splitPlan) {
      if (SECONDARY_SPLIT_RECIPIENTS.includes(s.recipient)) {
        splitRows.push(...expandSecondarySplit(
          s, s.recipient, secondaryByParent[s.recipient] || [],
          escrowId, officeId, isDeferredOffice, autoRelease,
        ));
      } else {
        const releaseMode = "manual";
        let disbStatus: string;
        if (s.recipient === "landlord") disbStatus = "held";
        else disbStatus = "pending_transfer";

        // NUGS / student-revenue recipients are office-agnostic central pools
        const isCentralPool = ["nugs", "cm", "igf", "platform"].includes(s.recipient);
        const isServiceFee = (s as any).is_service_fee === true;

        splitRows.push({
          escrow_transaction_id: escrowId,
          recipient: s.recipient,
          amount: s.amount,
          description: s.description || "",
          disbursement_status: disbStatus,
          released_at: null,
          office_id: isCentralPool ? null : officeId,
          release_mode: releaseMode,
          complaint_basket_item_id: (s as any).complaint_basket_item_id ?? null,
          is_service_fee: isServiceFee,
        });
      }
    }

    // Tag every row as active immediately. Missing office on a deferred admin
    // row → payout_readiness='unassigned'. Real recipient-account lookup happens
    // in step 9 below where rows that successfully resolve get flipped to 'ready'.
    const splitRowsWithStatus = splitRows.map((r: any) => ({
      ...r,
      status: "active",
      payout_readiness: (r.recipient === "admin" && !r.office_id) ? "unassigned" : "pending",
    }));

    const { data: inserted, error: splitsInsertErr } = await supabaseAdmin
      .from("escrow_splits")
      .insert(splitRowsWithStatus)
      .select("id, recipient, amount, disbursement_status, payout_readiness");

    if (splitsInsertErr) {
      // Silent-failure guard: ledger MUST post. Log critically and fall back to per-row inserts
      // so a single bad row never zeros the entire ledger entry (the bug that hid registration
      // revenue in Escrow & Revenue / Internal Ledger / Receipts).
      await logError({
        escrow_transaction_id: escrowId,
        reference,
        error_stage: "escrow_splits_insert",
        error_message: `bulk insert failed: ${splitsInsertErr.message} | attempted ${splitRowsWithStatus.length} rows`,
        severity: "critical",
      });
      const fallback: any[] = [];
      for (const row of splitRowsWithStatus) {
        const { data: oneRow, error: oneErr } = await supabaseAdmin
          .from("escrow_splits")
          .insert(row)
          .select("id, recipient, amount, disbursement_status, payout_readiness")
          .single();
        if (oneErr) {
          await logError({
            escrow_transaction_id: escrowId,
            reference,
            error_stage: "escrow_splits_insert_row",
            error_message: `${oneErr.message} | recipient=${row.recipient} amount=${row.amount}`,
            severity: "critical",
          });
        } else if (oneRow) {
          fallback.push(oneRow);
        }
      }
      splits = fallback;
    } else {
      splits = inserted || [];
    }


    // Auto-release office fund request if needed — only for the office share
    if (autoRelease && officeId) {
      const officePct = adminSecondarySplits.find(s => s.sub_recipient === "office")?.percentage ?? 0;
      // Only create fund request for the office's portion of admin splits
      const adminTotal = splitPlan
        .filter(s => s.recipient === "admin")
        .reduce((sum, s) => sum + s.amount, 0);
      const officeAmount = adminSecondarySplits.length > 0 ? +(adminTotal * officePct / 100).toFixed(2) : adminTotal;

      if (officeAmount > 0) {
        const { data: existingReq } = await supabaseAdmin
          .from("office_fund_requests")
          .select("id")
          .eq("payout_reference", `auto_${reference}`)
          .maybeSingle();

        if (!existingReq) {
          await supabaseAdmin.from("office_fund_requests").insert({
            office_id: officeId,
            amount: officeAmount,
            purpose: `Auto-released from ${paymentType.replace(/_/g, " ")} payment (office share)`,
            requested_by: userId,
            status: "approved",
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            reviewer_notes: "Auto-approved by system (Auto Release Mode)",
            payout_reference: `auto_${reference}`,
          });
        }
      }
    }
  }

  // 6. Create receipt if missing
  const { data: existingReceipt } = await supabaseAdmin
    .from("payment_receipts")
    .select("id")
    .eq("escrow_transaction_id", escrowId)
    .maybeSingle();

  let receiptId: string | null = existingReceipt?.id || null;

  if (!existingReceipt) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    // Service-fee splits are real escrow rows for revenue reporting but must
    // not appear on the customer receipt.
    const serviceFeeTotal = splitPlan
      .filter((s: any) => s?.is_service_fee === true)
      .reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
    const receiptAmount = Math.max(0, +(amountPaid - serviceFeeTotal).toFixed(2));
    const splitBreakdown = splitPlan
      .filter((s: any) => s?.is_service_fee !== true)
      .map((s: SplitItem) => ({ recipient: s.recipient, amount: s.amount }));

    // For complaint_fee payments, re-attribute the receipt to the actual complainant
    // (not the admin filer) and link it to the case so it appears in their portal
    // and in the Command Center's case file.
    let receiptUserId: string = userId;
    let payerName: string = profile?.full_name || "Customer";
    let payerEmail: string = profile?.email || "";
    let payerPhone: string | null = null;
    // case_id MUST reference public.cases(id) — not the complaint id. The FK would otherwise
    // silently reject the insert.
    let receiptCaseId: string | null = escrow.case_id || null;
    let complaintIdForReceipt: string | null = null;

    if (paymentType === "complaint_fee" || paymentType === "student_complaint_fee") {
      const complaintId: string | null = meta?.complaintId || escrow.related_complaint_id || null;
      if (complaintId) {
        complaintIdForReceipt = complaintId;
        const complaintTable: "complaints" | "landlord_complaints" =
          meta?.complaint_table === "landlord_complaints" ? "landlord_complaints" : "complaints";
        // Resolve complainant owner id from the right table
        let complainantUserId: string | null = null;
        if (complaintTable === "landlord_complaints") {
          const { data: lc } = await supabaseAdmin
            .from("landlord_complaints")
            .select("landlord_user_id")
            .eq("id", complaintId)
            .maybeSingle();
          complainantUserId = lc?.landlord_user_id || null;
        } else {
          const { data: tc } = await supabaseAdmin
            .from("complaints")
            .select("complainant_user_id, tenant_user_id")
            .eq("id", complaintId)
            .maybeSingle();
          complainantUserId = tc?.complainant_user_id || tc?.tenant_user_id || null;
        }
        if (complainantUserId) receiptUserId = complainantUserId;

        // Backfill: if escrow has no case_id but a real cases row exists for this complaint, use it.
        if (!receiptCaseId) {
          const { data: caseRow } = await supabaseAdmin
            .from("cases")
            .select("id")
            .eq("related_complaint_id", complaintId)
            .maybeSingle();
          if (caseRow?.id) {
            receiptCaseId = caseRow.id;
            // Also patch the escrow so future lookups are linked
            await supabaseAdmin.from("escrow_transactions").update({ case_id: caseRow.id }).eq("id", escrowId);
          }
        }

        // When filed by admin, the payer in the receipt is the actual paying party,
        // not the admin profile.
        if (meta?.filed_by_admin) {
          if (meta?.payer_name) payerName = meta.payer_name;
          if (meta?.payer_email) payerEmail = meta.payer_email;
          if (meta?.payer_phone) payerPhone = meta.payer_phone;
        }
      }
    }

    const receiptPayload = {
      escrow_transaction_id: escrowId,
      user_id: receiptUserId,
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone,
      total_amount: receiptAmount,
      payment_type: paymentType,
      description: meta.description || `Payment for ${paymentType.replace(/_/g, " ")}`,
      split_breakdown: splitBreakdown.length > 0 ? splitBreakdown : null,
      qr_code_data: verifyUrl(`/verify/receipt/${reference}`),
      status: "active",
      receipt_status: "auto_generated" as const,
      admin_confirmed_at: (paymentType === "complaint_fee" || paymentType === "student_complaint_fee") ? new Date().toISOString() : null,
      office_id: officeId,
      tenancy_id: escrow.related_tenancy_id || null,
      case_id: receiptCaseId,
      platform_reference: reference,
      paystack_reference: transactionId,
      payment_date: new Date().toISOString(),
    };
    const { data: insertedReceipt, error: receiptErr } = await supabaseAdmin
      .from("payment_receipts")
      .insert(receiptPayload)
      .select("id")
      .single();
    if (receiptErr) {
      await logError({
        escrow_transaction_id: escrowId,
        reference,
        error_stage: "receipt_insert",
        error_message: `${receiptErr.message} | attempted receipt_status="${receiptPayload.receipt_status}"`,
        severity: "critical",
      });
      // Persist a drift record so the monitor and Command Center see this instantly.
      try {
        await supabaseAdmin.from("receipt_generation_failures").insert({
          escrow_transaction_id: escrowId,
          payment_reference: reference,
          failure_stage: "receipt_insert",
          failure_reason: receiptErr.message,
          attempted_payload: receiptPayload as unknown as Record<string, unknown>,
        });
      } catch (_e) { /* best-effort */ }
    }
    receiptId = insertedReceipt?.id || null;
  }

  // Back-fill complaint.receipt_id now that the receipt row definitely exists.
  if (receiptId && (paymentType === "complaint_fee" || paymentType === "student_complaint_fee")) {
    const complaintIdForLink: string | null = meta?.complaintId || escrow.related_complaint_id || null;
    if (complaintIdForLink) {
      const complaintTableForLink: "complaints" | "landlord_complaints" =
        meta?.complaint_table === "landlord_complaints" ? "landlord_complaints" : "complaints";
      const { data: linked } = await supabaseAdmin
        .from(complaintTableForLink)
        .update({ receipt_id: receiptId })
        .eq("id", complaintIdForLink)
        .select("id")
        .maybeSingle();
      // Fallback: try the other table if the metadata hint was wrong
      if (!linked) {
        const otherTable = complaintTableForLink === "complaints" ? "landlord_complaints" : "complaints";
        await supabaseAdmin.from(otherTable).update({ receipt_id: receiptId }).eq("id", complaintIdForLink);
      }
    }
  }

  // 7. Create notification if missing
  const { data: existingNotif } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .ilike("body", `%${reference.slice(0, 12)}%`)
    .maybeSingle();

  if (!existingNotif) {
    const notifMap: Record<string, { title: string; body: string; link: string }> = {
      tenant_registration: { title: "Registration Confirmed!", body: "Your tenant registration payment has been confirmed. Your account is now active.", link: "/tenant/dashboard" },
      landlord_registration: { title: "Registration Confirmed!", body: "Your landlord registration payment has been confirmed. Your account is now active.", link: "/landlord/dashboard" },
      listing_fee: { title: "Property Listed!", body: "Your property has been listed on the marketplace.", link: "/landlord/my-properties" },
      rent_card_bulk: { title: "Rent Cards Purchased", body: `${meta.quantity || 1} Rent Card(s) purchased successfully for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
      rent_card: { title: "Rent Card Purchased", body: `Rent Card purchased for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
      add_tenant_fee: { title: "Add Tenant Fee Paid", body: `Add tenant fee of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/landlord/add-tenant" },
      complaint_fee: { title: "Complaint Filed", body: `Your complaint filing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed. Your case is now under review.`, link: (meta?.isLandlordComplaint || meta?.complainant_role === "landlord") ? "/landlord/complaints" : "/tenant/my-cases" },
      viewing_fee: { title: "Viewing Request Sent", body: `Your viewing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed.`, link: "/tenant/marketplace" },
      agreement_sale: { title: "Agreement Form Purchased", body: `Agreement form purchased for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/agreements" },
      termination_fee: { title: "Termination Fee Paid", body: `Termination request fee of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/termination" },
      rent_tax: { title: "Rent Tax Paid", body: `Rent tax payment of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/payments" },
      rent_tax_bulk: { title: "Bulk Rent Tax Paid", body: `Bulk advance rent tax of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/payments" },
      renewal_payment: { title: "Renewal Payment Confirmed", body: `Tenancy renewal payment of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/dashboard" },
      student_registration: { title: "Student Registration Confirmed!", body: `Your student registration payment of GH₵ ${amountPaid.toFixed(2)} has been confirmed. Welcome.`, link: "/tenant/dashboard" },
      student_complaint_fee: { title: "Student Complaint Filed", body: `Your student complaint filing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed.`, link: "/nugs/my-complaints" },
    };
    const notif = notifMap[paymentType];
    if (notif) {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: notif.title,
        body: notif.body,
        link: notif.link,
      });
    }
  }

  // 8. Update case status
  if (escrow.case_id) {
    await supabaseAdmin
      .from("cases")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", escrow.case_id)
      .neq("status", "completed");
  }

  // 9. Trigger payout transfers if missing
  try {
    const { data: existingPayouts } = await supabaseAdmin
      .from("payout_transfers")
      .select("id")
      .eq("escrow_transaction_id", escrowId)
      .limit(1);

    if (!existingPayouts || existingPayouts.length === 0) {
      const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (PAYSTACK_SK && splits.length > 0) {
        for (const split of splits) {
          if (split.recipient === "landlord" || split.disbursement_status === "held" || split.disbursement_status === "deferred" || split.amount <= 0) continue;

          const accountType = RECIPIENT_TO_ACCOUNT_TYPE[split.recipient];
          let recipientCode: string | null = null;
          let recipientType = split.recipient;

          if (accountType) {
            // admin_hq and admin both map to "admin" system settlement account
            // but admin (office share) should go to office payout account when not deferred
            if (split.recipient === "admin" && officeId) {
              // Office payout account
              const { data: officeAccount } = await supabaseAdmin
                .from("office_payout_accounts")
                .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
                .eq("office_id", officeId)
                .single();

              if (officeAccount) {
                recipientCode = officeAccount.paystack_recipient_code;
                if (!recipientCode) {
                  recipientCode = await createPaystackRecipient(PAYSTACK_SK, officeAccount);
                  if (recipientCode) {
                    await supabaseAdmin.from("office_payout_accounts").update({ paystack_recipient_code: recipientCode }).eq("office_id", officeId);
                  }
                }
                recipientType = "office";
              }
            } else {
              // System settlement account (rent_control, admin_hq, platform, gra)
              const { data: account } = await supabaseAdmin
                .from("system_settlement_accounts")
                .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
                .eq("account_type", accountType)
                .single();

              if (account) {
                recipientCode = account.paystack_recipient_code;
                if (!recipientCode) {
                  recipientCode = await createPaystackRecipient(PAYSTACK_SK, account);
                  if (recipientCode) {
                    await supabaseAdmin.from("system_settlement_accounts").update({ paystack_recipient_code: recipientCode }).eq("account_type", accountType);
                  }
                }
                recipientType = accountType;
              }
            }
          }

          const payoutRef = `fpayout_${escrowId.slice(0, 8)}_${(split.id || "").slice(0, 8)}_${Date.now()}`;

          if (recipientCode) {
            // Mark split row as ready BEFORE attempting transfer — ledger is decoupled.
            if (split.id) {
              await supabaseAdmin.from("escrow_splits")
                .update({ payout_readiness: "ready" })
                .eq("id", split.id);
            }
            try {
              const tRes = await fetch("https://api.paystack.co/transfer", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
                body: JSON.stringify({ source: "balance", amount: Math.round(split.amount * 100), recipient: recipientCode, reason: `${recipientType} share`, reference: payoutRef, currency: "GHS" }),
              });
              const tData = await tRes.json();

              await supabaseAdmin.from("payout_transfers").insert({
                escrow_split_id: split.id || null,
                escrow_transaction_id: escrowId,
                recipient_type: recipientType,
                recipient_code: recipientCode,
                transfer_code: tData.data?.transfer_code || null,
                amount: split.amount,
                status: tData.status ? "pending" : "failed",
                paystack_reference: payoutRef,
                failure_reason: tData.status ? null : (tData.message || "Transfer failed"),
              });

              if (split.id && !tData.status) {
                await supabaseAdmin.from("escrow_splits").update({
                  payout_readiness: "failed",
                }).eq("id", split.id);
              }
            } catch (e: any) {
              await supabaseAdmin.from("payout_transfers").insert({
                escrow_split_id: split.id || null,
                escrow_transaction_id: escrowId,
                recipient_type: recipientType,
                recipient_code: recipientCode,
                amount: split.amount,
                status: "failed",
                paystack_reference: payoutRef,
                failure_reason: e.message || "Transfer error",
              });
              if (split.id) {
                await supabaseAdmin.from("escrow_splits").update({
                  payout_readiness: "failed",
                }).eq("id", split.id);
              }
            }
          } else {
            // No recipient configured — ledger row stays active, payout marked unassigned.
            // Missing recipient setup must NEVER block ledger posting.
            if (split.id) {
              await supabaseAdmin.from("escrow_splits")
                .update({ payout_readiness: "unassigned" })
                .eq("id", split.id);
            }
            await supabaseAdmin.from("payout_transfers").insert({
              escrow_split_id: split.id || null,
              escrow_transaction_id: escrowId,
              recipient_type: recipientType,
              recipient_code: null,
              amount: split.amount,
              status: "failed",
              paystack_reference: payoutRef,
              failure_reason: "No payout account configured for " + recipientType,
            });
          }
        }
      }
    }
  } catch (payoutErr: any) {
    console.error("Payout trigger error:", payoutErr.message);
    await logError({ escrow_transaction_id: escrowId, reference, error_stage: "payout_trigger", error_message: payoutErr.message || String(payoutErr), severity: "critical" });
  }

  // 10. Validate allocation consistency (log warning only)
  try {
    const storedSplitPlan = meta.split_plan;
    if (Array.isArray(storedSplitPlan) && storedSplitPlan.length > 0) {
      const storedTotal = storedSplitPlan.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      if (Math.abs(storedTotal - amountPaid) > 0.5) {
        await logError({
          escrow_transaction_id: escrowId,
          reference,
          error_stage: "allocation_validation",
          error_message: `Split plan total (${storedTotal}) differs from paid amount (${amountPaid}) by ${Math.abs(storedTotal - amountPaid).toFixed(2)}`,
          severity: "warning",
          error_context: { stored_total: storedTotal, paid: amountPaid },
        });
      }
    }
  } catch {}

  // 11. Write to the unified case_payments source of truth + run idempotent reconciliation.
  // Every payment flow (Dashboard Pay Now, Checkout, Webhook, Manual reconcile) reaches this
  // helper, so this is the single chokepoint that guarantees a row exists in case_payments
  // for every paid transaction.
  try {
    const isStudentPayment =
      isStudentRevenue ||
      paymentType === "student_rent_card_fee" ||
      (officeId && officeId.toLowerCase().startsWith("nugs"));

    const casePaymentRow: any = {
      case_id: escrow.case_id || null,
      student_id: isStudentPayment ? userId : null,
      payer_user_id: userId,
      office_id: officeId,
      escrow_transaction_id: escrowId,
      payment_reference: reference,
      payment_provider: "paystack",
      payment_type: paymentType,
      amount_paid: amountPaid > 0 ? amountPaid : Number(escrow.total_amount || 0),
      currency: "GHS",
      payment_status: "paid",
      metadata: {
        paystack_transaction_id: transactionId,
        complaint_id: escrow.related_complaint_id || null,
        tenancy_id: escrow.related_tenancy_id || null,
        property_id: escrow.related_property_id || null,
      },
    };

    const { data: upserted, error: upErr } = await supabaseAdmin
      .from("case_payments")
      .upsert(casePaymentRow, { onConflict: "payment_reference" })
      .select("id")
      .maybeSingle();

    if (upErr) {
      await logError({ escrow_transaction_id: escrowId, reference, error_stage: "case_payments_upsert", error_message: upErr.message, severity: "warning" });
    }

    if (upserted?.id && receiptId) {
      const { data: rcptRow } = await supabaseAdmin
        .from("payment_receipts")
        .select("receipt_number")
        .eq("id", receiptId)
        .maybeSingle();
      await supabaseAdmin
        .from("case_payments")
        .update({
          receipt_url: verifyUrl(`/verify/receipt/${reference}`),
          ...(rcptRow?.receipt_number ? { receipt_number: rcptRow.receipt_number } : {}),
        })
        .eq("id", upserted.id);
    }

    const { error: rpcErr } = await supabaseAdmin.rpc("reconcile_case_payment", {
      p_payment_reference: reference,
      p_actor: null,
      p_notes: `Auto-reconciled by finalize-payment (${paymentType})`,
    });
    if (rpcErr) {
      await logError({ escrow_transaction_id: escrowId, reference, error_stage: "reconcile_case_payment", error_message: rpcErr.message, severity: "warning" });
    }
  } catch (cpErr: any) {
    await logError({ escrow_transaction_id: escrowId, reference, error_stage: "case_payments_block", error_message: cpErr.message || String(cpErr), severity: "warning" });
  }

  return { verified: true, status: "completed" };
}

// Handle payment-type-specific side effects (updating tenants, landlords, etc.)
async function handleSideEffects(supabaseAdmin: any, opts: { paymentType: string; userId: string; meta: any; escrow: any; amountPaid: number; transactionId: string }) {
  const { paymentType, userId, meta, escrow, amountPaid, transactionId } = opts;

  if (paymentType === "tenant_registration" || paymentType === "student_registration") {
    const { data: tenant } = await supabaseAdmin.from("tenants").select("registration_fee_paid").eq("user_id", userId).single();
    if (tenant && !tenant.registration_fee_paid) {
      await supabaseAdmin.from("tenants").update({
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("user_id", userId);
    }
  } else if (paymentType === "landlord_registration") {
    const { data: landlord } = await supabaseAdmin.from("landlords").select("registration_fee_paid").eq("user_id", userId).maybeSingle();
    const regData = {
      registration_fee_paid: true,
      registration_date: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (landlord) {
      // Yearly renewal: always refresh the expiry window on paid registration.
      await supabaseAdmin.from("landlords").update(regData).eq("user_id", userId);
    } else {
      const landlordId = "LL-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
      await supabaseAdmin.from("landlords").insert({ user_id: userId, landlord_id: landlordId, ...regData });
    }
  } else if (paymentType === "listing_fee") {
    const propertyId = escrow.related_property_id;
    if (propertyId) {
      await supabaseAdmin.from("properties").update({ listed_on_marketplace: true }).eq("id", propertyId);
    }
  } else if (paymentType === "complaint_fee" || paymentType === "student_complaint_fee") {
    let complaintId = meta?.complaintId || escrow.related_complaint_id;
    const draftId = meta?.draft_id;
    if (!complaintId && draftId) {
      const { data: draft } = await supabaseAdmin
        .from("pending_complaint_drafts")
        .select("id, tenant_user_id, payload, evidence_paths, audio_path, materialized_complaint_id, status")
        .eq("id", draftId).maybeSingle();
      if (draft?.materialized_complaint_id) {
        complaintId = draft.materialized_complaint_id;
      } else if (draft && draft.status === "pending_payment") {
        const p = (draft.payload as any) || {};
        const complaintCode = p.complaint_code || `RC-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;
        const { data: ticketNumber } = await supabaseAdmin.rpc("generate_complaint_ticket");
        let complaintPropertyId: string | null = null;
        if (p.complaint_property) {
          const { data: cp } = await supabaseAdmin.from("complaint_properties")
            .insert({ ...p.complaint_property, tenant_user_id: draft.tenant_user_id })
            .select("id").single();
          complaintPropertyId = cp?.id || null;
        }
        const { data: newComplaint, error: ncErr } = await supabaseAdmin.from("complaints").insert({
          tenant_user_id: draft.tenant_user_id,
          complaint_code: complaintCode,
          ticket_number: ticketNumber || undefined,
          complaint_type: p.complaint_type,
          complaint_type_is_custom: !!p.complaint_type_is_custom,
          landlord_name: p.landlord_name,
          property_address: p.property_address,
          region: p.region,
          description: p.description,
          status: "ready_for_scheduling",
          payment_status: "paid",
          gps_location: p.gps_location || null,
          gps_confirmed: !!p.gps_confirmed,
          gps_confirmed_at: p.gps_confirmed_at || null,
          office_id: p.office_id || null,
          complaint_property_id: complaintPropertyId,
          nugs_school: p.nugs_school || null,
          assigned_nugs_user_id: p.assigned_nugs_user_id || null,
          evidence_urls: draft.evidence_paths && draft.evidence_paths.length > 0 ? draft.evidence_paths : undefined,
          audio_url: draft.audio_path || undefined,
        }).select("id").single();
        if (ncErr) {
          console.error("Failed to materialize complaint from draft:", ncErr.message);
        } else if (newComplaint) {
          complaintId = newComplaint.id;
          if (complaintPropertyId) {
            await supabaseAdmin.from("complaint_properties").update({ complaint_id: complaintId }).eq("id", complaintPropertyId);
          }
          try {
            const { data: caseNumber } = await supabaseAdmin.rpc("generate_case_number");
            await supabaseAdmin.from("cases").insert({
              case_number: caseNumber || `CASE-${Date.now()}`,
              office_id: p.office_id || null,
              user_id: draft.tenant_user_id,
              case_type: "complaint",
              related_complaint_id: complaintId,
              metadata: { complaint_code: complaintCode, draft_id: draftId },
            });
          } catch (e) { console.error("Case creation from draft failed:", e); }
          await supabaseAdmin.from("escrow_transactions").update({ related_complaint_id: complaintId }).eq("id", escrow.id);
          await supabaseAdmin.from("pending_complaint_drafts").update({ status: "materialized", materialized_complaint_id: complaintId }).eq("id", draftId);
        }
      }
    }
    if (complaintId) {
      const { data: rcpt } = await supabaseAdmin.from("payment_receipts").select("id").eq("escrow_transaction_id", escrow.id).maybeSingle();
      const updates: any = { status: "ready_for_scheduling", payment_status: "paid", receipt_id: rcpt?.id || null, filing_fee_paid: true, filing_fee_paid_at: new Date().toISOString() };
      // Prefer the table hinted by checkout metadata; fall back to probe.
      const preferredTable: "complaints" | "landlord_complaints" =
        meta?.complaint_table === "landlord_complaints" ? "landlord_complaints" : "complaints";
      const { data: pUpd } = await supabaseAdmin.from(preferredTable).update(updates).eq("id", complaintId).select("id").maybeSingle();
      if (!pUpd) {
        const otherTable = preferredTable === "complaints" ? "landlord_complaints" : "complaints";
        await supabaseAdmin.from(otherTable).update(updates).eq("id", complaintId);
      }
      // Lock currently-unpaid basket items so they are not re-requested
      await supabaseAdmin.from("complaint_basket_items")
        .update({ paid_at: new Date().toISOString() })
        .eq("complaint_id", complaintId)
        .is("paid_at", null);

      // Notify the complainant so the receipt + case-status change land in their portal.
      try {
        let notifyUserId: string | null = null;
        let link = "/tenant/my-cases";
        if (preferredTable === "landlord_complaints") {
          const { data: lc } = await supabaseAdmin.from("landlord_complaints").select("landlord_user_id").eq("id", complaintId).maybeSingle();
          notifyUserId = lc?.landlord_user_id || null;
          link = "/landlord/complaints";
        } else {
          const { data: tc } = await supabaseAdmin.from("complaints").select("complainant_user_id, tenant_user_id, complainant_role").eq("id", complaintId).maybeSingle();
          notifyUserId = tc?.complainant_user_id || tc?.tenant_user_id || null;
          link = tc?.complainant_role === "landlord" ? "/landlord/complaints" : "/tenant/my-cases";
        }
        if (notifyUserId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: notifyUserId,
            title: "Filing Fee Confirmed",
            body: `Filing fee of GH₵ ${amountPaid.toFixed(2)} confirmed. Your case is now under review.`,
            link,
          });
        }
      } catch (e) { console.error("Complainant notification failed:", e); }
    }
  } else if (paymentType === "viewing_fee") {
    const viewingRequestId = meta?.viewingRequestId;
    if (viewingRequestId) {
      await supabaseAdmin.from("viewing_requests").update({ status: "pending" }).eq("id", viewingRequestId).eq("status", "awaiting_payment");
    }
  } else if (paymentType === "rent_tax_bulk") {
    const tenancyId = escrow.related_tenancy_id;
    if (tenancyId) {
      const paymentIds = meta?.paymentIds;
      if (Array.isArray(paymentIds) && paymentIds.length > 0) {
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", receiver: transactionId,
        }).in("id", paymentIds).eq("tenant_marked_paid", false);
      } else {
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", receiver: transactionId,
        }).eq("tenancy_id", tenancyId).eq("tenant_marked_paid", false);
      }
      await supabaseAdmin.from("tenancies").update({ tax_compliance_status: "verified" } as any).eq("id", tenancyId);
    }
  } else if (paymentType === "rent_tax") {
    const paymentIds = meta?.paymentIds;
    if (Array.isArray(paymentIds) && paymentIds.length > 0) {
      await supabaseAdmin.from("rent_payments").update({
        tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", amount_paid: amountPaid, receiver: transactionId,
      }).in("id", paymentIds);
    } else {
      const ref = escrow.reference || "";
      if (ref.startsWith("rent_")) {
        const paymentId = ref.replace("rent_", "");
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", amount_paid: amountPaid, receiver: transactionId,
        }).eq("id", paymentId);
      }
    }
  } else if (paymentType === "rent_card_bulk" || paymentType === "rent_card") {
    const qty = meta?.quantity || 1;
    const cardCount = qty * 2;
    const { data: existingCards } = await supabaseAdmin.from("rent_cards").select("id").eq("escrow_transaction_id", escrow.id);
    if (!existingCards || existingCards.length === 0) {
      const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
      const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
      const rentCards = [];
      for (let i = 0; i < cardCount; i++) {
        rentCards.push({
          landlord_user_id: userId,
          status: "awaiting_serial",
          escrow_transaction_id: escrow.id,
          serial_number: null,
          purchase_id: purchaseId,
        });
      }
      await supabaseAdmin.from("rent_cards").insert(rentCards);
    }
  } else if (paymentType === "renewal_payment") {
    const tenancyId = escrow.related_tenancy_id || meta?.tenancyId;
    if (tenancyId) {
      const { data: existingRenewal } = await supabaseAdmin
        .from("tenancies")
        .select("id")
        .eq("previous_tenancy_id", tenancyId)
        .maybeSingle();

      if (!existingRenewal) {
        const { data: oldTenancy } = await supabaseAdmin.from("tenancies").select("*").eq("id", tenancyId).single();
        if (oldTenancy) {
          const rent = Number(oldTenancy.proposed_rent ?? oldTenancy.agreed_rent);
          const months = oldTenancy.renewal_duration_months ?? 12;
          const advanceMonths = Math.min(oldTenancy.advance_months ?? 6, 6);

          const newStart = new Date(oldTenancy.end_date);
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + months);

          const { data: newTenancy, error: insertErr } = await supabaseAdmin
            .from("tenancies")
            .insert({
              tenant_user_id: oldTenancy.tenant_user_id,
              landlord_user_id: oldTenancy.landlord_user_id,
              unit_id: oldTenancy.unit_id,
              agreed_rent: rent,
              advance_months: advanceMonths,
              start_date: newStart.toISOString().split("T")[0],
              end_date: newEnd.toISOString().split("T")[0],
              move_in_date: newStart.toISOString().split("T")[0],
              tenant_id_code: oldTenancy.tenant_id_code,
              registration_code: `REN-${oldTenancy.registration_code}`,
              status: "active",
              tenancy_type: "renewal",
              previous_tenancy_id: tenancyId,
              tenant_accepted: true,
              landlord_accepted: true,
              office_id: oldTenancy.office_id || null,
            })
            .select("id")
            .single();

          if (!insertErr && newTenancy) {
            await supabaseAdmin.from("tenancies").update({ status: "expired" }).eq("id", tenancyId);
            // Honor GRA Tax toggle + configured tax rate
            const { data: tplCfg } = await supabaseAdmin
              .from("agreement_template_config")
              .select("gra_tax_enabled, tax_rate")
              .limit(1)
              .maybeSingle();
            const taxOn = tplCfg?.gra_tax_enabled !== false;
            const taxRateNum = Number(tplCfg?.tax_rate ?? 8) / 100;
            const payments = [];
            for (let i = 0; i < months; i++) {
              const dueDate = new Date(newStart);
              dueDate.setMonth(dueDate.getMonth() + i);
              const taxAmount = taxOn ? +(rent * taxRateNum).toFixed(2) : 0;
              payments.push({
                tenancy_id: newTenancy.id,
                due_date: dueDate.toISOString().split("T")[0],
                month_label: dueDate.toLocaleString("en-GB", { month: "long", year: "numeric" }),
                monthly_rent: rent,
                tax_amount: taxAmount,
                amount_to_landlord: rent,
                status: i < advanceMonths ? "tenant_paid" : "pending",
                tenant_marked_paid: i < advanceMonths,
              });
            }
            if (payments.length > 0) await supabaseAdmin.from("rent_payments").insert(payments);

            await supabaseAdmin.from("notifications").insert([
              { user_id: oldTenancy.tenant_user_id, title: "Tenancy Renewed!", body: `Your tenancy has been renewed at GH₵ ${rent.toLocaleString()}/month for ${months} months.`, link: "/tenant/dashboard" },
              { user_id: oldTenancy.landlord_user_id, title: "Tenancy Renewed", body: `Tenancy ${oldTenancy.registration_code} has been renewed for ${months} months.`, link: "/landlord/dashboard" },
            ]);
          }
        }
      }
    }
  } else if (paymentType === "rentcare_application_fee") {
    const applicationId = meta?.application_id || meta?.applicationId;
    if (applicationId) {
      const { data: app } = await supabaseAdmin
        .from("rentcare_applications")
        .select("id, applicant_user_id, status, payment_status")
        .eq("id", applicationId)
        .maybeSingle();
      if (app && app.payment_status !== "paid" && app.payment_status !== "reconciled") {
        await supabaseAdmin
          .from("rentcare_applications")
          .update({
            payment_status: "paid",
            status: "paid_and_submitted",
            submitted_at: new Date().toISOString(),
          })
          .eq("id", applicationId);
        await supabaseAdmin.from("rentcare_audit_log").insert({
          application_id: applicationId,
          event_type: "payment_successful",
          actor_user_id: app.applicant_user_id,
          actor_role: "student",
          new_value: { payment_status: "paid", amount: amountPaid, txn: transactionId },
        });
        await supabaseAdmin.from("notifications").insert({
          user_id: app.applicant_user_id,
          title: "RentCare Application Submitted",
          body: "Your application fee was received. Please open your application to create and submit your UMB account details.",
          link: `/nugs/rentcare/${applicationId}`,
        });
      }
    }
  } else if (paymentType === "safety_report_fee" || paymentType === "student_safety_report_fee") {
    const draftId = meta?.draft_id;
    if (!draftId) return;
    const { data: draft } = await supabaseAdmin
      .from("pending_safety_report_drafts")
      .select("id, user_id, user_role, payload, evidence_paths, status, materialized_report_id")
      .eq("id", draftId)
      .maybeSingle();
    if (!draft || draft.status === "materialized" || draft.materialized_report_id) return;

    const p = (draft.payload as any) || {};

    // Snapshot profile (mirrors submit-safety-report)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", draft.user_id)
      .maybeSingle();

    const { count: falseAlertCount } = await supabaseAdmin
      .from("safety_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", draft.user_id)
      .eq("status", "false_alert");

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("safety_reports")
      .insert({
        report_kind: "safety_report",
        category: p.category ?? null,
        user_id: draft.user_id,
        user_role: draft.user_role,
        user_name_snapshot: profile?.full_name ?? null,
        user_phone_snapshot: profile?.phone ?? null,
        hostel_or_hall: p.hostel_or_hall ?? null,
        school: p.school ?? null,
        description: p.description ?? null,
        evidence_urls: draft.evidence_paths ?? [],
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        location_accuracy: p.location_accuracy ?? null,
        is_silent: !!p.is_silent,
        severity: p.severity ?? "medium",
        false_alert_count_at_time: falseAlertCount ?? 0,
        status: "submitted",
      })
      .select("id, ticket_number")
      .single();

    if (insErr) {
      console.error("Failed to materialize safety report from draft:", insErr.message);
      return;
    }

    // Audit log (non-fatal)
    try {
      await supabaseAdmin.from("safety_audit_log").insert({
        report_id: inserted.id,
        actor_user_id: draft.user_id,
        action: "created",
        details: { report_kind: "safety_report", paid: true, payment_type: paymentType, reference: escrow.reference },
      });
    } catch (e) { console.error("Safety audit log failed", e); }

    // Notify all main admins (panic ringer is unaffected — it only listens for panic_emergency)
    try {
      const { data: admins } = await supabaseAdmin
        .from("admin_staff")
        .select("user_id")
        .in("admin_type", ["main_admin", "super_admin"]);
      if (admins?.length) {
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          title: "New Safety Report",
          body: `${inserted.ticket_number} from ${profile?.full_name ?? "user"}`,
          link: `/regulator/safety/${inserted.id}`,
        }));
        await supabaseAdmin.from("notifications").insert(rows);
      }
    } catch (e) { console.error("Notify admins failed", e); }

    // SMS fan-out to safety contacts (best-effort)
    try {
      const { data: contacts } = await supabaseAdmin
        .from("safety_contacts")
        .select("phone")
        .eq("active", true)
        .not("phone", "is", null);
      const message = `RentControl SAFETY: New safety report ${inserted.ticket_number} from ${profile?.full_name ?? "user"}. Category: ${p.category ?? "n/a"}.`;
      const phones = (contacts ?? []).map((c: any) => c.phone).filter(Boolean) as string[];
      await Promise.all(phones.map((phone) =>
        supabaseAdmin.functions.invoke("send-sms", { body: { phone, message } }).catch(() => null)
      ));
    } catch (e) { console.error("Safety contact fan-out failed", e); }

    await supabaseAdmin
      .from("pending_safety_report_drafts")
      .update({ status: "materialized", materialized_report_id: inserted.id })
      .eq("id", draftId);

    // Notify the reporter
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: draft.user_id,
        title: "Safety Report Submitted",
        body: `Your safety report ${inserted.ticket_number} has been received.`,
        link: "/safety/my-reports",
      });
    } catch {}
  }
}

// Create a Paystack transfer recipient
async function createPaystackRecipient(secretKey: string, account: any): Promise<string | null> {
  try {
    const payload: any = {
      type: account.payment_method === "momo" ? "mobile_money" : "nuban",
      name: account.account_name || "Settlement Account",
      currency: "GHS",
    };
    if (account.payment_method === "momo") {
      payload.account_number = account.momo_number;
      const p = (account.momo_provider || "").toLowerCase();
      payload.bank_code = p === "mtn" ? "MTN" : p === "vodafone" ? "VOD" : p === "airteltigo" ? "ATL" : account.momo_provider;
    } else {
      payload.account_number = account.account_number;
      payload.bank_code = account.bank_name;
    }

    const res = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.status && data.data?.recipient_code) {
      return data.data.recipient_code;
    }
    return null;
  } catch {
    return null;
  }
}

# Activate Safety Report Paywall

## Status of Discovery

Almost everything you described is **already implemented and wired** in the codebase. The work needed is small: flip two switches and (optionally) relabel one split recipient.

### What's already in place

| Requirement | Status | Where |
|---|---|---|
| Paywall UI before submission | ✅ Built | `src/pages/shared/ReportSafetyIssue.tsx` (tenant/landlord/student) |
| Pending draft → pay → materialize report | ✅ Built | `pending_safety_report_drafts` table + `paystack-checkout` + `_shared/finalize-payment.ts` |
| Receipts + escrow rows | ✅ Auto via existing escrow pipeline | `escrow_transactions` insert with `payment_type = safety_report_fee` / `student_safety_report_fee` |
| Panic alerts stay FREE | ✅ Confirmed | `submit-safety-report` edge function is used only by `SafetyPanicButton`; never touched by paywall flow |
| Engine Room: "Safety Report Fee" + "Student Safety Report Fee" rows | ✅ Already listed | `src/pages/regulator/EngineRoom.tsx` lines 84–89 |
| Student routing → Student Revenue dashboard | ✅ `student_safety_report_fee` is in `STUDENT_PAYMENT_TYPES` everywhere |
| Super-Admin-only edit of student split | ✅ Inherited from existing Engine Room permission gate |
| Split rows in DB | ✅ Both fee types have split_configurations rows already (see below) |

### Current split configurations (already in DB)

**Tenant/Landlord (`safety_report_fee`)** — total GHS 5.00:
- rent_control: 2.00, admin: 1.50, platform: 1.50

**Student (`student_safety_report_fee`)** — total GHS 5.00:
- igf: 0.00, nugs: 1.50, platform: 2.50, cm: 1.00

### What's actually missing

1. **Both feature flags have `is_enabled = false`** → paywall page currently throws "Safety Report fee is not currently configured" when a user tries to pay. This is the single reason the feature appears not to work.
2. Your spec lists the tenant/landlord split as **IGF + Admin + Platform**. The DB currently uses `rent_control + admin + platform`. Functionally equivalent (`rent_control` is the office/regulator bucket), but the label differs from your spec.

## Implementation Steps

1. **Migration: enable both fee flags** (one-line update each)
   ```sql
   UPDATE feature_flags
     SET is_enabled = true
     WHERE feature_key IN ('safety_report_fee', 'student_safety_report_fee');
   ```
2. **(Optional, pending your answer below)** Rename `rent_control` recipient on `safety_report_fee` to `igf` so the Engine Room split UI matches your spec's wording exactly. The student split already uses `igf` so this would make the two consistent.
3. **No code changes required** to `ReportSafetyIssue.tsx`, `paystack-checkout`, or `finalize-payment.ts`.
4. Verify after activation:
   - Submit a tenant test safety report → redirected to Paystack → after payment, `safety_reports` row exists and an `escrow_transactions` row with `payment_type='safety_report_fee'` appears.
   - Hit the Panic button → goes straight through `submit-safety-report` (no payment), confirming the free path is unaffected.

## One question before I implement

For the tenant/landlord split, do you want me to:
- (a) Leave the current recipient as `rent_control` (functionally the IGF/regulator bucket — no DB churn), or
- (b) Rename it to `igf` so the split rows literally read IGF + Admin + Platform like the student split does?

If you don't have a preference, I'll go with **(a)** since `rent_control` is the canonical office bucket used by every other tenant/landlord fee in the system, and changing it just for safety would make safety inconsistent with the rest.

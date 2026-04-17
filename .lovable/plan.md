

## Two-Bug Fix Plan

### Bug 1 — Complaint submit fails with check-constraint violation

**Root cause:** `src/pages/tenant/FileComplaint.tsx` line 256 inserts `status: "awaiting_payment"` but the DB constraint `complaints_status_check` only allows `submitted, under_review, in_progress, resolved, closed, pending_payment`. The UI’s `MyCases.tsx` already maps `submitted` to display label “Submitted — Awaiting Review”, so the intended state is `submitted` with `payment_status='awaiting'` (which IS allowed).

`landlord_complaints` table has no status check constraint, but for consistency we’ll align the value.

**Fix (1 file, 1 line):**
- `src/pages/tenant/FileComplaint.tsx` line 256: change `status: "awaiting_payment"` → `status: "submitted"`. Keep `payment_status: "awaiting"` unchanged.

That alone unblocks complaint submission. No migration needed (the allowed enum already covers the corrected value, and the front-end status maps already include `submitted`).

---

### Bug 2 — Engine Room: “Failed to load. Cannot read properties of null (reading ‘includes’)”

**Root cause:** When a Super Admin opens Engine Room, `useAdminProfile` fetches their `admin_staff` row. If `allowed_features` or `muted_features` is `null` in the DB, the hook coerces them with `|| []` (safe). BUT the code path at line 518 reads `profile!.allowedFeatures.includes(...)` only when `isSubAdmin` is true — Super Admin never hits it.

The actual crash is in `useModuleVisibility.isVisible` (called at line 717 `isVisible("engine_room", "split_engine")`) when `rule.allowed_admin_ids` is `null`. The hook *does* default it to `[]` on fetch, BUT during the first render before the fetch resolves, `rules` is `cachedRules || []` and a freshly-created rule row could have `allowed_admin_ids: null`. More importantly, the visible crash trace points at `.includes` on null — the only candidates that can actually be null at render time in this flow are:

1. `member.allowed_features` / `member.muted_features` in the staff list render (lines 1298, 1312–1313) when an `admin_staff` row has those columns as NULL. The component reads them directly without `|| []`, unlike `useAdminProfile` which normalises its own copy.
2. `profile.allowedFeatures` / `profile.mutedFeatures` if `profile` itself is `null` and `isSubAdmin` evaluates falsy — already guarded.

I verified there ARE staff rows in the DB where these columns can be NULL (the `invite-staff` function inserts `allowed_features: allowedFeatures || []` but legacy rows pre-date that).

**Fix (1 file, 2 small changes in `src/pages/regulator/EngineRoom.tsx`):**

1. Normalise on fetch — in the `fetchStaff` mapper around line 154, coerce both arrays:
   ```ts
   allowed_features: s.allowed_features || [],
   muted_features: s.muted_features || [],
   ```
2. Defensive guard in render (lines 1298, 1312–1313) using `(member.allowed_features || [])` and `(member.muted_features || [])` so any future null row can’t crash the page.

Also normalise `allowed_admin_ids` defensively in `useModuleVisibility.isVisible` (line 59) → `(rule.allowed_admin_ids || []).includes(user.id)` even though the fetch already does this — belt-and-braces against the cached path.

---

### Files touched
- `src/pages/tenant/FileComplaint.tsx` — 1 line
- `src/pages/regulator/EngineRoom.tsx` — staff fetch mapper + 2 render guards
- `src/hooks/useModuleVisibility.ts` — 1 defensive `|| []`

### What stays untouched
RLS, schema, edge functions, all other portals, complaint workflow, payment flow.

### Verification
- Tenant files a complaint → row inserted, redirected to My Cases, shown as “Submitted — Awaiting Review”.
- Landlord files a complaint → unchanged (already used a valid status).
- Super Admin opens Engine Room → page loads fully; staff list renders even for staff with NULL feature arrays.
- Sub Admin Engine Room view continues to filter correctly.


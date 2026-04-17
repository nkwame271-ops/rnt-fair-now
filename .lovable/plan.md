

## Performance Optimisation — Plan

### Reality check (from codebase audit)
- App.tsx **already** uses `React.lazy` + `Suspense` for all routes (Fix 5 ✅ done).
- Only ~2 files use `useQuery` (`PaymentErrors`, `AgencyApiKeys`). Everything else uses `useEffect + supabase` directly. So React Query defaults (Fix 1) alone won't move the needle for most pages — perceived speed (skeletons) and reduced payload (column selection on the hottest pages) matter more.
- 57 files use `select('*')`. Refactoring all of them risks breaking field access. Scope to the 6 highest-traffic list pages.

### Changes

**1. `src/App.tsx` — tighten QueryClient defaults**
```ts
staleTime: 5 * 60 * 1000,
gcTime: 10 * 60 * 1000,
refetchOnWindowFocus: false,
refetchOnMount: false,
retry: 1,
```
Replaces existing 60s/300s defaults.

**2. `src/index.css` — shimmer keyframes + `.skeleton` utility**
Adds the spec'd `@keyframes shimmer` and `.skeleton` class for use anywhere.

**3. `src/components/ui/skeleton.tsx` — already exists**
Extend with two presets used by list pages:
- `<SkeletonCard />` — mirrors a list-row card (avatar + 2 text lines + badge).
- `<SkeletonStatGrid count={4} />` — for dashboard metric tiles.

**4. Replace `LogoLoader` with skeletons on the 6 highest-traffic list pages**
Just swap the loading branch — no other changes:
- `RegulatorTenants.tsx`, `RegulatorLandlords.tsx`, `RegulatorProperties.tsx`, `RegulatorComplaints.tsx`, `RegulatorAgreements.tsx`, `landlord/Agreements.tsx`.
Show 5 `<SkeletonCard />` rows during initial load.

**5. Sidebar hover prefetch — `RegulatorLayout.tsx` only**
Wire `onMouseEnter` on the 6 nav items (Overview, Tenants, Complaints, Agreements, Properties, Escrow) to call `queryClient.prefetchQuery` for a lightweight count/list query keyed `['prefetch', '<route>']`. This warms the connection + caches the first 25 rows. (Other layouts skipped — regulator portal is the heaviest.)

**6. Column selection — top 4 regulator list pages only**
Replace `select('*')` with explicit column lists on:
- `RegulatorTenants.tsx`
- `RegulatorLandlords.tsx`
- `RegulatorComplaints.tsx`
- `RegulatorAgreements.tsx`
Only columns the row actually renders. Detail/expand views keep their existing fetches (already separate).

**7. Pagination — same 4 pages**
Add `.range(0, 24)` + a "Load more" button that increments by 25. Cached in component state. Search/filter resets to page 0.

**8. DB indexes — one migration**
Run the spec'd `CREATE INDEX IF NOT EXISTS` statements. Skips ones whose tables don't exist (`tenancy_agreements` may be `agreements` — I'll verify against the schema before generating the migration and adapt names). All `IF NOT EXISTS` so safe.

### Out of scope (intentionally)
- Refactoring all 57 `select('*')` usages — high risk, low payoff vs the top 4.
- Pagination on every list page — same reason.
- Real-time subscriptions on complaints/escrow stay untouched (per brief).
- No changes to RLS, auth, Paystack, Engine Room, routes, or UI layout.

### Build sequence
1. Migration: DB indexes (after verifying real table names).
2. `src/App.tsx` — QueryClient defaults.
3. `src/index.css` + `src/components/ui/skeleton.tsx` — shimmer + presets.
4. 6 list pages — skeleton swap.
5. 4 regulator pages — column lists + pagination.
6. `RegulatorLayout.tsx` — hover prefetch on 6 nav items.

### Verification
- Cold load of Regulator Tenants: skeleton appears instantly, real rows replace within ~500ms.
- Click between Tenants → Complaints → Tenants: second visit instant (cache hit, no Supabase call).
- Hover Tenants in sidebar then click: data already there.
- Network tab shows smaller payloads on the 4 refactored pages.
- All existing functionality unchanged.


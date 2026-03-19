

# Stress-Test Readiness Plan for ~2,000 Concurrent Users

## Current Bottlenecks Identified

1. **Waterfall queries on dashboards**: Tenant and Landlord dashboards make 5-8 sequential DB calls per page load. With 2,000 users, that's 10,000-16,000 queries hitting the database on login alone.

2. **No React Query caching**: `QueryClient` uses default config (0ms staleTime), so every component mount re-fetches. Most pages don't use React Query at all — they use raw `useEffect` + `supabase.from()`.

3. **Feature flag cache thrashing**: `useFeeConfig` calls `invalidateFeatureFlags()` on every mount, forcing a fresh DB query. Every dashboard load triggers this.

4. **Marketplace loads all listings**: No pagination — fetches every vacant unit in one query.

5. **No route-level code splitting**: All 50+ pages are bundled together and loaded upfront.

6. **Missing database indexes**: No evidence of indexes on frequently queried columns like `tenant_user_id`, `landlord_user_id`, `status` on tenancies/complaints/rent_payments.

---

## Implementation Plan

### Step 1: Add Database Indexes
Create a migration adding indexes on the most-queried columns to reduce DB load:
- `tenancies(tenant_user_id)`, `tenancies(landlord_user_id)`, `tenancies(status)`
- `complaints(tenant_user_id)`, `complaints(status)`
- `rent_payments(tenancy_id)`, `rent_payments(status)`
- `units(property_id)`, `units(status)`
- `profiles(user_id)`
- `marketplace_messages(sender_user_id)`, `marketplace_messages(receiver_user_id)`
- `user_roles(user_id)`

### Step 2: Fix Feature Flag Cache Thrashing
Remove the `invalidateFeatureFlags()` call inside `useFeeConfig` — the 30-second TTL cache is sufficient. This alone eliminates ~2,000 unnecessary queries per 30-second window.

### Step 3: Configure React Query with Sensible Defaults
Update `QueryClient` in `App.tsx` with:
- `staleTime: 60_000` (1 minute)
- `gcTime: 300_000` (5 minutes)
- `refetchOnWindowFocus: false`
- `retry: 1`

This prevents re-fetching on every tab switch and component remount.

### Step 4: Add Lazy Loading for Routes
Convert all page imports in `App.tsx` to `React.lazy()` with `Suspense`. This reduces initial bundle size from loading all 50+ pages to only the one being visited.

### Step 5: Parallelize Dashboard Queries
Refactor `TenantDashboard` and `LandlordDashboard` to use `Promise.all()` for independent queries instead of sequential awaits. Reduces dashboard load time by 3-5x.

### Step 6: Add Marketplace Pagination
Limit Marketplace to 20 units per page with a "Load More" button or infinite scroll, preventing a single query from returning hundreds of rows.

### Step 7: Add Connection Pooling Headers
Ensure Supabase client uses `keepAlive` and proper headers to minimize connection overhead under load.

---

## Priority Order

| Priority | Change | Impact |
|----------|--------|--------|
| Critical | Database indexes | Prevents query timeouts |
| Critical | Fix fee flag cache thrashing | Eliminates thousands of redundant queries |
| High | React Query defaults | Reduces repeat fetches by 80%+ |
| High | Parallelize dashboard queries | 3-5x faster page loads |
| Medium | Lazy loading routes | Faster initial load |
| Medium | Marketplace pagination | Prevents large payload issues |

---

## What This Does NOT Cover
- Server-side rate limiting (handled by Lovable Cloud infrastructure)
- CDN/edge caching (already handled by hosting)
- WebSocket connection limits for Realtime (Lovable Cloud manages this)

These changes focus on reducing the database query volume per user, which is the primary bottleneck at 2,000 concurrent users.


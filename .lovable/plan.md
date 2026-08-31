# Platform emergency stabilization plan

## Confirmed diagnosis

This is a combined backend-load and frontend-resilience incident, not a single dropdown defect.

- The hosted backend reports as online, but two direct diagnostic reads and the database-health request timed out because the connection pool was unavailable.
- Recent database logs contain repeated statement timeouts, lost client connections, cron startup timeouts, and a cancelled maintenance task.
- The slow-query report identifies concrete pressure points:
  - Rent-card stock summary: 5,469 calls, 1.87 seconds average, 7.93 seconds maximum.
  - Receipt lookup by escrow transaction: over 21.6 million calls.
  - Hearing-room loading: 42,432 calls.
  - Case-payment receipt recovery: 109,800 calls, up to 6.18 seconds.
- Several global frontend loading paths (`useAuth`, feature flags, module visibility, admin profile, and protected-route registration checks) wait indefinitely when a backend request stalls or rejects because they have no shared timeout and/or guaranteed `finally` exit.
- High-volume screens still download and aggregate complete datasets in the browser; the rent-card office stock screen repeatedly pages through every matching serial before it can render.
- Mobile interaction is doing unnecessary compositing work: global backdrop blur is applied to every card/input/header and global transform animations are applied through broad selectors. Live console output also confirms invalid ref forwarding on the public page. These issues can make taps and overlays feel delayed on lower-powered phones.

The exact dropdown component affected by each user report is not yet identified, so the first validation pass will reproduce menus across each portal rather than assume every dropdown has the same cause.

## Fix sequence

### 1. Stop database saturation

- Capture current table sizes, indexes, active/blocked sessions, and execution plans once the diagnostic connection is available.
- Trace the source of the 21.6-million receipt lookups and high-frequency rent-card, hearing-room, and recovery queries; eliminate repeated per-row/per-cycle calls rather than only masking them.
- Add only execution-plan-backed composite indexes for the confirmed filters and sort orders.
- Replace full rent-card serial downloads with database-side summary/range queries and paginated detail retrieval.
- Scope hearing-room queries by the complaint office and cache stable reference data.
- Review scheduled recovery jobs so runs cannot overlap or repeatedly scan the same settled rows.

### 2. Make every screen fail fast instead of spinning forever

- Add a shared request timeout and typed retry/error handling for frontend database calls.
- Update auth, protected routes, feature flags, module visibility, and admin-profile hooks so loading always ends in `finally`, with a bounded retry and a useful retry state.
- Prevent a stalled non-essential request (feature labels, notifications, activity logging, or fee metadata) from blocking navigation or page controls.
- Add cancellation guards for requests from pages that unmount or filters that change.

### 3. Repair dropdown and mobile interaction reliability

- Reproduce sidebar menus, selects, popovers, dialogs, and command search on mobile for tenant, landlord, and regulator routes.
- Fix the confirmed invalid ref-forwarding paths and any overlay/focus-lock layer that captures taps after closing.
- Standardize portal menu buttons and overlays with correct stacking, pointer events, focus restoration, and scroll locking.
- Ensure dropdown content is rendered above headers, sidebars, help controls, and dialogs and remains within the mobile viewport.

### 4. Reduce frontend work on every page

- Remove blanket backdrop filters and `will-change` from all cards; retain lightweight effects only where they are visibly necessary.
- Limit global hover/transform selectors to intentional interactive components and disable nonessential motion/touch hover effects on mobile.
- Lazy-load heavy regulator rent-card workspaces by active tab so hidden tabs do not mount or query.
- Deduplicate global feature-flag/admin-profile subscriptions and defer notification/support widgets until the app shell is interactive.

### 5. Verify under real usage

- Test public, tenant, landlord, and regulator navigation at the current mobile size and desktop size.
- For each portal, verify initial load, five route changes, sidebar open/close, representative selects/popovers, and recovery from a forced slow/failed request.
- Re-run database health, timeout logs, and the slow-query report; compare query call volume and latency before and after.
- Run focused tests and confirm the latest build, runtime, console, and network logs are clean before declaring the incident fixed.

## Technical scope

Likely frontend touchpoints include the global auth/feature/admin hooks, protected routing, shared Radix select/popover/dialog wrappers, portal layouts, global CSS effects, and the regulator rent-card workspaces. Backend changes will be limited to confirmed query/index/job fixes supported by execution plans; no data or business-rule changes are included.

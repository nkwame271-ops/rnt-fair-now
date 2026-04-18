

## Plan — Multi-screen adaptive (phone / tablet / desktop)

Make every portal page render cleanly on phone (≤640px), tablet (641–1024px), and desktop (≥1025px). CSS/layout class changes only — no data, route, RLS, or logic changes.

### What's broken on small screens
1. **Dashboards** — fixed `grid-cols-4` stat grids overflow on phones.
2. **Tables** — wide admin tables (Tenants, Landlords, Properties, Complaints, Rent Cards, Receipts) overflow with no scroll wrapper.
3. **Modals** — several dialogs use fixed widths that clip on phones.
4. **Forms** — multi-column form grids don't collapse on small screens.
5. **Headers** — title + multiple action buttons wrap awkwardly.
6. **Tabs** — long Tabs lists overflow on Profile, Engine Room, Rent Cards.
7. **Tablet gap (768–1024px)** — sidebar takes full width on tablet; main content needs `lg:` breakpoint instead of `md:`.

### Approach — 3 passes

**Pass 1 — Shared utilities & layouts**
- Add `.responsive-table` (overflow-x wrapper) and `.stat-grid` (`grid-cols-2 lg:grid-cols-4`) to `src/index.css`.
- Verify sidebar Sheet trigger visible at ≤1024px in all 4 portal layouts; main content padding `lg:pl-60`.

**Pass 2 — Dashboards & high-traffic pages**
- 5 dashboards → swap fixed grids to `.stat-grid`, stack header actions `flex-col sm:flex-row`.
- Profile page tabs → horizontal scroll wrapper.
- Marketplace, MyProperties, MyTenants → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.

**Pass 3 — Forms, modals, long tables**
- Forms collapse `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` (Register/Edit Property, AddTenant, FileComplaint, RentIncrease, Termination, Renewal, RegisterLandlord/Tenant).
- Dialogs → `w-[calc(100vw-2rem)] sm:max-w-lg` on Rating, DigitalSignature, AppointmentSlot, ScheduleComplainant, RequestComplaintPayment, UpdateResidence.
- Long tables wrapped in `.responsive-table`; secondary columns `hidden sm:table-cell`.

### Breakpoints (locked)
- Phone (default, ≤640px) — single column, full-width buttons
- Tablet (`sm:` 640+, `md:` 768+) — 2-column, sidebar still as Sheet
- Desktop (`lg:` 1024+) — fixed sidebar, 3–4 column grids

### Files touched (~30, class edits only)
- `src/index.css` — new utilities
- 4 portal layouts
- 5 dashboards
- ~10 form pages
- ~8 admin table pages
- ~6 dialog components

### Out of scope
Design tokens, new components, data/RLS/logic, gestures (swipe/pull-to-refresh).


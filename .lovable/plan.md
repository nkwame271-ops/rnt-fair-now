

## Global Layout & Visual Rules — Plan

### Approach: token + layout-shell level
Apply 90% via `src/index.css` (background z-index fix, scrollbar, typography defaults) + the 4 layout shells (`RegulatorLayout`, `LandlordLayout`, `TenantLayout`, `NugsLayout`) for transparent main + consistent padding + max-width. No per-page edits.

### Changes

**1. `src/index.css` — global rules**

- **Rule 1 + 2 (background bleed-through, fixed)**: 
  - `body::before` already fixed; change `z-index: -1` → `z-index: 0` and add `body { background: transparent; }` after the `html, body { background-color: #fff }` line so the orbs sit above an empty body but below content. Add `#root { position: relative; z-index: 1; background: transparent; min-height: 100vh; }` so all React content stacks above the orbs.
  - Add safety: `main, aside, section { background-color: transparent; }` is too aggressive — instead add a targeted rule: `[data-app-shell], [data-app-main] { background: transparent !important; }` and tag the shells with those data attrs.

- **Rule 9 (scrollbar)**: Add global rules:
  ```css
  * { scrollbar-width: thin; scrollbar-color: rgba(0,0,0,0.15) transparent; }
  *::-webkit-scrollbar { width: 6px; height: 6px; }
  *::-webkit-scrollbar-track { background: transparent; }
  *::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
  *::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
  ```

- **Rule 6 (typography defaults)**: Add base typography hints inside `@layer base`:
  ```css
  h1 { @apply text-[26px] font-semibold text-foreground tracking-tight; }
  h2 { @apply text-xl font-semibold text-foreground; }
  h3 { @apply text-base font-semibold text-foreground; }
  ```
  (Conservative — won't break existing utility-class overrides since utilities have higher specificity.)

**2. Four layout shells — `RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx`**

For each:
- Add `data-app-shell` to the outer `<div className="min-h-screen flex">` and **remove any opaque background** (none of them currently set one — confirmed). 
- Tag `<main>` with `data-app-main`, change className to add: `bg-transparent` + responsive padding `px-5 py-4 md:px-7 md:py-6 lg:px-10 lg:py-8` (mapping the 16/20 → 24/28 → 32/40 spec) and a max-width wrapper: wrap `<Outlet />` in `<div className="mx-auto w-full max-w-[1400px]">`.
- Footer already uses `bg-card` solid — change to `bg-transparent border-t border-white/30` so the gradient bleeds through.

**3. NOT touched**

- Routes, navigation items, data, queries, RLS, Paystack, Supabase, Engine Room, feature flags.
- Per-page card layouts, button variants, empty states, badges — those are already governed by primitives (`Card`, `Button`, `Badge`) that received glass styling in the previous batch. Rules 3/4/5/7/8/10 are mostly enforced by existing components + the new shell padding/max-width; we don't refactor 100+ pages.

### Build sequence (one parallel batch)
1. `src/index.css` — z-index fix, scrollbar, typography base, shell-transparency rule
2. `src/components/RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx` — `data-app-shell` / `data-app-main`, transparent footer, content max-width wrapper, responsive padding

### Verification
- Mesh orbs visible behind every page through the glass cards.
- Scroll a long list — background stays put.
- Content centred max 1400px on wide screens.
- Padding consistent at `32/40` (lg), `24/28` (md), `16/20` (sm).
- Scrollbars thin and subtle.
- Zero data, route, or logic regressions.


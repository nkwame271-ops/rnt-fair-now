

## Plan — Iridescent / Aurora Border Effect (CSS-only)

Pure CSS additions to `src/index.css`. No component edits, no logic changes, no route changes. Targets existing class hooks already used app-wide.

### Approach

Cards in this project already share two stable selectors:
- `.glass-card` (used by `Card` component + applied to `.bg-card` surfaces)
- `[class*="bg-card"][class*="rounded-*"]` (raw card divs)

Sidebars use `.glass-sidebar`. Modals/dialogs use `.glass-modal`. Coloured feature cards are inside `src/components/FeatureCard.tsx` and use `bg-[hsl(var(--feature-card-*)/...)]` — I'll target them via `[class*="feature-card-"]`.

So we can ship the entire effect via `::before` (aurora border) and `::after` (shimmer sweep) pseudo-elements on those existing selectors — zero React/component changes.

### Edits — `src/index.css` only

1. **Aurora keyframes** — add `auroraShift` and `shimmerSweep` to the existing `@layer utilities`.

2. **Default card border** — apply to `.glass-card` and `[class*="bg-card"][class*="rounded-{lg,xl,2xl}"]`:
   - `position: relative; overflow: hidden;` (already true for most)
   - `::before` = 1.5px gradient ring with mask-composite trick → animated 5s
   - `::after` = diagonal shimmer sweep → 4s ease-in-out infinite
   - Inherit `border-radius` so the ring follows existing rounding (16/12/8px)

3. **Sidebar** — `.glass-sidebar::before` with dimmer palette + 1px padding + 6s animation. No shimmer sweep on sidebar (too busy against nav items).

4. **Modals** — `.glass-modal::before` with 2px padding + 4s animation (hero moment).

5. **Coloured feature cards** — `[class*="feature-card-"]::before` (matches `bg-[hsl(var(--feature-card-primary)/...)]` etc.) with `opacity: 0.7`, `padding: 1px`, warmer-tinted gradient so card colour still leads.

6. **Performance / a11y**:
   - `@media (prefers-reduced-motion: reduce)` → disable both animations
   - `@media (prefers-reduced-transparency: reduce)` → also hide `::before`/`::after` (matches existing fallback pattern)
   - `@supports not (mask-composite: exclude)` → graceful no-op (older browsers just see the existing border)

7. **Z-index hygiene** — pseudo-elements get `z-index: 0` and `pointer-events: none`; card content stays above via existing layout (most card children are flex/block at default z).

### What this does NOT touch
- No changes to `Card`, `FeatureCard`, `NugsLayout`, `TenantLayout`, `LandlordLayout`, `RegulatorLayout`, dialog/sheet primitives.
- No changes to data, routes, RLS, Paystack, Engine Room, auth.
- No new dependencies.

### Files to edit
- `src/index.css` — append aurora keyframes + pseudo-element rules in `@layer utilities`

### Risk notes
- The `mask-composite` trick for the gradient ring is well-supported in all evergreen browsers; falls back to no border on very old Safari (acceptable — they still see the existing 1px white/55 border).
- Sidebar `overflow-hidden` is already set on `<aside>` in all 5 layouts → ring will be clipped cleanly.
- Modals: Radix Dialog content uses `overflow-hidden` by default → fine.




## Glassmorphism Visual Layer — Plan

### Approach: token + primitive level
Drive the entire effect from `src/index.css` (background mesh + utility classes) and the shadcn primitives. No per-page edits needed — every existing `bg-card`, sidebar, dialog, and input picks it up automatically.

### Changes

**1. `src/index.css`**
- Replace `body` background with white base + a fixed `body::before` layer holding the three radial gradient orbs (blue top-left, green top-right, purple bottom-center), `z-index: -1`, `inset: 0`, `pointer-events: none`.
- Override `--card` to `rgba(255,255,255,0.55)` and add a new `--glass-border: rgba(255,255,255,0.5)`.
- Add reusable utility classes:
  - `.glass-card` — standard 0.55 white + blur(16px) + 1px white border + soft shadow
  - `.glass-stat` — lighter 0.45 + blur(12px) for metric cards
  - `.glass-sidebar` — `rgba(15,20,40,0.78)` + blur(20px)
  - `.glass-header` — `rgba(255,255,255,0.6)` + blur(12px)
  - `.glass-modal` — `rgba(255,255,255,0.72)` + blur(24px) + radius 20px
  - `.glass-input` — `rgba(255,255,255,0.6)` + blur(8px), focus ring brand-green at 60%
  - `.glass-badge` — blur(4px) + 1px white/40 border
- Add `@media (prefers-reduced-transparency: reduce)` and `@supports not (backdrop-filter: blur(1px))` fallbacks: solid `rgba(255,255,255,0.92)` background, no blur.
- Update `--sidebar-background` token so existing sidebar `bg-sidebar` reads through glass tokens (or apply `.glass-sidebar` directly on the layout `<aside>`).

**2. `src/components/ui/card.tsx`**
- Append `glass-card` to the default Card className so every card across the app inherits frosted glass without per-file edits. Existing `bg-card` keeps working as fallback.

**3. `src/components/ui/dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `alert-dialog.tsx`**
- Swap the content className's solid `bg-background` for `glass-modal`.
- Swap the overlay className for `bg-[rgba(15,20,40,0.3)] backdrop-blur-sm` (replaces current solid overlay).

**4. `src/components/ui/input.tsx`, `textarea.tsx`, `select.tsx`**
- Replace `bg-background` with `glass-input` so all forms get frosted inputs with brand-green focus.

**5. `src/components/ui/badge.tsx`**
- Add `backdrop-blur-[4px] border-white/40` to the base badgeVariants className. Existing semantic colours preserved.

**6. Layout sidebars — `RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx`**
- Replace `bg-sidebar` on `<aside>` with `glass-sidebar` class (keeps the dark charcoal pill, adds blur depth).
- Replace `<header>`'s `bg-card/60 backdrop-blur` with `.glass-header` for consistency.

**7. `FeatureCard.tsx` (coloured accent cards)**
- Switch from solid `bg-[hsl(var(--feature-card-*))]` to `bg-[hsl(var(--feature-card-*)/0.88)]` plus `backdrop-blur-[12px]` and `border-white/20`. Colour stays bold (≥0.82 per brief, 0.88 for safety), gains depth.

**8. Stat cards on dashboards**
- The 4 dashboard stat cards (`RegulatorDashboard`, `LandlordDashboard`, `TenantDashboard`, `NugsDashboard`) currently use plain `bg-card` divs. Add `glass-stat` class to those specific stat tiles for the lighter frosted look. (One className edit per dashboard.)

### What's NOT touched
- Routes, navigation items, data, queries, RLS, Paystack, Supabase integrations.
- Component functionality, page logic, modal flow, form validation.
- Engine Room, feature flags, KYC gating, ProtectedRoute.
- Tour steps, command search behaviour, notification logic.

### Build sequence (one parallel batch)
1. `src/index.css` — mesh background, glass utilities, reduced-transparency fallback
2. `src/components/ui/card.tsx`, `dialog.tsx`, `sheet.tsx`, `drawer.tsx`, `alert-dialog.tsx`, `input.tsx`, `textarea.tsx`, `select.tsx`, `badge.tsx` — primitive glass
3. `src/components/RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx` — sidebar + header glass
4. `src/components/FeatureCard.tsx` — translucent accent variant
5. `src/pages/regulator/RegulatorDashboard.tsx`, `landlord/LandlordDashboard.tsx`, `tenant/TenantDashboard.tsx`, `nugs/NugsDashboard.tsx` — stat tile className

### Verification
- Background shows soft pastel orbs through every card.
- Cards, modals, sidebar, header, inputs all render frosted glass.
- Coloured FeatureCards stay bold but show subtle depth.
- Text contrast preserved (white opacity ≥0.55 for content, ≥0.45 for stat).
- Devices with reduced transparency get solid 0.92 white fallback.
- Zero data, route, or logic regressions.


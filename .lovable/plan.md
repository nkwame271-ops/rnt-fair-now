

## RentGhana Visual Redesign — Salesforce-Inspired Light Theme

### Scope (visual only)
Restyle the entire app's appearance to match the reference: subtle dual-tone gradient backgrounds, dark pill sidebar, flat white cards, bold coloured feature cards, and refined typography. Zero changes to nav structure, routes, data, queries, RLS, or any logic.

### Approach: token-first
Drive 90% of the redesign through `src/index.css` design tokens and `tailwind.config.ts`. This propagates automatically to all 100+ pages and the shadcn UI library without touching individual files.

### Changes

**1. `src/index.css` — design tokens**
- Background: replace solid with `linear-gradient(135deg, hsl(210 40% 97%) 0%, hsl(0 0% 100%) 50%, hsl(150 50% 97%) 100%)` applied to `body`.
- Sidebar tokens: shift `--sidebar-background` from current dark green to near-black charcoal `220 15% 12%`; sidebar foreground to off-white; sidebar accent (active) to `220 15% 22%`; sidebar primary (icon highlight) keeps brand green.
- Card: keep white, set `--card` to pure white, border `220 15% 92%` at 0.5px.
- Remove `--shadow-card`, `--shadow-elevated`, `--shadow-glow` to flat values (`none` or `0 0 0 0`).
- Radius: bump `--radius` to `0.875rem` (14px).
- Keep brand green primary, gold secondary, all semantic colors (success/warning/info/destructive) — only tune saturation for pill badges.
- Add new utility tokens: `--feature-card-primary` (brand green), `--feature-card-teal` (`172 76% 32%`), `--feature-card-dark` (`220 15% 12%`), `--feature-card-amber` (`38 92% 50%`).

**2. `tailwind.config.ts`**
- Add `featureCard: { primary, teal, dark, amber }` colour group reading from new tokens.
- Extend fontSize hierarchy tokens (page-title, section, body, muted) — optional, keep existing scale, just document.

**3. Sidebar restyle — `src/components/RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx`, `ui/sidebar.tsx`**
- Wrap `<aside>` in outer padding so the sidebar becomes a floating dark pill: `m-3 rounded-2xl` instead of edge-to-edge.
- Tighten width from `w-64` → `w-60`, padding from `p-5` → `p-4`, nav item `py-2.5` → `py-2`, label text `text-sm` → `text-[12px]`.
- Active state: filled capsule using `bg-sidebar-accent` (already token-driven, will pick up new charcoal).
- Top header inside layout: keep, no structural change.

**4. Card restyle — global via tokens**
- Existing `bg-card rounded-xl shadow-card border border-border` everywhere will automatically flatten (shadow token → none) and gain the new radius/border. No per-page edits needed.

**5. Feature cards — new component `src/components/FeatureCard.tsx`**
- Reusable coloured card with variants `primary | teal | dark | amber`, slots for date/ticket (top-left), title, value (bottom-left), avatars/count (bottom-right).
- Apply opportunistically on dashboards (RegulatorDashboard, LandlordDashboard, TenantDashboard, NugsDashboard) for the top 3–4 highlight metrics.

**6. Stat card refinement — touch dashboards only**
- `RegulatorDashboard.tsx`, `LandlordDashboard.tsx`, `TenantDashboard.tsx`, `NugsDashboard.tsx`: bump number to `text-3xl font-bold`, label to `text-[11px] text-muted-foreground`, icon `h-5 w-5 text-muted-foreground` (left of number group). Drop hover shadow.

**7. Buttons & badges — `src/components/ui/button.tsx`, `badge.tsx`**
- Button: change `default` variant radius to `rounded-full` (pill), keep brand green fill.
- Badge: tune semantic variants to muted-fill + dark-text pattern (e.g. success = `bg-success/15 text-success-foreground` with brand-aligned dark text).

**8. Tables — `src/components/ui/table.tsx`**
- Row min-height 48px, header row sentence-case (no uppercase), bottom border only at 0.5px, alternating row tint via `even:bg-muted/30`.

**9. Inputs — `src/components/ui/input.tsx`, `select.tsx`, `textarea.tsx`**
- Height 40px (already close), focus ring → `focus-visible:ring-1 ring-primary` no glow, radius 8px.

### What's NOT touched
- Any route in `App.tsx`.
- Any nav item array in `*Layout.tsx` files (only container styling).
- Any query, hook, edge function, RLS, Paystack, Supabase integration.
- Any page logic, modals, form validation.
- Engine Room, feature flags, KYC gating, ProtectedRoute.
- Tour steps, command search, notification bell behaviour.

### Build sequence (one batch, no migration needed)
1. `src/index.css` — tokens
2. `tailwind.config.ts` — feature card colours
3. `src/components/ui/sidebar.tsx`, `button.tsx`, `badge.tsx`, `table.tsx`, `input.tsx` — primitive polish
4. `src/components/RegulatorLayout.tsx`, `LandlordLayout.tsx`, `TenantLayout.tsx`, `NugsLayout.tsx` — sidebar pill wrapper
5. `src/components/FeatureCard.tsx` — new
6. `src/pages/regulator/RegulatorDashboard.tsx`, `landlord/LandlordDashboard.tsx`, `tenant/TenantDashboard.tsx`, `nugs/NugsDashboard.tsx` — apply FeatureCard to top metrics + tighten stat card text

### Verification
- All existing routes load unchanged.
- Sidebar: dark charcoal pill, white icons/labels, active = lighter capsule.
- Page background: subtle blue-to-green wash, almost white.
- Cards: flat, white, 14px radius, 0.5px border.
- Dashboards show 3–4 bold coloured feature cards at the top.
- Buttons are pill-shaped with brand green.
- No data, nav, or logic regressions.

### Open question (non-blocking)
- **Q1** — The current sidebar is brand-green (a recognisable RentGhana element). The brief asks for charcoal/near-black. I'll switch to charcoal as specified, keeping the small green Shield icon + green active-state accent so brand identity stays visible. Confirm this is intended, otherwise I can keep sidebar green and only apply the pill/compact styling.


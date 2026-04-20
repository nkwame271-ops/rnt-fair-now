

## Mobile Layout Pass 3 — Targeted Fixes

The shell sidebar already collapses correctly at `lg:` (1024px) with hamburger + backdrop. Global `overflow-x: hidden` and `min-width: 0` are in place. What still breaks at 375–430px (per screenshots):

### Concrete fixes

**1. RegulatorDashboard header (`src/pages/regulator/RegulatorDashboard.tsx`)**
- Title `text-3xl` → `text-2xl sm:text-3xl` and remove the `whitespace-normal` wrap by truncating subtitle.
- Office selector `SelectTrigger w-64` → `w-full sm:w-64` so it stops blowing the row.
- Office name pill `📍` add `truncate max-w-full` and `whitespace-nowrap overflow-hidden text-ellipsis`.
- Bottom stat grid `grid-cols-2 lg:grid-cols-4` is fine; reduce inner number `text-3xl` → `text-2xl sm:text-3xl` so values like long counts don't overflow the half-column card.

**2. Layout headers (4 files)**
`TenantLayout`, `LandlordLayout`, `RegulatorLayout`, `NugsLayout`:
- `<header>` currently packs hamburger + brand text + CommandSearch + bell into 56px on a 375px screen — CommandSearch is centered with `max-w-md` and squeezes everything.
- Change header to `gap-2`, hide brand text on `<sm`, wrap CommandSearch in `flex-1 min-w-0` (no centering on mobile), and make the search trigger full-width inside.

**3. Sidebar breakpoint**
Currently desktop sidebar shows at `lg:` (1024px). Tablets 768–1023px get the broken cramped layout shown in earlier screenshots. Switch the four layouts from `lg:` → `md:` for sidebar visibility classes (`lg:translate-x-0 lg:relative lg:m-3 lg:rounded-2xl lg:inset-y-auto lg:h-[calc(100vh-1.5rem)]` → `md:` equivalents, plus `lg:hidden` on hamburger → `md:hidden`).

**4. FloatingActionHub on mobile**
Chat panel already portaled & sized `w-[min(370px,calc(100vw-2rem))]`. On <640px upgrade to true bottom sheet:
- `w-screen max-w-none left-0 right-0 bottom-0 rounded-b-none rounded-t-2xl h-[75dvh]`
- Apply only at `max-sm:` so desktop floating panel is unchanged.
- Same for BetaFeedbackWidget.

**5. NugsLayout overflow guard**
NugsLayout `<main>` is missing `overflow-x-hidden` (only has `overflow-y-auto`). Add it for parity with the other 3 layouts.

### Files touched (~7)

- `src/pages/regulator/RegulatorDashboard.tsx`
- `src/components/TenantLayout.tsx`
- `src/components/LandlordLayout.tsx`
- `src/components/RegulatorLayout.tsx`
- `src/components/NugsLayout.tsx`
- `src/components/LiveChatWidget.tsx`
- `src/components/BetaFeedbackWidget.tsx`

### Out of scope
Data, queries, RLS, routes, auth, Paystack, animations, desktop layout (≥1024px stays identical except sidebar starts at 768px instead).


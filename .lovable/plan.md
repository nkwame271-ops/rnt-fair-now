

## Fix: Sub-Admin permission bypass + Receipt print/PDF empty page

### Issue 1 — Invited Sub Admins get access to every feature

**Root cause.** Two bugs combine:

1. **`RegulatorLayout.tsx` (line 132)** — the nav filter has this fallback:
   ```ts
   if (profile.allowedFeatures.length === 0) return true; // unrestricted admin
   ```
   When you invite a Sub Admin and **don't tick any feature**, `allowed_features` is saved as `[]`. The layout then interprets empty as "unrestricted" and shows the entire sidebar. The same Sub Admin also passes every nav item even when you *do* tick features, because direct URLs aren't guarded at the route level.

2. **No route-level enforcement.** `ProtectedRoute` only checks `role` and `accountStatus`. There is nothing that maps the URL → feature key → `profile.allowedFeatures`. So a Sub Admin can type `/regulator/escrow` and load Escrow even when the nav item is hidden.

3. **Main Admin vs Sub Admin semantics** — `InviteStaff.tsx` already documents the intended rule:
   - **Main Admin**: empty list = full access (backward compatible).
   - **Sub Admin**: empty list = nothing (must explicitly grant features).
   
   Only the Main Admin half of that rule is implemented today.

**Fix.**

- **`RegulatorLayout.tsx`** — change the filter so the "empty = unrestricted" shortcut only applies to **Main Admins**. For Sub Admins, an empty `allowedFeatures` array means **only Dashboard** stays visible (so they have a landing page instead of a blank app shell):
  ```ts
  if (profile.isMainAdmin) {
    if (profile.allowedFeatures.length === 0) return true;
    // explicit-allow path for Main Admins who picked specific features
  } else {
    // Sub Admin — must explicitly include the feature
    const key = getFeatureKeyForRoute(item.to);
    if (key === "dashboard") return true; // always allow landing page
    if (!key) return false;
    if (!profile.allowedFeatures.includes(key)) return false;
    if (profile.mutedFeatures.includes(key)) return false;
    return true;
  }
  ```

- **New route guard `<FeatureGuard>`** wrapping each Sub-Admin-restricted page (or done centrally inside `RegulatorLayout`'s `<AnimatedOutlet />` by reading the active route via `useLocation`). When a Sub Admin lands on a route whose feature key is missing from `allowedFeatures`, render an "Access Restricted — this feature isn't enabled for your account. Contact your Main Admin." card and a Back-to-Dashboard button. This blocks deep-link bypasses without touching RLS.

- **`CommandSearch`** — already receives the filtered `navItems`, so once the filter is fixed it stops surfacing forbidden routes.

- **No DB / RLS change.** Server-side enforcement remains via existing `is_main_admin()` and per-table policies; this purely closes the UI bypass.

### Issue 2 — Receipt prints / exports as a blank page

**Root cause.** `PaymentReceipt.handlePrint` builds an iframe, copies every `<link rel="stylesheet">` and `<style>` from the parent document, and writes the receipt's `outerHTML` into it. In production (and increasingly in the Vite preview) this fails for three reasons:

1. **Tailwind CSS variables live on `html`/`:root`** in the parent doc. The iframe gets the stylesheet `<link>` tags but not the inline `<style>` block on `:root` that Vite injects, so every color token (`bg-card`, `text-card-foreground`, `border-border`, `text-primary`) resolves to *unset* → renders white text on white background → page looks blank.
2. **`iframe.onload` race.** External stylesheets are fetched async; the safety-net `setTimeout(…, 1500)` often fires `print()` before the iframe has applied any styles.
3. **`outerHTML` strips the QRCodeSVG's React-managed SVG attributes inconsistently** in some browsers.

**Fix.** Replace the fragile iframe-CSS-copy approach with a **self-contained print document** that doesn't rely on Tailwind tokens at all:

- Add a small dedicated print renderer inside `PaymentReceipt` that, on print, opens a new window (or uses an iframe) with **inline CSS**: hard-coded font, colors, table layout — independent of the app's CSS variables. Render the receipt fields (number, date, payer, type, description, basket lines, splits, total, QR as a data-URL) directly as plain HTML so it always renders identically regardless of the host page styles.
- Convert the QR code to a data-URL via `qrcode` library's `toDataURL` (already used elsewhere in the codebase) instead of relying on the live `<QRCodeSVG>` element being cloned into the iframe.
- Trigger `window.print()` only after the iframe `load` event AND a `requestAnimationFrame` to guarantee layout has run; remove the racy 1500 ms safety timer.
- Add a second action **"Download PDF"** next to "Print" that uses `jsPDF` to produce the same content (so users get a real PDF instead of relying on the browser's "Save as PDF" print dialog). Layout matches the on-screen card: header (receipt #, date, status badge as colored chip), key-value grid, "Charges Billed" table when present, splits table, total row, QR as image, footer note.
- Apply the same fix to all four call sites — `tenant/Receipts.tsx`, `landlord/Receipts.tsx`, `regulator/RegulatorReceipts.tsx`, and any inline use in `RequestComplaintPaymentDialog.tsx` confirmation — by keeping the API of `<PaymentReceipt />` the same; only its internal print/export logic changes.

### Files touched

- `src/components/RegulatorLayout.tsx` — split Main Admin vs Sub Admin filter logic; always allow `dashboard`.
- `src/components/ProtectedRoute.tsx` (or new `src/components/FeatureGuard.tsx`) — block direct URLs when feature isn't in `allowedFeatures` for Sub Admins.
- `src/components/PaymentReceipt.tsx` — rewrite `handlePrint` to render a self-contained print document with inline CSS + QR data-URL; add `handleDownloadPdf` using `jsPDF`.

### Out of scope / unchanged

- `invite-staff` edge function (already stores `allowedFeatures` correctly).
- `admin_staff` schema and RLS.
- `useAdminProfile` (already exposes `allowedFeatures` / `mutedFeatures`).
- The receipt's data sources, complaint-basket fetch, and on-screen layout stay identical.


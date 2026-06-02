# Fix: Header transparency causing search box overlap on desktop

## Root cause
The top app header (`.glass-header`) is only 45% opaque with a backdrop blur. When the page scrolls, the unassigned rent card list passes *behind* the header, making the "Filter by Landlord ID, Name, or Purchase ID…" search input look like it's being covered by the list. It's not actually covered — the content is just visible through the translucent header.

This affects desktop more than mobile because on mobile the header content is narrower and the list rarely sits directly behind the input.

## Change

In `src/index.css`, update `.glass-header` to be effectively opaque so scrolled content no longer shows through:

- Increase background opacity from `0.45` → `0.96`
- Keep a light backdrop blur for polish, but it no longer matters visually
- Strengthen the bottom border so the header reads as a distinct surface

```css
.glass-header {
  background-color: rgba(255, 255, 255, 0.96);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  backdrop-filter: blur(16px) saturate(180%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}
```

That's the only change. It applies globally to all layouts (Regulator, Landlord, Tenant) so any other page with the same "content scrolling through header" issue is fixed at the same time. No component logic touched.

## Scope
- File: `src/index.css` (one rule)
- No changes to `PendingPurchases.tsx`, layouts, or assignment logic.

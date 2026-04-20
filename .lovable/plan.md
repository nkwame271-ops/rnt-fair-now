

## Fix — Chat widget pushing layout / creating empty space

### Root cause
The chat panel inside `FloatingActionHub` and the standalone `LiveChatWidget` on the landing page rely on a parent `fixed` wrapper. In some mounting contexts (RoleSelect's React fragment, layouts with `transform`/`overflow` ancestors), `position: fixed` can be neutralized or the inner panel's `min-h`/`h-[520px]` can interact with the document flow on mobile, producing extra bottom space.

### Fix (CSS + portal — no logic change)

**1. Render `FloatingActionHub` panels in a React Portal to `document.body`**
Use `createPortal` so the chat/feedback panels are appended to `<body>` directly — guaranteed out of flow regardless of where the layout mounts the hub. The FAB stays where it is.

**2. Make `LiveChatWidget` always `fixed` when open (kill the conditional)**
Currently line 229: `${onClose ? '' : 'fixed bottom-6 right-6 z-50'}`. When mounted inside FloatingActionHub the wrapper relies on the parent. Change so the panel is `position: fixed` always — anchored `bottom-20 right-4` (above the FAB) when used as a hub child, or `bottom-6 right-6` standalone. Pass an `anchored` prop or simply always fix the panel and remove the parent flex stacking.

**3. Same fix for `BetaFeedbackWidget`** — apply the identical positioning rule.

**4. Defensive containment**
Add to the panel root: `contain: layout` and explicit `max-height: calc(100dvh - 6rem)` (use `dvh` not `vh` so the iOS dynamic viewport doesn't push content). This eliminates the bottom whitespace artifact on iOS Safari when the URL bar collapses.

**5. Restructure `FloatingActionHub`**
- FAB stays in a small `fixed bottom-4 right-4` wrapper
- Menu pills stay in that wrapper (they are small)
- Panels (chat / feedback) move out to a portal, each as its own `fixed bottom-20 right-4` element, sized `w-[min(370px,calc(100vw-2rem))] h-[min(520px,calc(100dvh-7rem))]`
- No more `flex flex-col items-end` stacking the giant panel with the FAB

### Files touched (3, surgical)

- `src/components/FloatingActionHub.tsx` — add portal, split FAB wrapper from panel rendering
- `src/components/LiveChatWidget.tsx` — always-fixed panel, `dvh` height, `contain: layout`
- `src/components/BetaFeedbackWidget.tsx` — same treatment

### Out of scope
Data, routes, auth, Paystack, RLS, panel content, animations. Visual size/look unchanged.


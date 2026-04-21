
## Fix LiveChatWidget desktop positioning

The chat widget currently renders bottom-left and too wide on desktop because its outer container uses `max-sm:inset-x-0` (which leaks `left: 0` / `right: 0` at desktop sizes through Tailwind's responsive cascade is not the issue — the real issue is the widget is rendered inside `FloatingActionHub`'s `motion.div` wrapper, which is portaled to `document.body` but inherits no positioning, AND the widget's own `sm:` classes set `sm:bottom-20 sm:right-4` only when `onClose` is passed). The widget needs explicit, isolated fixed positioning that ignores its parent wrapper.

### Change — `src/components/LiveChatWidget.tsx` only

Replace the outer container's className/style on the floating panel (the `<div>` with `style={{ contain: "layout" }}`) so it uses the exact spec values:

**Desktop (≥768px):**
- `position: fixed`
- `bottom: 24px`, `right: 24px`
- `width: 360px`, `max-width: calc(100vw - 48px)`
- `height: 520px`, `max-height: calc(100vh - 120px)`
- `border-radius: 16px`
- `box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.10)`
- `overflow: hidden`
- `z-index: 9999`

**Mobile (<768px):**
- `position: fixed`
- `bottom: 0`, `left: 0`, `right: 0`
- `width: 100vw`, `height: 70vh`
- `border-radius: 20px 20px 0 0`

Implementation: use a `useIsMobile()` check (already exists at `src/hooks/use-mobile.tsx`) to switch the inline style object between desktop and mobile specs. Inline `style` overrides any inherited Tailwind classes from the parent `motion.div` wrapper in `FloatingActionHub`, guaranteeing the widget floats correctly regardless of where it's mounted.

Also drop the conditional `sm:bottom-20 sm:right-4` offset tied to `onClose` — the spec wants a fixed 24px offset always.

### What is NOT changing

- No changes to `FloatingActionHub.tsx` (the portal + AnimatePresence wrapper stays).
- No changes to chat logic, AI calls, realtime subscriptions, message rendering, FAQ chips, escalation, or input handling.
- Header, messages area, and input bar internal layout untouched.
- No other files modified.

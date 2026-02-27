

## Plan: 3 Items

### 1. Fix Blank Landing Page
**Problem**: `RoleSelect.tsx` content was corrupted — the entire JSX body was replaced with literal `...` text. The file needs to be fully restored with the About Us section, hero, role cards, and footer.

**Files**: `src/pages/RoleSelect.tsx` — rewrite with complete landing page content (hero section with background image, coat of arms, About Us section replacing old stats, role selection cards for Tenant/Landlord/Regulator, footer).

---

### 2. Replace LiveChatWidget with AI-First Contact Us Widget
**Problem**: Current `LiveChatWidget` goes straight to human support. User wants an AI chatbot first that handles FAQs about Act 220 and rent control, then offers to connect to a live agent if the issue is beyond FAQ scope.

**Changes**:
- Rewrite `LiveChatWidget.tsx` to start in **AI mode** — uses the existing `legal-assistant` edge function to answer questions
- AI greeting: "Hi! I'm the Rent Control Assistant. Ask me about tenant rights, rent laws, or complaints."
- Add suggested quick questions (FAQ chips)
- When AI detects the issue needs human help, or user clicks "Talk to an Agent", switch to **live agent mode** — creates a `support_conversation` and switches to the existing real-time chat flow
- Both modes share the same floating widget UI
- Create a new edge function `contact-assistant` (or extend `legal-assistant`) with a system prompt that includes FAQ knowledge AND a tool call / structured response to detect when to escalate

**Edge function**: `supabase/functions/contact-assistant/index.ts` — similar to `legal-assistant` but with an escalation detection prompt. Returns `{ reply, escalate: boolean }`.

**Files**: `src/components/LiveChatWidget.tsx`, `supabase/functions/contact-assistant/index.ts` (new), `supabase/config.toml` (add function entry)

---

### 3. Push Notifications (Browser + Mobile)
**Problem**: No notification system exists.

**Changes**:
- Create a `notifications` table: `id`, `user_id`, `title`, `body`, `read`, `link`, `created_at` with RLS
- Add a notification bell icon in all layout headers (TenantLayout, LandlordLayout, RegulatorLayout) showing unread count badge
- Dropdown panel listing recent notifications with mark-as-read
- Use browser `Notification API` to request permission and show desktop/mobile push notifications when new realtime events arrive (new support message, complaint update, payment due, viewing request)
- Subscribe to `notifications` table via Supabase Realtime for live updates

**Files**: Migration SQL, `src/components/NotificationBell.tsx` (new), `src/components/TenantLayout.tsx`, `src/components/LandlordLayout.tsx`, `src/components/RegulatorLayout.tsx`

---

### Implementation Order
1. Fix blank landing page (critical — app is broken)
2. AI-first Contact Us widget
3. Notification system with browser push


## 1. Landlord — Add Property: Mandatory Unit

**File:** `src/pages/landlord/RegisterProperty.tsx`

Add validation in `handleSubmit` (before the duplicate check, ~line 170) for the standard (non-hostel) branch:

- Single-unit: require the one auto-created unit to have `name`, `type`, and a numeric `rent > 0`.
- Multi-unit: require `units.length >= 1` AND every unit to have `name`, `type`, `rent > 0`.

If validation fails, show a toast (`"At least one unit with name, type, and rent is required before registering"`) and abort.

Also visually surface the requirement: add a subtle "Required" hint at the top of the Units card and disable the Register button when no valid unit exists.

## 2. Admin — Properties: Show Landlord in View Dialog

**File:** `src/pages/regulator/RegulatorProperties.tsx`

- Update `openDetail` (line 83) to also fetch the landlord's profile and landlord record:
  - From `profiles`: `full_name`, `phone`, `email` by `user_id = p.landlord_user_id`.
  - From `landlords`: `landlord_id` (the human-readable code) by `user_id`.
  - Store on a new `detailLandlord` state.
- In the detail dialog (around line 584), add a new "Registered by" section above the Units block showing:
  - Landlord name
  - Landlord ID/code
  - Phone (click-to-call) and email (mailto link)

## 3. Admin — Contact Messages: Reply System

### Database (migration)
Add a new table `contact_message_replies`:
- `id uuid PK default gen_random_uuid()`
- `submission_id uuid references contact_submissions(id) on delete cascade`
- `replied_by uuid references auth.users(id)`
- `channel text` ('email' | 'sms')
- `subject text`
- `body text not null`
- `template_used text`
- `created_at timestamptz default now()`

Add columns to `contact_submissions`: `last_replied_at timestamptz`, `reply_count int default 0`.

RLS: only `is_main_admin(auth.uid())` can insert/select. A trigger updates `contact_submissions.status='replied'`, increments `reply_count`, and sets `last_replied_at` after each insert.

Also add a table `contact_reply_templates` (id, name, subject, body, channel, created_by, updated_at) seeded with 4 default templates:
1. **Welcome / Create Account** — invites them to sign up.
2. **File a Complaint** — guides to register then file a complaint.
3. **Register a Property** — guides landlord onboarding.
4. **General Follow-up** — neutral acknowledgement.

### Edge Function
New function `supabase/functions/contact-reply/index.ts`:
- Verifies caller is main admin via JWT.
- Input: `{ submission_id, channel: 'email'|'sms', subject?, body, template_used? }`.
- Sends via existing `send-notification` (email through Resend) or `send-sms` (Arkesel) infrastructure.
- Inserts into `contact_message_replies`.

### Frontend
**File:** `src/pages/regulator/RegulatorFeedback.tsx`

- Add a **Reply** button on each contact card.
- Opens a dialog containing:
  - Template selector (loads from `contact_reply_templates`).
  - Channel selector (Email default; SMS option if phone present).
  - Editable subject + body (pre-filled from selected template, with `{{name}}` replaced).
  - Send button → invokes `contact-reply` edge function.
- Below each contact: collapsible "Reply history" listing all prior replies with timestamp, channel, admin name.
- Update status badge: "New" / "Read" / "Replied".

## Technical Notes

- Reuse existing `send-notification` and `send-sms` patterns (no new secrets).
- Templates support simple `{{name}}` token substitution client-side before send.
- Existing `markContactRead` is preserved; a successful reply auto-marks as replied via the DB trigger.

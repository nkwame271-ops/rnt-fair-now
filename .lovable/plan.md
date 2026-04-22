

## SMS Broadcast — fix non-2xx errors + add per-user targeting

### 1. Root cause of "non-2xx status code"

`admin-sms-broadcast` sends SMS in a sequential `for` loop with one HTTP `fetch` to Arkesel per recipient. With even ~100 phone numbers this routinely exceeds the edge function wall-clock limit, the runtime kills the function, and the client sees a generic non-2xx error with no body.

A second contributor: when anything throws (missing `ARKESEL_API_KEY`, audit-log insert fails, claims check fails), the response is a bare `500` with `{ error: "..." }` — the supabase-js client treats that as "Edge function returned a non-2xx status code" and the actual `error` message never reaches the toast.

### 2. Edge function rewrite (`admin-sms-broadcast/index.ts`)

- **Always return `200`** with `{ ok: boolean, error?: string, sent, failed, total, failures? }`. Frontend reads `ok` to decide success vs. error toast — matches the structured-response pattern from the troubleshooting docs.
- **Batch + parallelize sends**: chunk recipients in groups of 25, `Promise.allSettled` per chunk, hard cap of 1,500 recipients per invocation. Returns within seconds even for full-platform broadcasts.
- **Per-recipient failure tracking**: collect up to 10 failure samples (`{ phone, reason }`) so the UI can surface concrete error reasons (invalid number, Arkesel rejection, etc.).
- **New action `search-users`**: payload `{ action: "search-users", q: string, limit?: number }`. Server does a single query against `profiles` joined to `user_roles`, matching `q` (case-insensitive) on `full_name`, `phone`, `email`, or exact `user_id`. Returns `[{ user_id, full_name, phone, email, role }]`, capped at 25. Phone presence is required.
- **New action `send-broadcast` payload extension**: optional `userIds: string[]` (max 200). When present, the recipient list is restricted to those users (intersected with any role filter). When absent, behaviour is unchanged (all users / tenants / landlords).
- **Audit log entry** records the targeting mode (`all`, `tenants`, `landlords`, or `selected:N`) so super-admin oversight stays intact.
- Keep `verify_jwt = false` (already set in `config.toml`) and continue validating with `getClaims` + `user_roles.role = 'regulator'` server-side.

### 3. Frontend updates (`src/pages/regulator/SmsBroadcast.tsx`)

Add a new **"Send Settings → Recipients"** mode switcher with three options:

```text
( ) Audience      — All / Tenants / Landlords         (existing)
( ) Specific users — search & pick individuals         (new)
```

When **Specific users** is selected:

- Search input (`Search by name, phone, email, or user ID…`) with 250 ms debounce calls `admin-sms-broadcast` action `search-users`.
- Results render as a list of selectable rows showing name · phone · role badge.
- Picked users appear as removable chips above the search box. Hard cap: 50 selected users (UI-enforced, server enforces 200).
- Counter line updates: `Sending to 7 selected user(s) · ~7 SMS segments`.
- The existing audience dropdown is hidden in this mode.

When sending:

- If specific users are picked, call edge function with `{ action: "send-broadcast", message, userIds: [...] }`.
- Otherwise call as before with `recipientFilter`.
- Read `data.ok` and show `data.error` (or per-recipient `failures[]` summary in a follow-up toast) when the broadcast partially or wholly fails — no more opaque "non-2xx" message.

The Schedule-for-later toggle and template picker continue to work in both modes.

### 4. Files touched

- `supabase/functions/admin-sms-broadcast/index.ts` — structured 200 responses, batched parallel sends, `search-users` action, `userIds` targeting, failure samples.
- `src/pages/regulator/SmsBroadcast.tsx` — recipient mode switcher, debounced user search, selected-user chips, structured-error handling.

### Out of scope / unchanged
- `send-sms`, `bulk-welcome-sms`, `useAuth`, SMS templates, Arkesel credentials, audit-log schema, RLS.
- Region-based filtering (still a future enhancement — the search-users path covers the practical "I want to message a specific landlord" need).


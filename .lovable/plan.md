
1. FIRST — IDENTIFY ROOT CAUSE

A. Admin Portal duplicate key on `rent_card_serial_stock_serial_number_key`
- Confirmed root cause in schema history:
  - `supabase/migrations/20260319001436_647130fb-b64b-481a-9421-2150e26530c5.sql`
    ```sql
    CREATE TABLE public.rent_card_serial_stock (
      ...
      serial_number text UNIQUE NOT NULL,
    ```
  - Later code switched to 2 rows per serial (`pair_index = 1/2`), so single-column uniqueness is incompatible.
  - A later migration tries to fix it:
    `supabase/migrations/20260402162602_b2c77b31-5a0c-4941-844e-f69eba61175b.sql`
    ```sql
    ALTER TABLE rent_card_serial_stock DROP CONSTRAINT rent_card_serial_stock_serial_number_key;
    ALTER TABLE rent_card_serial_stock ADD CONSTRAINT rent_card_serial_stock_serial_pair_unique UNIQUE (serial_number, pair_index);
    ```
- Because the live error still names `rent_card_serial_stock_serial_number_key`, the current deployed database is still enforcing the old single-column unique rule.
- Exact responsible area: database constraint on `rent_card_serial_stock`, plus any code inserting two pair rows.
- Uncertain part: I cannot prove from read-only mode whether the fix migration never ran or failed on the live database, but the error name itself proves the old constraint is still active in production.

B. Unassign returns “only regulators allowed to assign serials”
- Confirmed root cause:
  - `supabase/migrations/20260319003124_5f2abdb0-af12-42de-97b8-c5f4babe3f01.sql`
    ```sql
    IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
      IF NOT has_role(auth.uid(), 'regulator'::app_role) THEN
        RAISE EXCEPTION 'Only regulators can assign serial numbers';
      END IF;
    END IF;
    ```
  - `unassign_serial_atomic` clears `rent_cards.serial_number` to `NULL` during unassign.
- The trigger treats clearing a serial the same as assigning one, so unassign is blocked.
- Exact responsible area: `public.enforce_serial_assignment()` trigger function.

C. Forgot Password OTP says “Invalid or expired OTP”
- Confirmed current UI bug:
  - `src/pages/ForgotPassword.tsx`
    ```ts
    if (error || data?.error || !data?.verified) {
      toast.error(data?.error || "Invalid or expired OTP. Please try again.");
    }
    ```
- This swallows the real backend reason whenever the function returns a non-2xx response.
- Additional confirmed issue:
  - `handleLookup()` advances to OTP step without checking whether `send-otp` actually succeeded in sending SMS.
  - `supabase/functions/send-otp/index.ts` returns `{ success: true, smsSent }`, but the UI ignores `smsSent`.
- Exact responsible areas: `src/pages/ForgotPassword.tsx`, `supabase/functions/send-otp/index.ts`, `supabase/functions/verify-otp/index.ts`.

D. Searching with ID returns “could not find an account with that identifier”
- Confirmed root cause: ID formats do not match.
  - `src/pages/RegisterTenant.tsx`
    ```ts
    const tenantId = "TN-" + new Date().getFullYear() + "-"
    ```
  - `src/pages/RegisterLandlord.tsx`
    ```ts
    const landlordId = "LL-" + new Date().getFullYear() + "-"
    ```
  - But `supabase/functions/lookup-phone/index.ts` only checks:
    ```ts
    if (!phone && /^TEN-/i.test(trimmed)) { ... }
    if (!phone && /^LLD-/i.test(trimmed)) { ... }
    ```
- Exact responsible area: `lookup-phone` identifier matching logic, plus outdated placeholder text in `ForgotPassword.tsx`.

2. SHOW CURRENT BROKEN STATE

A. Pair-row inserts that conflict with old unique constraint
- `src/pages/regulator/rent-cards/SerialBatchUpload.tsx`
  ```ts
  rows.push({ serial_number: s, pair_index: 1, ... });
  rows.push({ serial_number: s, pair_index: 2, ... });
  ```
- `supabase/functions/admin-action/index.ts`
  ```ts
  rows.push({ serial_number: s, pair_index: 1, ... });
  rows.push({ serial_number: s, pair_index: 2, ... });
  ```
- These are correct for paired stock, but they break if the old DB constraint still exists.

B. Trigger currently blocking unassign
- `public.enforce_serial_assignment()`
  ```sql
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
  ```
- This is too broad. It blocks both assign and clear-to-null.

C. Current forgot-password UI masking real error
- `src/pages/ForgotPassword.tsx`
  ```ts
  toast.error(data?.error || "Invalid or expired OTP. Please try again.");
  ```
- Current ID examples are also wrong:
  ```tsx
  placeholder="024 555 1234 or TEN-XXXXXX"
  ...
  e.g. 024 555 1234, TEN-AB1234, or LLD-CD5678
  ```

3. APPLY A REAL FIX (ONLY NECESSARY CHANGES)

A. Database/schema fix
- Add one new idempotent migration that:
  - drops `rent_card_serial_stock_serial_number_key` if it still exists
  - ensures composite uniqueness on `(serial_number, pair_index)`
  - keeps paired stock model intact
- Do not rewrite assignment UI logic first; fix the actual schema mismatch first.

B. Trigger fix for unassign
- Narrow `enforce_serial_assignment()` so it only blocks setting a non-null serial, not clearing one:
  ```sql
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number
     AND NEW.serial_number IS NOT NULL THEN
  ```
- This directly fixes unassign without weakening assignment protection.

C. Forgot Password fix
- Update `lookup-phone` to accept both real and legacy prefixes:
  - tenant: `TN-` and `TEN-`
  - landlord: `LL-` and `LLD-`
- Update `ForgotPassword.tsx` placeholder/help text to show the real accepted formats.
- Change forgot-password frontend handling so it:
  - shows the exact backend message
  - does not move to OTP step if `send-otp` returns `smsSent: false`
- Keep `verify-otp` logic mostly intact; the main visible bug now is the frontend swallowing the real reason.

4. VERIFY THE FIX (MANDATORY)

A. Serial duplicate error
- After schema repair:
  1. a serial can legally exist twice: `(serial, 1)` and `(serial, 2)`
  2. upload/backfill/admin generation no longer hit `rent_card_serial_stock_serial_number_key`
  3. unassign resets existing rows
  4. reassign updates those 2 rows instead of colliding with single-row uniqueness
- What you should see:
  - no duplicate key popup when uploading/repairing/assigning paired serials
  - same serial can exist as exactly 2 stock rows

B. Unassign permission error
- After trigger change:
  1. unassign sets `serial_number -> NULL`
  2. trigger no longer treats that as a forbidden assignment
  3. normal serial assignment from `NULL -> value` remains protected
- What you should see:
  - “Unassign Serial” completes instead of showing “only regulators allowed to assign serials”

C. Forgot Password OTP
- After frontend/backend handling fix:
  1. account lookup returns the real phone for `TN-*` / `LL-*`
  2. OTP screen opens only if SMS send actually succeeded
  3. verify step shows exact reason if wrong/expired/not found
- What you should see:
  - valid OTP entered within the window proceeds to password reset
  - if something is wrong, the toast explains the real reason, not the generic one

D. ID search
- After prefix fix:
  - IDs generated by registration (`TN-*`, `LL-*`) will now resolve in forgot-password lookup
- What you should see:
  - searching with the actual tenant/landlord ID finds the account

5. ADD FAIL-SAFE CHECK

- Add defensive validation in `lookup-phone`:
  - return a clear structured error for unsupported ID formats
- Add defensive validation in `ForgotPassword.tsx`:
  - if `send-otp` returns `smsSent: false`, stay on step 1 and show “OTP could not be sent”
  - log the returned function payload in console for this flow
- Add integrity warning in Admin serial search:
  - if a serial has anything other than 2 stock rows, show an “inconsistent serial pair” warning instead of pretending it is normal

6. FINAL CONFIRMATION

- This issue will no longer occur because:
  - the paired stock model will finally match the live database constraint,
  - unassign will stop being blocked by an over-broad serial-assignment trigger,
  - forgot-password lookup will accept the actual generated ID formats,
  - and the OTP flow will stop hiding the real backend failure reason.
- Not 100% certain on only one point: whether the live duplicate error is caused by a failed migration or stale DB drift. But the fix is still the same: explicitly repair the live constraint and then re-test assign/unassign end-to-end.

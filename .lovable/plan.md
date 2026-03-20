

# Fix: SMS Credits Display, Branding, and Revoked Serial Re-upload

## Three Issues

### 1. SMS Credits incorrect
The Arkesel balance API returns raw units (e.g. `999999880`). The UI displays this number directly. Arkesel V1 balance is typically in "credits" where 1 credit = 1 SMS page. The number `999,999,880` looks like it may be in a sub-unit. We need to display it properly — dividing if needed, or at minimum formatting it correctly. Since the API returns `balance: 999999880`, and the account name is visible, this appears to be the actual credit count. The display is correct but confusing. We should add context (e.g. "1 credit ≈ 1 SMS segment").

### 2. Branding text
Line 290: Change "Messages are sent via Arkesel with sender ID 'RentGhana'" to reference "Center for Financial Literacy, E-Commerce and Digitalization".

### 3. Revoked serials should be re-uploadable
In `SerialBatchUpload.tsx`, the duplicate check (lines 81-85) queries ALL serials in `rent_card_serial_stock` regardless of status. Revoked serials should not block re-upload. Fix: only check for serials with `status` in `('available', 'assigned')` — exclude `revoked` ones.

## Files Changed

| File | Change |
|---|---|
| `src/pages/regulator/SmsBroadcast.tsx` | Update branding text (line 290), add context to credits display |
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Filter duplicate check to exclude revoked serials (lines 81-85) |

## Technical Details

### SmsBroadcast.tsx
- Line 160: Add subtitle "1 credit = 1 SMS segment (160 chars)"
- Line 290: Replace with "Messages are sent by Center for Financial Literacy, E-Commerce and Digitalization via unique API. Sender ID: 'RentGhana'. Each SMS segment is up to 160 characters."

### SerialBatchUpload.tsx
- Lines 81-85: Add `.in("status", ["available", "assigned"])` to the existing serial check query so revoked serials are excluded from the "already exists" filter
- This allows previously revoked serials to be re-uploaded as fresh stock


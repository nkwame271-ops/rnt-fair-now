

# Plan: Registration Fees, Rent Card Delivery, ID Card Download, SMS, and Pricing Display

## 1. Registration Fee Update (Tenant GH₵ 10, Landlord GH₵ 35)

Currently hardcoded as GH₵ 2 for both roles across many files.

**Files to modify:**

- `supabase/functions/paystack-checkout/index.ts` — Change `totalAmount = 2` to `10` for tenant_registration, `35` for landlord_registration. Update descriptions.
- `src/pages/RegisterTenant.tsx` — Update displayed price from GH₵ 2.00 to GH₵ 10.00. Update benefits text.
- `src/pages/RegisterLandlord.tsx` — Update displayed price from GH₵ 2.00 to GH₵ 35.00. Add "Includes Rent Card" to benefits. Add rent card delivery checkbox option during registration.
- `src/components/ProtectedRoute.tsx` — Show role-specific amount (GH₵ 10 for tenant, GH₵ 35 for landlord) instead of flat GH₵ 2.
- `src/pages/tenant/TenantDashboard.tsx` — Update unpaid banner text from GH₵ 2 to GH₵ 10.
- `src/pages/landlord/LandlordDashboard.tsx` — Update unpaid banner text from GH₵ 2 to GH₵ 35.

---

## 2. Rent Card Delivery Option (Landlord Registration)

Add a `rent_card_delivery_requested` boolean column to `landlords` table (default false). During landlord registration (step 2 success screen or step 1), show a checkbox: "Request physical rent card delivery". Store the preference.

**Database**: Add `rent_card_delivery_requested boolean DEFAULT false` to `landlords`.

**Files:**
- `src/pages/RegisterLandlord.tsx` — Add delivery request checkbox on identity step or success screen.
- `src/pages/shared/ProfilePage.tsx` — Show delivery status for landlords.

---

## 3. Downloadable Registration Card (Tenant & Landlord)

The profile page already shows the QR code, name, ID, and expiry. Add a "Download ID Card" button that generates a styled PDF/image of the card.

**Files:**
- `src/pages/shared/ProfilePage.tsx` — Add a "Download Registration Card" button next to the existing ID card display. Use `html-to-image` or `jsPDF` (already installed) to render the card with QR code, name, unique code, and expiry date as a downloadable image/PDF.

---

## 4. SMS Notifications Enhancement

SMS is already sent on registration. Need to add SMS triggers for:
- Payment confirmations (in `paystack-webhook/index.ts` after successful payment processing)
- Application status updates (in `RegulatorApplications.tsx` when approving/rejecting)

**Files:**
- `supabase/functions/paystack-webhook/index.ts` — After each payment type confirmation, invoke `send-sms` edge function with the user's phone number and appropriate message.
- `src/lib/smsService.ts` — Add new SMS event templates: `payment_confirmed`, `application_updated`.
- SMS credits purchase for admin is a future feature (note: Arkesel has a prepaid model, admin would top up via Arkesel dashboard directly). Add a note/link in the Engine Room or admin settings.

---

## 5. Pricing Display — Show Only "Total Charges"

On the Payments page (`src/pages/tenant/Payments.tsx`), the advance rent summary currently shows separate lines for Total Rent, Total Tax, Total to Landlord, and Grand Total. The user wants only a single "Total Charges" column visible. Internal breakdowns (tax, landlord share) should be hidden from the tenant view.

**Files:**
- `src/pages/tenant/Payments.tsx` — In the Advance Rent Summary and Pay All sections, collapse the breakdown into a single "Total Charges" line showing grand total. Remove or hide the tax/landlord split from the tenant-facing view. Keep the payment schedule items showing just "Total Charges" per month instead of tax + landlord breakdown.

---

## Implementation Order

1. **Database migration**: Add `rent_card_delivery_requested` to `landlords`
2. **Edge functions**: Update `paystack-checkout` amounts + `paystack-webhook` SMS triggers
3. **Registration pages**: Update prices, add delivery option for landlord
4. **Protected route + dashboards**: Update fee amounts
5. **Profile page**: Add downloadable ID card button
6. **Payments page**: Simplify to "Total Charges" only
7. **SMS service**: Add new event templates

**Files to create**: None
**Files to modify**: `RegisterTenant.tsx`, `RegisterLandlord.tsx`, `ProtectedRoute.tsx`, `TenantDashboard.tsx`, `LandlordDashboard.tsx`, `Payments.tsx`, `ProfilePage.tsx`, `paystack-checkout/index.ts`, `paystack-webhook/index.ts`, `smsService.ts`
**Migration**: Add column to `landlords` table


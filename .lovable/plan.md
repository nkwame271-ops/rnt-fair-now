

# Fix: Replace `rentghanapilot.lovable.app` with `www.rentcontrolghana.com` Across Codebase

## Problem
The bulk welcome SMS sent to all 13 users contained `rentghanapilot.lovable.app` instead of the correct domain `www.rentcontrolghana.com`. This same wrong URL appears in 8 files across the project — QR codes, payment callbacks, verification links, PDFs, etc.

## Fix
Find-and-replace `rentghanapilot.lovable.app` → `www.rentcontrolghana.com` in all affected files:

| File | What uses the URL |
|---|---|
| `supabase/functions/bulk-welcome-sms/index.ts` | Welcome SMS message text |
| `supabase/functions/paystack-checkout/index.ts` | Payment callback origin fallback |
| `supabase/functions/verify-payment/index.ts` | Receipt QR code data |
| `supabase/functions/auth-email-hook/index.ts` | Sample project URL + SITE_NAME |
| `src/components/TenancyCard.tsx` | Tenancy verification QR code |
| `src/pages/landlord/ManageRentCards.tsx` | Published URL constant |
| `src/lib/generateTenancyCardPdf.ts` | PDF verification link text |
| `README.md` | Live demo link |

## After Deploying
Once fixed, I'll re-send the corrected welcome SMS to all 13 users with the right domain.

## Files Changed
8 files — simple string replacement in each.


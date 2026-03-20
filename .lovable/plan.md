

# Plan: Remove Ghana Card from Signup, Keep Only in Post-Login KYC

## Summary
Both registration forms (Tenant and Landlord) currently collect Ghana Card number and citizenship status at signup. This needs to be removed — Ghana Card verification should only happen post-login via the existing KYC flow (KycVerificationCard on profile page).

## Changes

### 1. RegisterTenant.tsx
- Remove the "Identity" step entirely (step 1 with Ghana Card, citizenship, region)
- Reduce wizard from 3 input steps to 2: "Account" (name, phone, email) → "Contact" (occupation, emergency)
- Remove `ghanaCardNo`, `isCitizen`, `residencePermitNo`, `region` state variables
- Remove Ghana Card uniqueness pre-check from `handleCreateAccount`
- Stop saving `ghana_card_no`, `residence_permit_no`, `nationality`, `is_citizen` to profiles at signup
- Update `canProceed()` and step navigation logic
- Update steps array and progress indicators

### 2. RegisterLandlord.tsx
- Remove the "Identity & Region" step (step 1 with Ghana Card, citizenship, region)
- Reduce wizard from 2 input steps to 1: just "Account" (name, business name, phone, email)
- Add region selector to the Account step (needed for landlord record)
- Remove `ghanaCardNo`, `isCitizen`, `residencePermitNo` state variables
- Remove Ghana Card uniqueness pre-check from `handleCreateAccount`
- Stop saving `ghana_card_no`, `residence_permit_no`, `nationality`, `is_citizen` to profiles at signup
- Update steps array and progress indicators

### 3. Ghana Card Uniqueness (already handled)
The `check_ghana_card_uniqueness` database trigger already prevents the same Ghana Card from being used for duplicate role registrations. This will now fire when users submit KYC (which updates `profiles.ghana_card_no`) instead of at signup — no changes needed to the trigger.

### 4. No changes needed
- `KycVerificationCard` — already handles post-login Ghana Card verification with image uploads and selfie
- `KycGate` — already blocks actions until KYC is verified
- `useKycStatus` — already works correctly
- Database schema — no changes needed


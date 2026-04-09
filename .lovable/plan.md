

# Fix: Restore `www.rentcontrolghana.com` as the canonical domain

## What happened
During the QR verification fix, I incorrectly replaced your custom domain (`www.rentcontrolghana.com`) with the default Lovable domain (`rentghanapilot.lovable.app`) in 3 files. Your custom domain is the correct one and should be used everywhere.

## Changes (3 files)

### 1. `src/lib/generateTenancyCardPdf.ts` (line 81)
Change URL back to:
```
Verify: www.rentcontrolghana.com/verify-tenancy/{tenancyId}
```

### 2. `src/lib/generateAgreementPdf.ts` (lines 119-121)
Change QR URL back to:
```typescript
const verifyUrl = data.tenancyId
  ? `https://www.rentcontrolghana.com/verify-tenancy/${data.tenancyId}`
  : `https://www.rentcontrolghana.com/verify-tenancy/${data.registrationCode}`;
```

### 3. `src/pages/landlord/DeclareExistingTenancy.tsx` (line 373)
Change SMS link back to:
```
...register at https://www.rentcontrolghana.com to view...
```

No other files are affected — the rest of the codebase already uses `www.rentcontrolghana.com` correctly.


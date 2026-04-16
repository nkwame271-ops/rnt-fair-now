

# Plan: SMS on Scheduling + Downloadable Profile from Complaint View

## Changes

### 1. SMS with Schedule Details
**File: `src/components/ScheduleComplainantDialog.tsx`**
- Add `complaintCode` and `officeName` to Props interface
- Update the SMS message sent via `sendNotification` to include specific slot dates/times and the office name
- Format: "RentGhana: Appointment scheduled for complaint [CODE]. Date: [DATE], Time: [TIME_START]-[TIME_END] at [OFFICE_NAME] Office, Rent Control Department. Log in to confirm."
- When multiple slots are offered, list all options in the SMS

**File: `src/pages/regulator/RegulatorComplaints.tsx`**
- Pass `complaintCode` and office name to `ScheduleComplainantDialog` when opening it (complaint has `office_id`, resolve to office name)
- Fetch office names for complaints to display and pass through

### 2. SMS on Slot Confirmation
**File: `src/components/AppointmentSlotPicker.tsx`**
- After user confirms a slot, send an SMS to the complainant with the confirmed date, time, and office
- Fetch the complaint's `office_id` → resolve to office name
- Also notify the admin (in-app notification) that the slot has been confirmed

### 3. Downloadable Profile from Complaint View (Admin Portal)
**File: `src/pages/regulator/RegulatorComplaints.tsx`**
- Add a "Download Profile" button in the expanded complaint details section (for both tenant and landlord complaints)
- For tenant complaints: fetch full tenant profile data (profile, KYC, tenancies, complaints) and call `generateProfilePdf`
- For landlord complaints: fetch full landlord profile data (profile, KYC, properties, tenancies) and call `generateProfilePdf`
- The existing `generateProfilePdf` function already handles both tenant and landlord profiles with all relevant data

### 4. Downloadable Profile from Complaint View (Tenant & Landlord Portals)
- Not applicable — tenants/landlords can already access their own profiles. The downloadable profile attachment is specifically for admin verification purposes.

## Technical Details

**ScheduleComplainantDialog SMS enhancement:**
```typescript
// Build detailed SMS with all offered slots
const slotDetails = validSlots.map(s =>
  `${new Date(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${s.time_start}-${s.time_end}`
).join(", ");

const smsMessage = `RentGhana: Appointment for complaint ${complaintCode}. Available slots: ${slotDetails}. Visit: ${officeName} Office. Log in to select your preferred time.`;
```

**Profile download button in expanded complaint:**
```typescript
<Button variant="outline" size="sm" onClick={() => downloadComplainantProfile(c)}>
  <Download className="h-4 w-4 mr-1" /> Download Profile
</Button>
```

## Files to Modify
1. `src/components/ScheduleComplainantDialog.tsx` — add office/code props, enhance SMS content
2. `src/components/AppointmentSlotPicker.tsx` — send SMS on slot confirmation
3. `src/pages/regulator/RegulatorComplaints.tsx` — pass new props, add profile download button with PDF generation logic


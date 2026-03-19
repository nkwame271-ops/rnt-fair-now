

# Fix: Rent Card Status Not Updating After Serial Assignment

## Problem
When a regulator assigns a serial number to a rent card in the Admin Portal, the card status does not change to "Available" (i.e., `valid`) in the Landlord Portal.

**Root cause**: The `rent_cards` table has no UPDATE policy for regulators. It only has:
- `Landlords manage own rent cards` (ALL, scoped to `landlord_user_id`)
- `Regulators read all rent cards` (SELECT only)
- `Service role manages rent cards` (ALL)

When the regulator calls `.update()` on `rent_cards`, the RLS silently blocks it — 0 rows are updated, no error is thrown. The card stays as `awaiting_serial`.

## Fix

### Step 1: Add RLS policy for regulator updates on rent_cards
Create a database migration adding an UPDATE policy:

```sql
CREATE POLICY "Regulators can update rent cards"
ON public.rent_cards
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role))
WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
```

This allows regulators to update rent card rows (setting serial_number and status) while maintaining security — only authenticated users with the `regulator` role can perform updates.

### Step 2: Add error handling in PendingPurchases.tsx
The current code doesn't check whether the update actually succeeded. Add a check after each update to catch silent failures:

```typescript
const { error: updateErr } = await supabase
  .from("rent_cards")
  .update({ serial_number: serial.serial_number, status: "valid" })
  .eq("id", cardId);

if (updateErr) throw updateErr;
```

## Impact
- Regulators will be able to assign serial numbers and the status will correctly change to `valid`
- Landlords will immediately see the card as "Available" in their portal
- No changes to landlord-side code needed — it already filters by `status === "valid"`


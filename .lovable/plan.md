

# Replace All Office Mappings with Official Rent Control List

## Summary
The current platform has ~68 offices across 16 regions, many of which are incorrect. The user has provided the official Rent Control Department list with ~80 offices across 14 regions (Savannah and North East regions are removed entirely). This requires updating three data sources: the client-side constant, the database `offices` table, and the `region_codes` table.

## Key Differences from Current Data

**Regions removed**: Savannah (Damongo, Salaga, Bimbilla), North East (Nalerigu)

**Greater Accra**: Shrinks from 24 to 14 offices. Removes Accra North, Madina, Teshie-Nungua, Kaneshie, Achimota, Dome, Lapaz, Spintex, East Legon, Airport Area, Osu, La, Cantonment, Dzorwulu, Roman Ridge, Awoshie, Ablekuma. Adds Adjen Kotoku, Ningo-Prampram, Tema New Town, Dodowa, Sowutuom, Attah Deka, Ofankor.

**Ashanti**: Expands from 3-4 to 12. Adds Ejisu, Mamponteng, Asokore Mampong, Ashanti Mampong, Konongo, Nkawie, Effiduase, Asanti Bekwai, Agogo, Offinso. Removes Kumasi South. Nkawkaw moves to Eastern.

**Eastern**: Expands. Adds Krobo Odumase, Kibi, Asamankese. Removes Suhum, Oda.

**Central**: Agona Swedru replaces Swedru. Adds Buduburam. Removes Elmina, Saltpond.

**Western**: Adds Wassa Akropong, Jomoro, Ellembele.

**Bono**: Brekum replaces Berekum. Dormaa East replaces Dormaa.

**Bono East**: Adds Nkoranza.

**Upper West**: Adds Lawra, Jirapa.

**Upper East**: Removes Bawku.

**Volta**: Adds Kpando/Hohoe, Denu, Akatsi. Removes Kpando standalone.

**Oti**: Kedjebi replaces Dambai and Nkwanta.

**Western North**: Removes Bibiani.

## Changes Required

### 1. Database Migration — Update `offices` table
- Delete offices that no longer exist (will need to handle FK constraints on `cases.office_id` and `escrow_transactions.office_id` by setting references to the regional HQ before deleting)
- Insert new offices
- Update renamed offices (e.g., Swedru → Agona Swedru, Berekum → Brekum, Dormaa → Dormaa East)
- Remove region_codes entries for Savannah and North East

### 2. Client-Side Constant — `src/hooks/useAdminProfile.ts`
- Replace `GHANA_REGIONS_OFFICES` array with the exact official list (14 regions, ~80 offices)
- All derived helpers (`GHANA_OFFICES`, `GHANA_REGIONS`, `getOfficesForRegion`, etc.) auto-update

### 3. GPS Utils — `src/lib/gpsUtils.ts`
- Remove Savannah and North East from the `GHANA_REGIONS` coordinate map

### 4. Region Codes — Database
- Delete region_codes rows for "Savannah" and "North East"

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useAdminProfile.ts` | Replace `GHANA_REGIONS_OFFICES` with official 14-region, ~80-office list |
| `src/lib/gpsUtils.ts` | Remove Savannah and North East from region coordinates |
| New migration SQL | Delete removed offices (with FK cleanup), insert new ones, update renames, clean region_codes |

### Migration Safety
- Before deleting old office rows, reassign any `cases.office_id` and `escrow_transactions.office_id` that reference deleted IDs to the regional HQ office
- Update any `admin_staff.office_id`, `office_allocations.office_id`, `office_payout_accounts.office_id` text references similarly
- This preserves data integrity while switching to the correct office list


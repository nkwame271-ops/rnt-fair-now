

## Plan: GPS Redesign, Area Expansion, and Lease-Expiry Marketplace Relisting

This plan addresses three features: (1) redesigning the property GPS picker so it represents the property's physical location rather than the landlord's device, (2) expanding the limited area lists for all regions, and (3) automatically resurfacing properties on the marketplace when a lease has one month remaining.

---

### 1. Expand Areas for All Regions

**File: `src/data/dummyData.ts`**

Currently, only 7 of 16 regions have areas defined. The remaining 9 (Upper East, Upper West, Bono, Bono East, Ahafo, Savannah, North East, Oti, Western North) return empty arrays, making property registration impossible for those regions.

Add areas for every region plus expand existing ones with more neighborhoods. Also add a free-text "Custom area" fallback in the registration form so landlords aren't blocked if their area isn't listed.

---

### 2. Redesign Property GPS — Interactive Map Picker

**Current problem:** The "Auto-detect" button captures the landlord's device GPS and auto-saves it as the property location. A landlord in Kumasi registering a property in Accra would get wrong coordinates.

**New design — `src/components/PropertyLocationPicker.tsx`:**

A self-contained component that replaces the current GPS input + Auto-detect button. It provides three ways to set the property's location:

1. **Address search** — A text input that queries the free Nominatim (OpenStreetMap) geocoding API. Results appear in a dropdown; selecting one places the pin on the map and fills the coordinates.

2. **Interactive map with draggable pin** — Uses the existing Leaflet dependency. The landlord clicks the map or drags the pin to set exact coordinates. The map starts centered on Ghana (or on the selected region if one is chosen).

3. **Manual coordinate entry** — A collapsible "Enter coordinates manually" section for power users.

**Device GPS role:** A small "Use my location as starting point" button that only pans the map to the landlord's device location but does NOT set the property coordinates. The pin stays where it was. A toast clarifies: "Map centered on your location. Drag the pin to the property's actual position."

**Data flow:**
- Component emits `onLocationChange({ lat, lng, address? })` 
- Parent stores in state, saves to `properties.gps_location` on submit
- No auto-save, no auto-detect as property GPS

```text
┌──────────────────────────────────────────────┐
│  Property Location                            │
│                                               │
│  🔍 [Search address...              ] [Search]│
│     ┌─ Dropdown results ─────────────┐        │
│     │  14 Palm St, East Legon, Accra │        │
│     │  Palm Avenue, Kumasi           │        │
│     └────────────────────────────────┘        │
│                                               │
│  ┌────────────────────────────────────┐       │
│  │         Leaflet Map                │       │
│  │           📍 (draggable)           │       │
│  │                                    │       │
│  │                                    │       │
│  └────────────────────────────────────┘       │
│  [📍 Center on my device] (map pans only)     │
│                                               │
│  ▸ Enter coordinates manually                 │
│    Lat: [5.614818]  Lng: [-0.205874]          │
│                                               │
│  Selected: 5.614818, -0.205874  ✓             │
└──────────────────────────────────────────────┘
```

**File: `src/pages/landlord/RegisterProperty.tsx`**
- Remove the old `getGpsLocation` function and "Auto-detect" button
- Replace the GPS section with `<PropertyLocationPicker>`
- The `gpsLocation` state receives formatted coords from the picker

---

### 3. Update RegisterProperty Area Input

**File: `src/pages/landlord/RegisterProperty.tsx`**

- After the area Select dropdown, add a text input labeled "Or type your area" that allows free-text entry when the area isn't in the list
- If the landlord types a custom area, use that value instead of the dropdown selection
- This prevents blocking registration for unlisted neighborhoods

---

### 4. Marketplace Auto-Relisting for Expiring Leases

**File: `src/pages/tenant/Marketplace.tsx`**

Currently the marketplace query filters `units.status = 'vacant' AND properties.listed_on_marketplace = true`. Properties with active tenancies whose lease expires within 30 days should also appear, tagged as "Available Soon."

**Changes:**
- Add a second query: fetch units where `status = 'occupied'` but the linked tenancy's `end_date` is within 30 days of today, and the property is marketplace-listed
- Merge these results with the existing vacant units
- Display an "Available from [date]" badge on these listings so tenants can book ahead
- The viewing request flow remains the same (tenant pays GH₵ 2 and sends request)

No database changes needed — the `tenancies.end_date` and `units.status` columns already exist.

---

### 5. Tenant GPS — No Changes Needed (Confirmation)

The current data architecture already correctly separates GPS:
- `properties.gps_location` — property-level field, set by landlord
- No `gps_location` on `tenants` or `profiles` tables
- No tenant flow writes to `properties.gps_location`

The only violation was the "Auto-detect" button in RegisterProperty which is being removed in step 2. No additional changes needed for tenant GPS isolation.

---

### Files to Create/Edit

| File | Action |
|------|--------|
| `src/data/dummyData.ts` | Expand `areasByRegion` for all 16 regions |
| `src/components/PropertyLocationPicker.tsx` | **Create** — interactive map picker with search, draggable pin, manual entry |
| `src/pages/landlord/RegisterProperty.tsx` | Replace GPS section with new picker; add custom area input |
| `src/pages/tenant/Marketplace.tsx` | Add expiring-lease query; show "Available Soon" badge |

No database migrations required. No new dependencies needed (Leaflet already installed).

---

### Technical Detail: Nominatim Geocoding

The address search uses the free OpenStreetMap Nominatim API directly from the browser:
```
GET https://nominatim.openstreetmap.org/search?q=East+Legon+Accra&format=json&countrycodes=gh&limit=5
```
- No API key required
- Rate limit: 1 request/second (enforced with debounce)
- `countrycodes=gh` biases results to Ghana
- Returns `lat`, `lon`, `display_name` for each result


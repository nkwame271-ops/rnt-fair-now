

# Plan: Google Maps Enhancements (5 Features)

## Feature 1 — Reverse Geocoding Auto-Fill (PropertyLocationPicker)

**What**: When a landlord drops/drags a pin on the map, automatically reverse-geocode the coordinates to fill the address field.

**Files**:
- `src/components/PropertyLocationPicker.tsx` — Add a `Geocoder` call in `updateLocation()`. When a pin is placed (click or drag), call `google.maps.Geocoder.geocode({ location })` to get the formatted address. Pass the address string back via `onLocationChange({ lat, lng, address })`.
- `src/pages/landlord/RegisterProperty.tsx` — Update the `onLocationChange` handler to also set the `address` state when an address string is returned from the picker.

**No DB/API changes needed.**

---

## Feature 2 — Nearby Amenities on Marketplace Listings

**What**: After a viewing is confirmed (exact location revealed), show nearby places (schools, hospitals, markets, ATMs) using Google Places `nearbySearch`.

**Files**:
- `src/components/NearbyAmenities.tsx` — **New component**. Takes `lat/lng`, uses `google.maps.places.PlacesService.nearbySearch()` for types `school`, `hospital`, `atm`, `supermarket`, `pharmacy`. Displays results as icon + name + distance chips.
- `src/pages/tenant/Marketplace.tsx` — Import and render `NearbyAmenities` inside the confirmed-viewing section (line ~518), below the map embed, only when `gps_location` is available.

**No DB/API changes needed.** Uses client-side Places API.

---

## Feature 3 — Street View on Marketplace Listings

**What**: Embed a Google Street View panorama on the property detail modal for tenants with confirmed viewings.

**Files**:
- `src/components/StreetViewEmbed.tsx` — **New component**. Takes `lat/lng`, renders a `StreetViewPanorama` using `@react-google-maps/api`. Falls back to "Street View not available" if no imagery exists at that location.
- `src/pages/tenant/Marketplace.tsx` — Replace the current OpenStreetMap iframe embed (lines 526-536) with the Google Maps embed + Street View toggle. Show a tab or toggle between Map view and Street View.

**No DB/API changes needed.**

---

## Feature 4 — Regulator Heatmap (Analytics Dashboard)

**What**: Add a property density heatmap to the regulator analytics page using Google Maps `HeatmapLayer`.

**Files**:
- `src/components/PropertyHeatmap.tsx` — **New component**. Takes an array of `{lat, lng, weight}` points. Uses `@react-google-maps/api` with `visualization` library and `HeatmapLayer`.
- `src/pages/regulator/RegulatorAnalytics.tsx` — Fetch all property GPS coordinates from the `properties` table (already fetched partially). Build heatmap data points where weight = number of units or tenants. Render `PropertyHeatmap` alongside or as a toggle with the existing regional marker map.
- `src/components/PropertyMap.tsx` — Update `useJsApiLoader` to include `visualization` library so the heatmap layer works (shared loader).

**Note**: The `libraries` array for `useJsApiLoader` must be consistent across all components that call it (Google Maps only loads once). Will centralize the libraries config.

---

## Feature 6 — Distance Calculator on Marketplace Listings

**What**: Show distance and travel time from the property to key landmarks (nearest school, hospital, market) using the Google Distance Matrix API.

**Files**:
- `src/components/NearbyAmenities.tsx` — Extend the component from Feature 2 to also compute walking/driving distance from the property to each found place using `google.maps.DistanceMatrixService`. Display as "Hospital X — 1.2 km, 5 min drive".

**No separate component needed** — this naturally combines with Feature 2.

---

## Shared Concern: Google Maps Library Loading

Currently `PropertyLocationPicker.tsx` loads `["places"]` and `PropertyMap.tsx` loads no extra libraries. The heatmap needs `["visualization"]`. Google Maps JS API only loads once per page, so all `useJsApiLoader` calls must use the same libraries array.

**Fix**: Create a shared config `src/lib/googleMaps.ts` exporting the API key and libraries array `["places", "visualization"]`. All components import from there instead of hardcoding.

---

## Files Summary

| File | Action | Reason |
|------|--------|--------|
| `src/lib/googleMaps.ts` | **Create** | Shared Google Maps config (key + libraries) |
| `src/components/PropertyLocationPicker.tsx` | Edit | Add reverse geocoding in `updateLocation`, use shared config |
| `src/components/PropertyMap.tsx` | Edit | Use shared config |
| `src/components/NearbyAmenities.tsx` | **Create** | Nearby places + distance calculator |
| `src/components/StreetViewEmbed.tsx` | **Create** | Street View panorama |
| `src/components/PropertyHeatmap.tsx` | **Create** | Heatmap visualization |
| `src/pages/landlord/RegisterProperty.tsx` | Edit | Auto-fill address from reverse geocode |
| `src/pages/tenant/Marketplace.tsx` | Edit | Add Street View, nearby amenities, distance in confirmed-viewing section |
| `src/pages/regulator/RegulatorAnalytics.tsx` | Edit | Add heatmap section, fetch property GPS data |

## Implementation Order

1. Shared Google Maps config (`googleMaps.ts`)
2. Reverse geocoding (PropertyLocationPicker + RegisterProperty)
3. Street View embed component + Marketplace integration
4. Nearby amenities + distance calculator component + Marketplace integration
5. Property heatmap component + RegulatorAnalytics integration


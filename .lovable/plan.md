## Goal
Validate that the typed/Google Maps address and the GhanaPostGPS code refer to (roughly) the same place during property registration and editing, and make GhanaPostGPS clickable in the admin portal.

## Validation rules (haversine distance between map pin and GhanaPostGPS)
- 0–50 m → accept silently (badge: "Location verified")
- 51–150 m → accept but flag the property `location_review_required = true` (badge: "Location Needs Review")
- > 150 m → block submission with the error:
  *"The selected map location does not match the GhanaPostGPS location. Please adjust the map pin or confirm the correct GPS address."*
- If the GhanaPostGPS code can't be resolved (lookup fails / invalid format) → show inline warning and require the landlord to either fix the code or tick a "Confirm location is correct" override (override forces `location_review_required = true`).

GhanaPostGPS format check: `^[A-Z]{2}-\d{2,4}-\d{3,4}$` (e.g. `GA-123-4567`).

## Backend
1. **New edge function** `resolve-ghana-post-gps` (verify_jwt = false, public).
   - Input: `{ code: string }`.
   - Calls `https://ghanapostgps.sperse.com/get.php` with `POST` form `address=<code>` (the public lookup).
   - Returns `{ lat, lng, region, district, area, formatted }` or `{ error }`.
   - Caches successful lookups in a new table `ghana_post_gps_cache (code PK, lat, lng, region, district, area, resolved_at)` to avoid hammering the unofficial endpoint.
   - 5 s timeout; on failure returns `{ error: "lookup_failed" }` so the UI can degrade gracefully.

2. **Migration**
   - Create `ghana_post_gps_cache` (service-role write, public read).
   - Add columns to `properties`: `location_review_required boolean default false`, `location_distance_m integer null`, `ghana_post_gps_lat numeric`, `ghana_post_gps_lng numeric`.
   - Add the same flag to `existing_tenancies` registration path if the file declares its own GhanaPostGPS (it does — store on the related property only; tenancy stays untouched schema-wise).

## Frontend

### Shared helper `src/lib/locationValidation.ts`
- `haversineMeters(a, b)`
- `validateGhanaPostGpsFormat(code)`
- `classifyDistance(meters) → { level: "ok" | "review" | "block", message }`
- `resolveGhanaPostGps(code)` → invokes the new edge function via `supabase.functions.invoke`.

### `PropertyLocationPicker.tsx`
- After user enters/changes the GhanaPostGPS code (debounced 600 ms), call `resolveGhanaPostGps`.
- When both the map pin and GhanaPostGPS coords exist, compute distance and surface:
  - green check + "Locations match (X m)"
  - amber alert + "Location needs review (X m)"
  - red alert + the block message above
- Expose results via new optional callback `onLocationValidationChange({ status, distanceM, gpsLat, gpsLng })`.
- Add a "View on map" link next to the GhanaPostGPS field that opens `https://www.google.com/maps?q=<lat>,<lng>` in a new tab once resolved.

### `RegisterProperty.tsx` and `EditProperty.tsx`
- Subscribe to the new validation callback; store `gpsLat/gpsLng/distance/status`.
- On submit:
  - status `block` → toast error and abort.
  - status `review` → set `location_review_required = true` on insert/update.
  - Persist `ghana_post_gps_lat`, `ghana_post_gps_lng`, `location_distance_m`.

### Admin portal
- `RegulatorProperties.tsx` detail dialog: render GhanaPostGPS as a link → opens Google Maps using the cached lat/lng (fallback: `https://www.google.com/maps/search/?api=1&query=<code>`).
- Show a "Location Needs Review" badge on rows where `location_review_required = true`, plus a filter chip in the toolbar to surface them.
- Add an "Approve location" action (admin-only) that clears the flag and writes a `property_events` row of type `location_review_cleared`.

## Files to add / change
- `supabase/migrations/<new>.sql` — table + property columns.
- `supabase/functions/resolve-ghana-post-gps/index.ts` — new function (with cache read/write through service role).
- `src/lib/locationValidation.ts` — new helper.
- `src/components/PropertyLocationPicker.tsx` — debounced lookup, distance UI, callback, "view on map" link.
- `src/pages/landlord/RegisterProperty.tsx` — wire validation, block/review handling, persist new columns.
- `src/pages/landlord/EditProperty.tsx` — same as above for edits.
- `src/pages/regulator/RegulatorProperties.tsx` — clickable GhanaPostGPS, review badge + filter, approve action.

## Notes / risks
- The Sperse endpoint is unofficial; we cache results and degrade to a soft warning on failure so registration is never permanently blocked by a third-party outage.
- All new admin actions remain gated by `is_main_admin()` in RLS.
- No changes to existing rent / tenancy logic — purely location validation.

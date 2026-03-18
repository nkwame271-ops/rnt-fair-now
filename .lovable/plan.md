

# Property Database: Clickable Address & Ghana Post GPS

## Changes

### 1. Make Address clickable (links to Google Maps)
In the detail dialog (line 301) and table view (line 250), wrap the address in an anchor tag that opens Google Maps at the property's GPS coordinates. If GPS is available, link to `https://www.google.com/maps?q={lat},{lng}`. If not, fall back to a Google Maps search for the text address.

### 2. Show Ghana Post GPS in detail dialog
Add a new field row after the GPS line (line 303) that displays `detailProperty.ghana_post_gps` when it exists. The `ghana_post_gps` column already exists in the `properties` table and is already being saved during registration -- it just isn't rendered in the detail view.

## File: `src/pages/regulator/RegulatorProperties.tsx`

**Table view (line 250):** Wrap address text in an `<a>` tag that opens Google Maps using the property's `gps_location` or address as fallback.

**Detail dialog (line 301):** Same -- make address a clickable link styled with underline and primary color.

**Detail dialog (after line 303):** Add a new row:
```
Ghana Post GPS: {detailProperty.ghana_post_gps || "—"}
```

No database changes needed -- `ghana_post_gps` is already stored.


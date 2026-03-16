

## Diagnosis

The error `Loader must not be called again with different options` shows two conflicting library arrays:
- `["places", "visualization"]` (new shared config)  
- `["places"]` (old cached version)

**All source files are already correct** — every `useJsApiLoader` call imports from `@/lib/googleMaps.ts` and uses `GOOGLE_MAPS_LIBRARIES: ["places", "visualization"]`. This is a **stale HMR (hot module reload) cache** issue, not a code bug.

## Fix

**No code changes needed.** A hard refresh of the preview page will clear the cached module and resolve the conflict. Simply reload the preview browser tab (Ctrl+Shift+R / Cmd+Shift+R).

If the error persists after a hard refresh, I'll investigate further for any edge case.


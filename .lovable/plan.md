## Problem

`EmergencyAlertRinger` is mounted in `RegulatorLayout` but invisible because it gates on a feature key that doesn't exist:

```tsx
const { visible: canView } = useFeatureGate("emergency_view_alerts"); // ❌ no such key
const { visible: canAck }  = useFeatureGate("emergency_acknowledge"); // ✅ exists
```

DB has these emergency keys: `emergency_alert`, `emergency_view_all`, `emergency_view_police`, `emergency_view_fire`, `emergency_view_health`, `emergency_view_other`, `emergency_view_live_location`, `emergency_acknowledge`, `emergency_escalate`, `emergency_resolve`, `emergency_export_records`. There is no `emergency_view_alerts`, so `resolve_feature_access` returns `false` → `canView=false` → `if (!canView) return null` short-circuits everything (banner, siren, prompt, subscription).

## Fix

Single-file change in `src/components/EmergencyAlertRinger.tsx`:

1. Swap the gate key from `"emergency_view_alerts"` to **`"emergency_view_all"`** — this is the existing umbrella key for admins who can see all panic emergencies.
2. Keep `"emergency_acknowledge"` as-is for the Ack button (already valid).

No other behavior changes — the realtime subscription, Web Audio siren, browser Notification, one-time amber permission prompt, persistent blinking red banner, and acknowledge flow all already exist and work correctly once the gate passes.

## Verification

After the swap:
- Log in as an admin who has `emergency_view_all` enabled (set via role override or globally) → on any regulator route, the amber "Enable emergency notifications and sound alerts" banner appears once.
- Trigger a panic alert (or insert a `panic_emergency` row) → red blinking banner appears at top of admin portal, siren wails, browser notification fires.
- Click **Ack** → banner disappears, siren stops, `acknowledged_at/by/status` written.

If no admin currently has `emergency_view_all`, the user can enable it in Regulator → Features (it's currently `is_enabled=false` globally per the DB read).

## Files touched

- `src/components/EmergencyAlertRinger.tsx` — one-line change (the feature key string).

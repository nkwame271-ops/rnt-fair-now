

# Cleanup: Remove Unused Imports

After the account management migration, several imports in `AdminActions.tsx` are no longer used. `PendingPurchases.tsx` has one unused icon.

## AdminActions.tsx (line 2, 5, 7)

Remove these unused imports:
- **Icons**: `ShieldAlert`, `Archive`, `UserX` — were used by the account management UI, now in EngineRoom
- **`Label`** — no longer referenced in the component
- **`Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`** — were used for account type selector, now in EngineRoom

Keep: `Search`, `Loader2`, `RotateCcw`, `Trash2`, `ScrollText`, `Ban` (all still used)

## PendingPurchases.tsx (line 2)

Remove unused import:
- **`Wand2`** icon — was used by the old auto-fill button, removed during simplification

Keep: `Search`, `CreditCard`, `Loader2`, `CheckCircle` (all still used)

---

Two files, import lines only. No logic changes.


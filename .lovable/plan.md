

# Plan: Fix Paired Serial Assignment (1 Serial = 2 Cards)

## Problem

When assigning serials to rent cards, the system currently maps each card to a unique serial (1:1). But in paired mode, each serial represents a pair (landlord copy + tenant copy), so each serial should be assigned to **two consecutive cards**. Selecting 6 cards should require 3 unique serials, with each serial appearing twice.

## Changes — Single File

**File: `src/pages/regulator/rent-cards/PendingPurchases.tsx`**

### 1. Compute `serialsNeeded` based on pairing

Add a derived value: `serialsNeeded = Math.ceil(mappingCards.length / 2)` — this is the number of unique serials required. Used throughout validation, previews, and mapping.

### 2. Fix `buildAndAssign` — duplicate each serial

Currently:
```
card[0] → serial[0], card[1] → serial[1], card[2] → serial[2] ...
```

Change to:
```
card[0] → serial[0], card[1] → serial[0], card[2] → serial[1], card[3] → serial[1] ...
```

For all modes (`auto_qty`, `start_from`, `range`), map `card[i] → serial[Math.floor(i / 2)]`.

For `manual` mode, show one picker per **pair of cards** (not per card), and assign the chosen serial to both cards in each pair.

### 3. Fix `startFromPreview` and `rangePreview`

- `startFromPreview`: slice `serialsNeeded` serials from the start point (not `mappingCards.length`)
- `rangePreview`: validate that the range contains exactly `serialsNeeded` serials (not `mappingCards.length`)

### 4. Fix `canConfirm` validation

- `auto_qty`: `availableSerials.length >= serialsNeeded`
- `start_from`: `startFromPreview.length >= serialsNeeded`
- `range`: `rangePreview.length === serialsNeeded`
- `manual`: every pair has a serial mapped

### 5. Fix preview text in all modes

Update the informational text to reflect pairing:
- "Need **3 serials** for **6 cards** (paired)"
- Auto mode: show range of 3 serials, not 6
- Range mode: "Serials in range: 3 — Cards to assign: 6 (3 pairs) ✓"

### 6. Fix manual mode UI

Instead of showing one picker per card, group cards into pairs and show one picker per pair:
- "Pair 1 (Card 1 & Card 2) — [serial picker]"
- "Pair 2 (Card 3 & Card 4) — [serial picker]"

The selected serial is assigned to both cards in the pair.

## No backend changes needed

The backend already handles pair_index=2 sync (from the previous fix). The `handleConfirmAssign` function already marks both pair indices as assigned. The only issue is the frontend mapping logic sending the wrong number of unique serials.

## Summary

| Area | Current | Fixed |
|------|---------|-------|
| Serial mapping | 1 card : 1 serial | 2 cards : 1 serial |
| 6 cards needs | 6 serials | 3 serials |
| Validation | count ≥ cards | count ≥ ceil(cards/2) |
| Manual UI | 1 picker/card | 1 picker/pair |


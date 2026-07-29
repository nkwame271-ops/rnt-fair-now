## Problem

In `src/lib/pdf/form33.ts` the header draws two texts on the same baseline: the case number left-aligned at `MARGIN` and the parties line right-aligned at `A4.W - MARGIN`. Neither is width-constrained, so a long parties string (e.g. "RD ADJEI ... MAE/ TOMLINSON/ ANTWIWAA") runs straight over the case number, and can also spill past the right page edge. This is the overlap in the screenshot.

## Fix (single file: `src/lib/pdf/form33.ts`)

Replace the single-baseline header block with a measured two-zone layout:

1. **Case number row (row 1)**
   - Fixed left column at `MARGIN`, bold 18pt.
   - Measure its width; that width plus a fixed 18pt gutter defines the space the parties block may not enter.

2. **Parties block (right zone, wrapping)**
   - Available width = `A4.W - MARGIN*2 - caseWidth - gutter`.
   - Auto-shrink within bounds only: start at 16pt, step down 1pt to a floor of 11pt while the longest wrapped line exceeds the available width.
   - After shrinking, wrap with `splitTextToSize` into at most 3 lines (further lines are appended to the third with an ellipsis so the block can never grow unbounded).
   - Right-align each wrapped line at `A4.W - MARGIN`, with a fixed line-height of `1.25 × fontSize`.

3. **Overflow fallback**
   - If the parties text still doesn't fit at the 11pt floor (very long names), drop it to its own full-width row *below* the case number instead of beside it, right-aligned, wrapped across the full content width. This guarantees no collision and no page-edge overflow.

4. **Consistent vertical rhythm**
   - Header block height = `max(caseRowHeight, partiesBlockHeight)`; the green divider line and the following `y` cursor are computed from that height rather than the current hard-coded `y += 14`, so FORM 33 title spacing stays constant regardless of how many lines the parties block took.

## Why this covers preview, print and PDF

`PdfLivePreview` and the download path both call `renderForm33` and render the same jsPDF output, so fixing the generator fixes all three surfaces at once. No component changes needed.

## Out of scope

No changes to the statutory body, fonts, watermark, signature stamp, or QR footer.
## Problem

The QR code on Forms 7 and 33 is "not showing":

- In the **Form Editor live preview** (`PdfLivePreview` inside `FormEditorDialog` and the standalone `Form7LivePreview`), `renderForm7` / `renderForm33` are called directly with the raw editor state. That state never contains `qr_data_url` or `verification_code`, so `drawQrFooter` early-returns and no QR is drawn — the regulator sees a "QR-less" form and assumes it will print that way.
- In the **finalized PDF** path (`generateStatutoryForm` in `src/lib/complaintForms.ts`), a QR data URL is created via `QRCode.toDataURL(verifyUrl, { width: 220, margin: 0 })`. `margin: 0` removes the scanner quiet zone, and any thrown error in QR generation silently falls through to `qrDataUrl = undefined`, again producing a QR-less PDF without warning.
- `drawQrFooter` in `src/lib/pdf/_brand.ts` wraps `doc.addImage` in a bare `try { } catch { return; }`, so even a malformed data URL fails silently with no diagnostic.

## Fix

Small, frontend/presentation-only changes — no business logic, no DB, no edge functions.

### 1. Live preview always shows a placeholder QR

In `src/components/regulator/FormEditorDialog.tsx`:

- Generate a one-time placeholder QR data URL on mount using `QRCode.toDataURL("https://www.rentcontrolghana.com/verify/form/PREVIEW", { width: 220, margin: 2 })`.
- Merge `{ qr_data_url: previewQr, verification_code: data.verification_code || "PREVIEW" }` into the object passed to `PdfLivePreview` so the live preview always renders the QR block exactly where it will appear on the finalized PDF.

Apply the same merge in `src/components/regulator/Form7LivePreview.tsx`.

This guarantees the regulator visually confirms the QR before clicking **Generate PDF**.

### 2. Harden finalized QR rendering

In `src/lib/complaintForms.ts > generateStatutoryForm`:

- Change `QRCode.toDataURL(verifyUrl, { width: 220, margin: 0 })` to `{ width: 240, margin: 2, errorCorrectionLevel: "M" }` so the QR has a proper quiet zone and is reliably scannable from print.
- Log a `console.error` (and surface a non-blocking toast in the caller) if QR generation fails, instead of silently dropping it.

In `src/lib/pdf/_brand.ts > drawQrFooter`:

- Keep the safe-no-op behaviour but log the underlying error to the console with the offending data URL prefix, so future regressions are debuggable.
- Slightly shrink the size from 52pt to 56pt and re-anchor `y` so the QR sits cleanly above the footer divider (no overlap with the slogan or "Generated …" line). Caption text moves with it.

### 3. No statutory body changes

The QR continues to render only in the footer band; the statutory text of Form 7 and Form 33 is untouched.

## Files to edit

- `src/components/regulator/FormEditorDialog.tsx` — inject preview QR into `data` passed to `PdfLivePreview`.
- `src/components/regulator/Form7LivePreview.tsx` — same preview-QR injection.
- `src/lib/complaintForms.ts` — bump QR `margin` and add error logging.
- `src/lib/pdf/_brand.ts` — better diagnostics + tightened QR footer layout.

## Out of scope

- Form 32A QR (already uses the same `drawQrFooter`; benefits automatically from the `_brand.ts` tweaks but no editor preview change is requested).
- Verify-form route (`/verify/form/:code`) — already wired and working.
- Database / RLS / edge functions.

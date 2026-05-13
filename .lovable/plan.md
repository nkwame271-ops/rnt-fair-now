## Two Complaint bugs — root causes & fix plan

### Bug 1 — Admin "Attached download" returns `{statusCode: "404", error: "Bucket not found"}`

**Root cause:** Evidence is stored in the **private** bucket `application-evidence`, but the upload code calls `supabase.storage.from(...).getPublicUrl(path)` and saves that URL into `complaints.evidence_urls`. The thumbnail in `RegulatorComplaints.tsx` (line 947–957) renders correctly because `<SignedImage>` re-signs the URL via `useSignedStorageUrl`, but the **click handler** (`onClick={() => window.open(url, "_blank")}`) opens the **raw public URL**, which 404s because the bucket is private.

**Fix:** On click, resolve the URL through the same signing path before opening. Use the existing `parseStorageUrl` + `supabase.storage.createSignedUrl` (mirrors what `useSignedStorageUrl` already does). Apply the same fix to:
- `src/pages/regulator/RegulatorComplaints.tsx` (tenant complaints `<SignedImage onClick>` and the landlord-complaints evidence block at line 947–957, which currently uses bare `<SignedImage>` with no click — add the same signed open).
- `src/pages/landlord/LandlordComplaints.tsx` line 520–526 — currently `<img src={url}>` of a private URL → broken thumbnails. Switch to `<SignedImage>` + signed-open click.
- `src/pages/tenant/FileComplaint.tsx` if it renders past evidence (verify and fix the same way).

Add a small shared helper `openSignedStorageUrl(url)` in `src/lib/` so all three pages share one implementation.

### Bug 2 — Landlord "Pay Now" returns "Not authenticated"

**Root cause:** `supabase-checkout` requires the `Authorization: Bearer …` header (line 254–264 of `paystack-checkout/index.ts`). `supabase.functions.invoke` only attaches the header when the session is already loaded. On `LandlordComplaints.tsx`, `handlePayNow` invokes the function without first confirming the session is ready, so under a race (page mounted before `getSession()` resolves, refresh-token flight, or stale session) the header is missing and the function throws "Not authenticated".

**Fix in `src/pages/landlord/LandlordComplaints.tsx` `handlePayNow`:**
1. Call `const { data: { session } } = await supabase.auth.getSession();` first.
2. If no `session`, show toast "Please sign in again" and abort (or push to login).
3. Pass the token explicitly to `invoke`:
   ```ts
   await supabase.functions.invoke("paystack-checkout", {
     body: { type: "complaint_fee", complaintId: complaint.id },
     headers: { Authorization: `Bearer ${session.access_token}` },
   });
   ```
4. Apply the same guard to the equivalent `handlePayNow` in `src/pages/nugs/NugsMyComplaints.tsx` and any tenant complaint Pay-Now button (audit `MyCases.tsx` / `Payments.tsx` for the same pattern) so the bug doesn't recur in the other portals.

### Files to change
- `src/lib/openSignedUrl.ts` *(new helper)*
- `src/pages/regulator/RegulatorComplaints.tsx` — signed-open on evidence thumbnails (both tenant + landlord complaint blocks)
- `src/pages/landlord/LandlordComplaints.tsx` — signed thumbnails + signed-open click; auth-ready guard in `handlePayNow`
- `src/pages/tenant/FileComplaint.tsx` — signed-open if rendering evidence
- `src/pages/nugs/NugsMyComplaints.tsx` — same auth-ready guard in `handlePayNow`
- `src/pages/tenant/MyCases.tsx` / `Payments.tsx` — apply auth-ready guard wherever `paystack-checkout` is invoked

No DB migrations, no edge-function changes, no bucket changes.
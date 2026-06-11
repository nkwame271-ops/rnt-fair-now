import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, Callout, NextPrev, H2, P, UL } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialWebhooks() {
  return (
    <DocsLayout title="Receive webhooks" description="Get a push notification when data changes — no polling.">
      <P>
        Register a webhook endpoint in the dashboard. We POST a signed JSON payload to
        your URL whenever an event you subscribed to fires.
      </P>

      <H2>Event payload</H2>
      <CodeBlock language="json" code={`{
  "id": "evt_01HZ…",
  "type": "tenancy.created",
  "created_at": "2026-06-11T09:31:00Z",
  "data": { "tenancy_id": "TY-2026-000123", "tenant_id": "TN-2026-000456" }
}`} />

      <H2>Verifying the signature</H2>
      <P>
        Every request includes <code>X-RCG-Signature</code> = <code>t=&lt;timestamp&gt;,v1=&lt;hex hmac&gt;</code>.
        Compute HMAC-SHA256 of <code>{`${"<timestamp>.<raw body>"}`}</code> with your signing secret and compare:
      </P>
      <CodeBlock language="javascript" code={`import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const [tPart, sigPart] = header.split(",");
  const t = tPart.split("=")[1];
  const sig = sigPart.split("=")[1];
  const expected = crypto.createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}`} />

      <Callout kind="warn" title="Always verify and respond fast">
        Reject any request whose signature doesn't match. Respond with HTTP 2xx within
        10 seconds — we retry with exponential back-off (up to 24 hours) on any non-2xx.
      </Callout>

      <H2>Available events</H2>
      <UL>
        <li><code>tenancy.created</code>, <code>tenancy.terminated</code>, <code>tenancy.renewed</code></li>
        <li><code>complaint.created</code>, <code>complaint.status_changed</code>, <code>complaint.resolved</code></li>
        <li><code>property.registered</code>, <code>property.updated</code></li>
        <li><code>landlord.kyc_completed</code></li>
      </UL>

      <NextPrev
        prev={{ to: "/developers/docs/tutorials/lookup-property", label: "Look up a property" }}
        next={{ to: "/developers/docs/tutorials/pagination", label: "Handle pagination" }}
      />
    </DocsLayout>
  );
}

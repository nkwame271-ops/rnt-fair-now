import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, Callout, NextPrev, H2, P, UL, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsAuth() {
  return (
    <DocsLayout title="Authentication" description="How API keys work and how to keep them safe.">
      <P>
        Every request must include your API key in the <code>X-API-Key</code> header.
        Keys are issued from your developer dashboard (sandbox) or by an admin (live).
      </P>

      <CodeBlock code={`X-API-Key: rcg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} />

      <H2>Key format</H2>
      <UL>
        <li><code>rcg_test_…</code> — sandbox keys, synthetic data only.</li>
        <li><code>rcg_live_…</code> — production keys, real data.</li>
      </UL>

      <H2>How keys are stored</H2>
      <P>
        We never store the plaintext key — only a SHA-256 hash. That means if you lose
        the key, we cannot recover it. You'll need to rotate (issue a new one) and
        update your application.
      </P>

      <H2>Key safety checklist</H2>
      <UL>
        <li>Store keys in a secret manager. Never commit them to git.</li>
        <li>Never send a key from a browser, a mobile app, or any untrusted client.</li>
        <li>Use a different key per environment (dev, staging, production).</li>
        <li>Rotate keys every 90 days, or immediately if a key may have leaked.</li>
        <li>Restrict by IP allowlist where possible (live keys, in the dashboard).</li>
      </UL>

      <H2>Rotate a key without downtime</H2>
      <P>
        Click <strong>Rotate</strong> next to a key in your dashboard. The old key keeps
        working for a 24-hour grace period so you can roll your deployment safely. After
        24 hours the old key stops working.
      </P>

      <H2>Introspect your key</H2>
      <P>
        To confirm scopes, plan, and remaining quota without making a data call:
      </P>
      <CodeBlock code={`curl ${API_BASE}/v1/me -H "X-API-Key: $RCG_API_KEY"`} />

      <Callout kind="warn" title="Leaked a key?">
        Revoke it immediately from the Keys tab in your dashboard. Revocation is
        instant — no grace period.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/quickstart", label: "Quickstart" }}
        next={{ to: "/developers/docs/environments", label: "Environments" }}
      />
    </DocsLayout>
  );
}

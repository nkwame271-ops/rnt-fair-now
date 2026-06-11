import DocsLayout from "@/components/developers/docs/DocsLayout";
import { Callout, NextPrev, H2, P, UL } from "@/components/developers/docs/DocPrimitives";

export default function DocsEnvironments() {
  return (
    <DocsLayout title="Environments" description="Sandbox vs live — what differs and how to switch.">
      <P>
        Every key belongs to exactly one environment. They use the same base URL — the
        environment is determined by the key you send.
      </P>

      <H2>Sandbox</H2>
      <UL>
        <li>Prefix: <code>rcg_test_…</code></li>
        <li>Returns <strong>synthetic data only</strong> — no real personal information.</li>
        <li>Auto-issued the moment you sign up. No approval required.</li>
        <li>Hard-capped at 1,000 calls/month while in beta.</li>
        <li>Webhook deliveries fire to your endpoint just like in production.</li>
      </UL>

      <H2>Live (production)</H2>
      <UL>
        <li>Prefix: <code>rcg_live_…</code></li>
        <li>Returns real data, subject to the scopes the admin approved.</li>
        <li>Requires an approved access request and a signed Data Sharing Agreement.</li>
        <li>Rate limit defined per plan (default 60 req/min).</li>
      </UL>

      <Callout kind="tip">
        Build and test against sandbox until you're confident, then swap the key in
        your environment variables to go live. The endpoints and request format are
        identical.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/auth", label: "Authentication" }}
        next={{ to: "/developers/docs/rate-limits", label: "Rate limits" }}
      />
    </DocsLayout>
  );
}

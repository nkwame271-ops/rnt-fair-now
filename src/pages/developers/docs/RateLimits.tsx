import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, Callout, NextPrev, H2, P, UL } from "@/components/developers/docs/DocPrimitives";

export default function DocsRateLimits() {
  return (
    <DocsLayout title="Rate limits & quotas" description="How throttling, monthly quotas, and overage work.">
      <P>
        We enforce two limits: a <strong>per-minute rate limit</strong> (burst protection)
        and a <strong>monthly quota</strong> (your plan).
      </P>

      <H2>Rate-limit headers</H2>
      <P>Every response includes:</P>
      <CodeBlock code={`X-RateLimit-Limit: 60
X-RateLimit-Remaining: 47
X-RateLimit-Reset: 1718098800`} />
      <P>
        When you exceed the per-minute limit you get HTTP <code>429 Too Many Requests</code>.
        Wait until the <code>X-RateLimit-Reset</code> (unix seconds) and retry.
      </P>

      <H2>Monthly quota</H2>
      <UL>
        <li><strong>Free</strong>: 1,000 calls/month (sandbox only while in beta)</li>
        <li><strong>Starter</strong>: 50,000 calls/month</li>
        <li><strong>Growth</strong>: 500,000 calls/month</li>
        <li><strong>Scale</strong>: custom</li>
      </UL>
      <P>
        Check current usage with <code>GET /v1/me</code> or on the dashboard Usage tab.
        We email you at 80% and 100% of your quota.
      </P>

      <Callout kind="warn" title="Don't retry 429s in a tight loop">
        Use exponential back-off: wait 1s, then 2s, 4s, 8s. Repeated retries without
        back-off can extend your throttle window.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/environments", label: "Environments" }}
        next={{ to: "/developers/docs/errors", label: "Errors" }}
      />
    </DocsLayout>
  );
}

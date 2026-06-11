import DocsLayout from "@/components/developers/docs/DocsLayout";
import { NextPrev, H2, P, UL } from "@/components/developers/docs/DocPrimitives";

export default function DocsSupport() {
  return (
    <DocsLayout title="Support & SLA" description="How to get help and what to expect.">
      <H2>Where to get help</H2>
      <UL>
        <li>Email: <a className="text-primary underline" href="mailto:api@rentcontrolghana.com">api@rentcontrolghana.com</a></li>
        <li>Status page: <a className="text-primary underline" href="/status">/status</a></li>
        <li>In your dashboard: the chat widget in the bottom-right corner.</li>
      </UL>
      <H2>What to include in a support ticket</H2>
      <UL>
        <li>The <code>X-Request-Id</code> from the failing response.</li>
        <li>Your API key prefix (never the full key).</li>
        <li>Approximate UTC time of the request.</li>
        <li>A minimal reproduction (curl is fine).</li>
      </UL>
      <H2>Response targets</H2>
      <P>Beta: best-effort, typically within one business day. Paid plans will publish a contractual SLA when billing opens.</P>
      <NextPrev prev={{ to: "/developers/docs/pricing", label: "Pricing" }} />
    </DocsLayout>
  );
}

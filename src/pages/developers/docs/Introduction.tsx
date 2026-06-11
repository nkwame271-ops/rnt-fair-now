import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, Callout, NextPrev, H2, P, UL, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsIntroduction() {
  return (
    <DocsLayout
      title="Rent Control Ghana API"
      description="A read-only HTTP API for accredited agencies and partners to access landlord, tenant, property, and complaint data."
    >
      <P>
        The Rent Control Ghana API exposes the same data the regulator uses to oversee
        the rental market — landlords, tenants, properties, and complaints — through a
        small, consistent JSON API. It's read-only by design, signed with HTTPS and an
        API key, and audit-logged on every request.
      </P>

      <Callout kind="info" title="Who is this for?">
        Accredited government agencies (GRA, NIA, GSS), banks, insurers, and product
        teams building on Ghana's rental infrastructure. You'll need a signed Data
        Sharing Agreement before you can call production data.
      </Callout>

      <H2>What you can build</H2>
      <UL>
        <li>Verify a landlord or tenant before extending credit.</li>
        <li>Look up a property's registration, rent band, and vacancy status.</li>
        <li>Stream complaint case updates to your CRM with webhooks.</li>
        <li>Report on the rental market by region or compliance status.</li>
      </UL>

      <H2>Two environments</H2>
      <UL>
        <li><strong>Sandbox</strong> (keys prefixed <code>rcg_test_</code>): synthetic data, free, no approval required.</li>
        <li><strong>Live</strong> (keys prefixed <code>rcg_live_</code>): real data, requires regulator approval and a signed DSA.</li>
      </UL>

      <H2>Base URL</H2>
      <CodeBlock code={API_BASE} />

      <H2>Where to start</H2>
      <P>
        New here? Take the <a className="text-primary underline" href="/developers/docs/quickstart">5-minute quickstart</a>{" "}
        to make your first call. Already integrating? Jump to the{" "}
        <a className="text-primary underline" href="/developers/docs/reference/landlords">endpoint reference</a>.
      </P>

      <NextPrev next={{ to: "/developers/docs/quickstart", label: "Quickstart" }} />
    </DocsLayout>
  );
}

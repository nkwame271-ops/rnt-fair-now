import DocsLayout from "@/components/developers/docs/DocsLayout";
import { NextPrev, H2, P, UL } from "@/components/developers/docs/DocPrimitives";

export default function DocsDSA() {
  return (
    <DocsLayout title="Data Sharing Agreement (DSA)" description="The legal contract that governs your use of Rent Control Ghana data.">
      <P>
        The DSA binds your organization to the same data-protection standards the
        regulator follows under Ghana's Data Protection Act, 2012 (Act 843), and the
        Rent Act, 1963 (Act 220).
      </P>

      <H2>Your obligations in one paragraph</H2>
      <P>
        Use the data only for the purpose declared in your access request. Don't resell
        it. Encrypt it at rest and in transit. Don't retain personal data longer than
        necessary. Notify us within 72 hours of any incident affecting our data. Allow
        the regulator to audit your handling of the data on reasonable notice.
      </P>

      <H2>What you accept when you tick "Accept DSA"</H2>
      <UL>
        <li>The current version of the DSA published on this page.</li>
        <li>The acceptable-use policy (no scraping, no reverse engineering of pseudonymised IDs).</li>
        <li>The pricing and rate limits of the plan you're issued.</li>
        <li>Our right to revoke access immediately on material breach.</li>
      </UL>

      <H2>Full text</H2>
      <P>
        The current full text is available on request from{" "}
        <a className="text-primary underline" href="mailto:legal@rentcontrolghana.com">legal@rentcontrolghana.com</a>.
        Major updates require re-acceptance from your dashboard.
      </P>

      <NextPrev
        prev={{ to: "/developers/docs/go-live", label: "Request live access" }}
        next={{ to: "/developers/docs/pricing", label: "Pricing & billing" }}
      />
    </DocsLayout>
  );
}

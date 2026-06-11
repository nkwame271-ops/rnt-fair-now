import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeTabs, CodeBlock, Callout, NextPrev, H2, P, OpenInSandbox, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialVerifyLandlord() {
  const curl = `curl -X POST ${API_BASE} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "landlords/list",
    "filters": { "phone": "0244111222" }
  }'`;
  const js = `const res = await fetch("${API_BASE}", {
  method: "POST",
  headers: { "X-API-Key": process.env.RCG_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ endpoint: "landlords/list", filters: { phone: "0244111222" } }),
});
const { data } = await res.json();
if (data.length === 0) console.log("No registered landlord with that phone");
else console.log("Verified:", data[0].full_name, "—", data[0].landlord_id);`;

  return (
    <DocsLayout title="Verify a landlord" description="Confirm a landlord is registered before extending credit, signing a contract, or sharing tenant data.">
      <P>
        A common use case: a bank wants to confirm a loan applicant is a registered
        landlord on Rent Control Ghana. Here's how.
      </P>

      <H2>1. Search by phone number</H2>
      <P>Use the landlord's Ghana phone number (any local format works — we normalise).</P>
      <CodeTabs curl={curl} js={js} />
      <OpenInSandbox endpoint="landlords/list" params={{ phone: "0244111222" }} />

      <H2>2. Inspect the result</H2>
      <CodeBlock language="json" code={`{
  "success": true,
  "data": [{
    "landlord_id": "LL-2025-000123",
    "full_name": "Kwame Mensah",
    "phone": "233244111222",
    "region": "Greater Accra",
    "property_count": 3,
    "registered_at": "2025-04-12T09:31:00Z",
    "kyc_verified": true,
    "compliance_score": 87
  }]
}`} />
      <P>
        <strong>kyc_verified</strong> tells you Ghana Card KYC has been completed.
        <strong> compliance_score</strong> (0-100) summarises rent compliance,
        registration status, and complaint history.
      </P>

      <Callout kind="tip">
        For high-trust verification, follow up with{" "}
        <code>landlords/detail</code> using the <code>landlord_id</code> to fetch the
        full profile, including registered properties and tax compliance status.
      </Callout>

      <Callout kind="warn" title="Empty result ≠ unregistered">
        An empty <code>data</code> array means no landlord with that exact phone is
        registered. They may exist under a different number. Confirm with Ghana Card
        number where possible (<code>filters.ghana_card_number</code>).
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/errors", label: "Errors" }}
        next={{ to: "/developers/docs/tutorials/check-tenancy", label: "Tutorial: Check a tenancy" }}
      />
    </DocsLayout>
  );
}

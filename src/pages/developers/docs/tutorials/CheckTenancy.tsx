import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeTabs, NextPrev, H2, P, OpenInSandbox, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialCheckTenancy() {
  const curl = `curl -X POST ${API_BASE} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "tenants/detail",
    "filters": { "tenant_id": "TN-2025-000456" }
  }'`;
  const js = `const tenant = await fetch("${API_BASE}", {
  method: "POST",
  headers: { "X-API-Key": process.env.RCG_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ endpoint: "tenants/detail", filters: { tenant_id: "TN-2025-000456" } }),
}).then(r => r.json());

const t = tenant.data;
console.log(\`\${t.full_name} — \${t.tenancy.status} until \${t.tenancy.end_date}\`);`;

  return (
    <DocsLayout title="Check a tenancy" description="Look up a tenant's current tenancy, rent, and expiry date.">
      <P>
        Used by utility providers, banks, and the National ID Authority to confirm a
        person's current address through a verified tenancy.
      </P>
      <H2>Fetch by tenant ID</H2>
      <CodeTabs curl={curl} js={js} />
      <OpenInSandbox endpoint="tenants/detail" params={{ tenant_id: "TN-2025-000456" }} />

      <H2>Key fields</H2>
      <P>
        <code>tenancy.status</code> is one of <code>active</code>, <code>expired</code>,
        <code>terminated</code>, or <code>pending</code>. Only <code>active</code> tenancies
        can be used as proof of address. <code>tenancy.property_code</code> links to the
        property record — fetch it via <code>properties/detail</code>.
      </P>

      <NextPrev
        prev={{ to: "/developers/docs/tutorials/verify-landlord", label: "Verify a landlord" }}
        next={{ to: "/developers/docs/tutorials/lookup-property", label: "Look up a property" }}
      />
    </DocsLayout>
  );
}

import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeTabs, NextPrev, H2, P, OpenInSandbox, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialLookupProperty() {
  const curl = `curl -X POST ${API_BASE} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "endpoint": "properties/detail", "filters": { "property_code": "PR-AC-000789" } }'`;
  const js = `const { data } = await fetch("${API_BASE}", {
  method: "POST",
  headers: { "X-API-Key": process.env.RCG_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ endpoint: "properties/detail", filters: { property_code: "PR-AC-000789" } }),
}).then(r => r.json());`;

  return (
    <DocsLayout title="Look up a property" description="Find a property's registration, rent band, and current occupancy.">
      <P>Useful for insurers underwriting a policy, valuers, and market researchers.</P>
      <H2>Fetch by property code</H2>
      <CodeTabs curl={curl} js={js} />
      <OpenInSandbox endpoint="properties/detail" params={{ property_code: "PR-AC-000789" }} />

      <H2>Search by region</H2>
      <P>Use <code>properties/list</code> with <code>filters.region</code> for regional queries (page + limit apply).</P>

      <NextPrev
        prev={{ to: "/developers/docs/tutorials/check-tenancy", label: "Check a tenancy" }}
        next={{ to: "/developers/docs/tutorials/webhooks", label: "Receive webhooks" }}
      />
    </DocsLayout>
  );
}

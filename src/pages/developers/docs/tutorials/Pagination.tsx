import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, NextPrev, H2, P, Callout } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialPagination() {
  return (
    <DocsLayout title="Handle pagination" description="Page through large result sets correctly.">
      <P>
        All <code>*/list</code> endpoints support <code>page</code> (1-based) and{" "}
        <code>limit</code> (max <strong>500</strong>) in <code>filters</code>.
      </P>
      <CodeBlock code={`{ "endpoint": "tenants/list",
  "filters": { "page": 2, "limit": 100, "region": "Ashanti" } }`} />

      <H2>Read total count from meta</H2>
      <CodeBlock language="json" code={`{
  "data": [ /* 100 rows */ ],
  "meta": { "page": 2, "page_size": 100, "total": 4321, "has_more": true }
}`} />

      <H2>Loop until done</H2>
      <CodeBlock language="javascript" code={`let page = 1;
let all = [];
while (true) {
  const res = await fetch(API_BASE, { method: "POST", headers, body: JSON.stringify({
    endpoint: "tenants/list", filters: { page, limit: 500 }
  })}).then(r => r.json());
  all = all.concat(res.data);
  if (!res.meta.has_more) break;
  page++;
}`} />

      <Callout kind="tip">
        Use <code>limit: 500</code> for bulk exports — fewer round trips. Use a smaller
        limit (50-100) for user-facing pagination.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/tutorials/webhooks", label: "Webhooks" }}
        next={{ to: "/developers/docs/tutorials/retries", label: "Retries & idempotency" }}
      />
    </DocsLayout>
  );
}

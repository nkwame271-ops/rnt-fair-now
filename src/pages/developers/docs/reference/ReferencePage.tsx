import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeTabs, NextPrev, H2, P, OpenInSandbox, API_BASE, Callout } from "@/components/developers/docs/DocPrimitives";

interface Endpoint {
  name: string;
  summary: string;
  example?: Record<string, any>;
}

interface Props {
  scope: string;
  title: string;
  description: string;
  endpoints: Endpoint[];
  prev?: { to: string; label: string };
  next?: { to: string; label: string };
}

export default function ReferencePage({ scope, title, description, endpoints, prev, next }: Props) {
  return (
    <DocsLayout title={title} description={description}>
      <Callout kind="info">
        All endpoints below require the <code>{scope}</code> scope. POST to{" "}
        <code>{API_BASE}</code> with{" "}
        <code>{`{ "endpoint": "…", "filters": { … } }`}</code>.
      </Callout>

      {endpoints.map((ep) => {
        const example = ep.example ?? {};
        const curl = `curl -X POST ${API_BASE} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ endpoint: ep.name, filters: example })}'`;
        const js = `const res = await fetch("${API_BASE}", {
  method: "POST",
  headers: { "X-API-Key": process.env.RCG_API_KEY, "Content-Type": "application/json" },
  body: JSON.stringify(${JSON.stringify({ endpoint: ep.name, filters: example }, null, 2)}),
});
const json = await res.json();`;
        return (
          <section key={ep.name} className="my-6 border rounded-lg p-4">
            <H2 id={ep.name}>{ep.name}</H2>
            <P>{ep.summary}</P>
            <CodeTabs curl={curl} js={js} />
            <OpenInSandbox endpoint={ep.name} params={example} />
          </section>
        );
      })}

      <NextPrev prev={prev} next={next} />
    </DocsLayout>
  );
}

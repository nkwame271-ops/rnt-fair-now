import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, NextPrev, H2, P } from "@/components/developers/docs/DocPrimitives";

const ROWS: [string, string, string][] = [
  ["200", "OK", "Request succeeded."],
  ["400", "Bad Request", "Invalid JSON, missing required filter, or unknown endpoint."],
  ["401", "Unauthorized", "Missing or malformed X-API-Key header."],
  ["403", "Forbidden", "Key is valid but doesn't have the required scope."],
  ["404", "Not Found", "The resource (e.g. landlord_id) does not exist."],
  ["409", "Conflict", "Idempotency key collision with a different request body."],
  ["429", "Too Many Requests", "Rate limit or monthly quota exceeded."],
  ["500", "Internal Server Error", "Something broke on our end. Retry with back-off and contact support if it persists."],
  ["503", "Service Unavailable", "Temporary overload or scheduled maintenance."],
];

export default function DocsErrors() {
  return (
    <DocsLayout title="Errors & status codes" description="How to interpret error responses.">
      <P>
        Errors are returned as JSON with a consistent shape. The HTTP status code tells
        you the category; the body tells you the specifics.
      </P>

      <H2>Error envelope</H2>
      <CodeBlock language="json" code={`{
  "success": false,
  "error": {
    "code": "missing_scope",
    "message": "This key does not have the required scope: tenants:read",
    "request_id": "f0e1d2c3-…"
  }
}`} />

      <H2>Status code reference</H2>
      <div className="my-4 border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr><th className="p-2 text-left">Code</th><th className="p-2 text-left">Meaning</th><th className="p-2 text-left">What to do</th></tr>
          </thead>
          <tbody>
            {ROWS.map(([c, m, d]) => (
              <tr key={c} className="border-t">
                <td className="p-2 font-mono">{c}</td>
                <td className="p-2">{m}</td>
                <td className="p-2 text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H2>Always log the request_id</H2>
      <P>
        Every error includes a <code>request_id</code> (also returned as the{" "}
        <code>X-Request-Id</code> response header). Include it when you contact support
        and we can trace exactly what happened.
      </P>

      <NextPrev
        prev={{ to: "/developers/docs/rate-limits", label: "Rate limits" }}
        next={{ to: "/developers/docs/tutorials/verify-landlord", label: "Tutorial: Verify a landlord" }}
      />
    </DocsLayout>
  );
}

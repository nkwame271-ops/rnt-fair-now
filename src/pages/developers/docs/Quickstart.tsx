import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, CodeTabs, Callout, NextPrev, H2, H3, P, OpenInSandbox, API_BASE } from "@/components/developers/docs/DocPrimitives";

export default function DocsQuickstart() {
  const curl = `curl -X POST ${API_BASE} \\
  -H "X-API-Key: rcg_test_YOUR_KEY_HERE" \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpoint": "landlords/list",
    "filters": { "page": 1, "limit": 5 }
  }'`;

  const js = `const res = await fetch("${API_BASE}", {
  method: "POST",
  headers: {
    "X-API-Key": "rcg_test_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    endpoint: "landlords/list",
    filters: { page: 1, limit: 5 },
  }),
});
const json = await res.json();
console.log(json);`;

  const python = `import requests

r = requests.post(
  "${API_BASE}",
  headers={
    "X-API-Key": "rcg_test_YOUR_KEY_HERE",
    "Content-Type": "application/json",
  },
  json={"endpoint": "landlords/list", "filters": {"page": 1, "limit": 5}},
)
print(r.json())`;

  return (
    <DocsLayout
      title="Quickstart (5 minutes)"
      description="Sign up, get a sandbox key, and make your first API call in under five minutes."
    >
      <P>
        This guide walks you from zero to a working API call. No credit card, no admin
        approval needed for sandbox.
      </P>

      <H2>Step 1 — Create your developer account</H2>
      <P>
        Go to <a className="text-primary underline" href="/developers/signup">developers/signup</a>,
        fill in your name, work email, and organization name, then verify your email.
        That's it — no waiting.
      </P>

      <H2>Step 2 — Copy your sandbox key</H2>
      <P>
        After you log in for the first time, the dashboard automatically issues you a
        sandbox key. It looks like this:
      </P>
      <CodeBlock code={`rcg_test_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`} />
      <Callout kind="warn" title="You only see the key once">
        Copy it into a secret manager (1Password, AWS Secrets Manager, your <code>.env</code>{" "}
        file) immediately. After you close the dialog only the prefix is visible.
      </Callout>

      <H2>Step 3 — Make your first call</H2>
      <P>
        Replace <code>rcg_test_YOUR_KEY_HERE</code> with your real key and run:
      </P>
      <CodeTabs curl={curl} js={js} python={python} />
      <OpenInSandbox endpoint="landlords/list" params={{ page: 1, limit: 5 }} />

      <H2>Step 4 — Read the response</H2>
      <CodeBlock language="json" code={`{
  "success": true,
  "endpoint": "landlords/list",
  "agency": "Your Organization",
  "data": [
    {
      "landlord_id": "LL-2025-000123",
      "full_name": "Kwame Mensah",
      "phone": "0244111222",
      "region": "Greater Accra",
      "property_count": 3,
      "registered_at": "2025-04-12T09:31:00Z"
    }
  ],
  "meta": { "page": 1, "page_size": 5, "request_id": "f0e1d2c3-…" }
}`} />
      <P>
        Every response carries an <code>X-Request-Id</code> header. Log it — support
        tickets are resolved against that ID.
      </P>

      <H2>Step 5 — Request live access when ready</H2>
      <P>
        Sandbox uses synthetic data. When you're ready for real data, go to{" "}
        <a className="text-primary underline" href="/developers/request-access">Request live access</a>,
        select the scopes you need, and accept the Data Sharing Agreement. An admin
        reviews each request within 1–3 business days. You'll receive an email when a
        live key is issued.
      </P>

      <Callout kind="tip">
        You can keep using your sandbox key indefinitely — even after you have a live
        key — for development and staging environments.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs", label: "Introduction" }}
        next={{ to: "/developers/docs/auth", label: "Authentication" }}
      />
    </DocsLayout>
  );
}

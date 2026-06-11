import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, NextPrev, H2, P, Callout } from "@/components/developers/docs/DocPrimitives";

export default function DocsTutorialRetries() {
  return (
    <DocsLayout title="Retries & idempotency" description="Retry transient errors safely without double-processing.">
      <P>
        For network errors, 5xx responses, and 429s, retry with exponential back-off.
        For idempotent reads (which is everything in this API), retries are always safe.
      </P>

      <H2>Add Idempotency-Key</H2>
      <P>
        Even though endpoints are read-only, sending an <code>Idempotency-Key</code> (UUID)
        lets us return the exact same response for retries — useful when your client
        retried because of a network blip but the request actually succeeded.
      </P>
      <CodeBlock code={`Idempotency-Key: 0c83f57c-1234-4abd-9c79-9f3e6f2ac1aa`} />

      <H2>Exponential back-off</H2>
      <CodeBlock language="javascript" code={`async function retry(fn, max = 5) {
  for (let i = 0; i < max; i++) {
    try {
      const res = await fn();
      if (res.status < 500 && res.status !== 429) return res;
    } catch {}
    await new Promise(r => setTimeout(r, 2 ** i * 250 + Math.random() * 100));
  }
  throw new Error("Retries exhausted");
}`} />

      <Callout kind="warn" title="Don't retry 4xx (except 429)">
        4xx errors mean your request is wrong — retrying won't help. Fix the request
        and try again.
      </Callout>

      <NextPrev
        prev={{ to: "/developers/docs/tutorials/pagination", label: "Pagination" }}
        next={{ to: "/developers/docs/reference/landlords", label: "Reference: Landlords" }}
      />
    </DocsLayout>
  );
}

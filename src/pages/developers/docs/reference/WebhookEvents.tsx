import DocsLayout from "@/components/developers/docs/DocsLayout";
import { CodeBlock, NextPrev, H2, P } from "@/components/developers/docs/DocPrimitives";

const EVENTS = [
  ["tenancy.created", "A new tenancy was registered."],
  ["tenancy.renewed", "A tenancy was renewed."],
  ["tenancy.terminated", "A tenancy was terminated."],
  ["complaint.created", "A new complaint was filed."],
  ["complaint.status_changed", "A complaint status changed (open→under review→resolved)."],
  ["complaint.resolved", "A complaint reached a final decision."],
  ["property.registered", "A new property was registered."],
  ["property.updated", "Property details changed."],
  ["landlord.kyc_completed", "A landlord finished Ghana Card KYC."],
];

export default function RefWebhooks() {
  return (
    <DocsLayout title="Reference — Webhook events" description="All events you can subscribe to, with payload shapes.">
      <P>Configure endpoints in Dashboard → Webhooks. Each delivery includes <code>X-RCG-Signature</code>.</P>

      <H2>Common envelope</H2>
      <CodeBlock language="json" code={`{
  "id": "evt_…",
  "type": "<event>",
  "created_at": "ISO-8601",
  "data": { /* event-specific */ }
}`} />

      <H2>Available events</H2>
      <div className="my-4 border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr><th className="p-2 text-left">Event</th><th className="p-2 text-left">When it fires</th></tr>
          </thead>
          <tbody>
            {EVENTS.map(([e, d]) => (
              <tr key={e} className="border-t">
                <td className="p-2 font-mono text-xs">{e}</td>
                <td className="p-2 text-xs text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <NextPrev
        prev={{ to: "/developers/docs/reference/complaints", label: "Complaints" }}
        next={{ to: "/developers/docs/go-live", label: "Going live" }}
      />
    </DocsLayout>
  );
}

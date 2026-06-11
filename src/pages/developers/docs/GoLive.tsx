import DocsLayout from "@/components/developers/docs/DocsLayout";
import { NextPrev, H2, P, UL, Callout } from "@/components/developers/docs/DocPrimitives";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DocsGoLive() {
  return (
    <DocsLayout title="Request live access" description="What an admin reviewer looks for, and how long it takes.">
      <P>
        Sandbox is self-serve. Live access — production data — is gated. An admin
        reviews every request to make sure your use case complies with Ghana's data
        protection rules and the Rent Control Act.
      </P>

      <H2>Before you apply</H2>
      <UL>
        <li>Build and test in sandbox until your integration works end-to-end.</li>
        <li>Have your organization's official email and contact phone ready.</li>
        <li>Know which scopes you actually need (request least privilege).</li>
        <li>Be ready to describe your end user and lawful basis for processing.</li>
      </UL>

      <H2>How to apply</H2>
      <P>
        From your dashboard, click <strong>Request live access</strong>, or go to{" "}
        <Link to="/developers/request-access" className="text-primary underline">developers/request-access</Link>.
        Fill in scopes, agency type, expected monthly volume, justification, and accept
        the Data Sharing Agreement.
      </P>

      <H2>What happens next</H2>
      <UL>
        <li>You're redirected to a status page showing "Pending review".</li>
        <li>An admin reviews within <strong>1–3 business days</strong>.</li>
        <li>You receive an email + in-app notification when there's a decision.</li>
        <li>On approval, the admin issues your live key — it appears in your Keys tab.</li>
      </UL>

      <Callout kind="warn" title="Don't share keys across organizations">
        Each org gets its own key tied to its DSA. Sharing keys breaks the audit trail
        and is grounds for revocation.
      </Callout>

      <div className="mt-6"><Link to="/developers/request-access"><Button>Start an access request</Button></Link></div>

      <NextPrev
        prev={{ to: "/developers/docs/reference/webhooks", label: "Webhook events" }}
        next={{ to: "/developers/docs/dsa", label: "Data Sharing Agreement" }}
      />
    </DocsLayout>
  );
}

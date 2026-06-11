import DocsLayout from "@/components/developers/docs/DocsLayout";
import { NextPrev, H2, P, Callout } from "@/components/developers/docs/DocPrimitives";
import { Link } from "react-router-dom";

export default function DocsPricing() {
  return (
    <DocsLayout title="Pricing & billing" description="Free during beta. Paid plans coming soon.">
      <Callout kind="info" title="Free during beta — no payment required">
        While the API is in beta, every plan is free of charge. We'll notify you at
        least 30 days before billing opens.
      </Callout>
      <H2>Plans</H2>
      <P>See the full plan grid at <Link to="/developers/api/pricing" className="text-primary underline">/developers/api/pricing</Link>.</P>
      <H2>How billing will work</H2>
      <P>
        Subscriptions are monthly via Paystack (Ghana). Overage is billed at the rate
        listed on your plan. Invoices appear in Dashboard → Billing.
      </P>
      <NextPrev
        prev={{ to: "/developers/docs/dsa", label: "DSA" }}
        next={{ to: "/developers/docs/support", label: "Support & SLA" }}
      />
    </DocsLayout>
  );
}

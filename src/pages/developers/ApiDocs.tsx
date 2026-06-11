import { Helmet } from "react-helmet-async";
import { Shield } from "lucide-react";
import ApiDocsContent from "@/components/agency-api/ApiDocsContent";
import { Link } from "react-router-dom";

export default function PublicApiDocs() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Agency API Documentation — Rent Control Ghana</title>
        <meta name="description" content="Read-only API reference for partner agencies integrating with Rent Control Ghana — landlords, tenants, properties and complaints." />
        <link rel="canonical" href="https://rentcontrolghana.com/developers/api" />
      </Helmet>

      <header className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Rent Control Ghana — Developers</span>
          </Link>
          <Link to="/contact" className="text-sm text-primary hover:underline">Request access</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Agency API</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            A read-only HTTP API for accredited government agencies and institutional
            partners. Access is granted by the Rent Control regulator and tied to a
            signed data-sharing agreement.
          </p>
        </div>
        <ApiDocsContent />
      </main>
    </div>
  );
}

import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Building2, Users, Home, FileWarning, Shield, Code2, Webhook, Activity } from "lucide-react";

const PILLARS = [
  { icon: Building2, title: "Landlords", desc: "Verified landlord directory, registration status, tax footprint." },
  { icon: Users, title: "Tenants", desc: "Tenancy lifecycle data, registration status, rent card delivery." },
  { icon: Home, title: "Properties", desc: "Property inventory by region, vacancy and condition signals." },
  { icon: FileWarning, title: "Complaints", desc: "Case volumes, resolution rates, status changes via webhooks." },
];

const FEATURES = [
  { icon: Code2, title: "REST + JSON", desc: "Stable v1 endpoints, OpenAPI 3.1 spec, idempotency keys." },
  { icon: Webhook, title: "Webhooks", desc: "HMAC-signed events for tenancy, complaints and property changes." },
  { icon: Shield, title: "Government-grade", desc: "Per-key scopes, IP allowlists, PII masking, full audit log." },
  { icon: Activity, title: "Live metrics", desc: "Real-time usage, error rates and rate-limit headroom." },
];

export default function DevelopersLanding() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Build with Rent Control Ghana — Developer Portal</title>
        <meta name="description" content="Self-service API access for partner agencies and developers. Get a sandbox key in minutes, request live access when ready." />
        <link rel="canonical" href="https://rentcontrolghana.com/developers" />
      </Helmet>

      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Rent Control Ghana — Developers</span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/developers/api" className="px-3 py-1.5 hover:underline">Docs</Link>
            <Link to="/developers/api/pricing" className="px-3 py-1.5 hover:underline">Pricing</Link>
            <Link to="/developers/login"><Button variant="ghost" size="sm">Log in</Button></Link>
            <Link to="/developers/signup"><Button size="sm">Get started</Button></Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <Badge variant="secondary" className="mb-4">Free during beta — no card required</Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
            Build on Ghana's rental data infrastructure
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            A read-only API for accredited agencies and partners. Sign up, get a sandbox key
            in under a minute, then request live access when you're ready to ship.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Link to="/developers/signup"><Button size="lg">Get a sandbox key <ArrowRight className="h-4 w-4 ml-1.5" /></Button></Link>
            <Link to="/developers/api"><Button size="lg" variant="outline">Read the docs</Button></Link>
          </div>
        </section>

        {/* Pillars */}
        <section className="mx-auto max-w-6xl px-4 py-8">
          <h2 className="text-2xl font-semibold text-center mb-8">Four data pillars, one consistent API</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PILLARS.map((p) => (
              <Card key={p.title}>
                <CardContent className="p-5">
                  <p.icon className="h-6 w-6 text-primary mb-3" />
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-4 border rounded-lg bg-card">
                <f.icon className="h-5 w-5 text-primary mb-2" />
                <p className="font-medium text-sm">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-4xl px-4 py-12">
          <h2 className="text-2xl font-semibold text-center mb-8">How it works</h2>
          <ol className="space-y-4">
            {[
              ["Create your developer account", "Free, no credit card. Just verify your email."],
              ["Get a sandbox key automatically", "Test every endpoint against safe sandbox data."],
              ["Request live access", "Submit your agency info & sign the Data Sharing Agreement. A regulator approves and issues a live key."],
              ["Ship to production", "Track usage, rotate keys, register webhooks — all from your dashboard."],
            ].map(([title, desc], i) => (
              <li key={title} className="flex gap-4 p-4 border rounded-lg bg-card">
                <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold flex-shrink-0">{i + 1}</div>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Link to="/developers/signup"><Button size="lg">Create your account <ArrowRight className="h-4 w-4 ml-1.5" /></Button></Link>
          </div>
        </section>
      </main>

      <footer className="border-t bg-card mt-12">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>© Rent Control Ghana</span>
          <div className="flex gap-4">
            <Link to="/developers/api" className="hover:underline">API Docs</Link>
            <Link to="/developers/api/pricing" className="hover:underline">Pricing</Link>
            <Link to="/contact" className="hover:underline">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { ReactNode, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Shield, Search, Menu, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const DOCS_NAV = [
  {
    section: "Getting started",
    items: [
      { to: "/developers/docs", label: "Introduction", end: true },
      { to: "/developers/docs/quickstart", label: "Quickstart (5 min)" },
      { to: "/developers/docs/auth", label: "Authentication" },
      { to: "/developers/docs/environments", label: "Environments" },
      { to: "/developers/docs/rate-limits", label: "Rate limits & quotas" },
      { to: "/developers/docs/errors", label: "Errors & status codes" },
    ],
  },
  {
    section: "Tutorials",
    items: [
      { to: "/developers/docs/tutorials/verify-landlord", label: "Verify a landlord" },
      { to: "/developers/docs/tutorials/check-tenancy", label: "Check a tenancy" },
      { to: "/developers/docs/tutorials/lookup-property", label: "Look up a property" },
      { to: "/developers/docs/tutorials/webhooks", label: "Receive webhooks" },
      { to: "/developers/docs/tutorials/pagination", label: "Handle pagination" },
      { to: "/developers/docs/tutorials/retries", label: "Retries & idempotency" },
    ],
  },
  {
    section: "Reference",
    items: [
      { to: "/developers/docs/reference/landlords", label: "Landlords" },
      { to: "/developers/docs/reference/tenants", label: "Tenants" },
      { to: "/developers/docs/reference/properties", label: "Properties" },
      { to: "/developers/docs/reference/complaints", label: "Complaints" },
      { to: "/developers/docs/reference/webhooks", label: "Webhook events" },
    ],
  },
  {
    section: "Going live",
    items: [
      { to: "/developers/docs/go-live", label: "Request live access" },
      { to: "/developers/docs/dsa", label: "Data Sharing Agreement" },
      { to: "/developers/docs/pricing", label: "Pricing & billing" },
      { to: "/developers/docs/support", label: "Support & SLA" },
    ],
  },
];

interface Props {
  title: string;
  description?: string;
  canonicalPath?: string;
  children: ReactNode;
}

export default function DocsLayout({ title, description, canonicalPath, children }: Props) {
  const [q, setQ] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  const canonical = canonicalPath ?? loc.pathname;
  const filtered = q
    ? DOCS_NAV.map((g) => ({
        ...g,
        items: g.items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase())),
      })).filter((g) => g.items.length)
    : DOCS_NAV;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{title} — Rent Control Ghana API</title>
        {description && <meta name="description" content={description} />}
        <link rel="canonical" href={`https://rentcontrolghana.com${canonical}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: title,
          description,
          url: `https://rentcontrolghana.com${canonical}`,
        })}</script>
      </Helmet>

      <header className="border-b bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/developers" className="flex items-center gap-2 min-w-0">
            <Shield className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold truncate">Rent Control Ghana — Docs</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link to="/developers/docs/quickstart" className="px-3 py-1.5 hover:underline">Quickstart</Link>
            <Link to="/developers/docs/reference/landlords" className="px-3 py-1.5 hover:underline">Reference</Link>
            <Link to="/developers/api/pricing" className="px-3 py-1.5 hover:underline">Pricing</Link>
            <Link to="/developers/dashboard"><Button size="sm">Dashboard</Button></Link>
          </nav>
          <button className="md:hidden p-2" onClick={() => setMobileOpen((o) => !o)} aria-label="Toggle navigation">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        <aside className={`col-span-12 md:col-span-3 lg:col-span-3 ${mobileOpen ? "" : "hidden md:block"}`}>
          <div className="sticky top-20 space-y-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search docs…"
                className="pl-8"
              />
            </div>
            <nav className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2">
              {filtered.map((g) => (
                <div key={g.section}>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-2 mb-1">
                    {g.section}
                  </p>
                  <div className="space-y-0.5">
                    {g.items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={(i as any).end}
                        onClick={() => setMobileOpen(false)}
                        className={({ isActive }) =>
                          `block px-2 py-1.5 rounded text-sm ${
                            isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                          }`
                        }
                      >
                        {i.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="col-span-12 md:col-span-9 lg:col-span-9 max-w-3xl">
          <article className="prose-sm">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
            {description && <p className="text-muted-foreground text-base mb-6">{description}</p>}
            {children}
          </article>
        </main>
      </div>
    </div>
  );
}

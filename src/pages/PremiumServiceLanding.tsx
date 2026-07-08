import { useNavigate } from "react-router-dom";
import { Shield, Users, CalendarClock, ClipboardCheck, PhoneCall, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";

const features = [
  { icon: Users, title: "Dedicated Agent", body: "Every subscribed property or tenant is assigned a verified Rent Control agent as a single point of contact." },
  { icon: ClipboardCheck, title: "Full Property Management", body: "Rent collection, tenant onboarding, receipting, inspections, renewals and issue triage handled end-to-end." },
  { icon: CalendarClock, title: "Yearly Subscription", body: "One transparent annual fee per property or tenant. No hidden charges. Renewal reminders sent automatically." },
  { icon: Shield, title: "Compliance Safety Net", body: "Your agent keeps you compliant with Rent Act 220 — advance-rent limits, notices, receipts and forms." },
  { icon: PhoneCall, title: "Priority Support", body: "Direct line to your agent plus fast-track escalation for disputes, complaints and safety incidents." },
];

const PremiumServiceLanding = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Premium Service | Rent Control Ghana"
        description="Per-property Premium Service subscriptions for landlords and tenants — dedicated agents, full management support, and compliance oversight."
        canonicalPath="/premium-service"
      />

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="font-bold text-lg text-foreground">Rent Control Ghana</button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Sign in</Button>
            <Button size="sm" onClick={() => navigate("/agent/register")}>Apply as Agent</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto max-w-6xl px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold mb-4">
          <Sparkles className="h-3.5 w-3.5" /> Premium Service
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
          Full management support, backed by a verified agent.
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          A per-property annual subscription that pairs landlords and tenants with a dedicated Rent Control agent
          for rent collection, compliance, receipts, renewals and full property management support.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" onClick={() => navigate("/login")}>
            Subscribe to Premium <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/agent/register")}>
            Apply to become a Premium Agent
          </Button>
        </div>
      </section>

      {/* What you get */}
      <section className="container mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-6">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agent apply CTA */}
      <section className="container mx-auto max-w-4xl px-4 py-16">
        <div className="rounded-3xl border border-border bg-card p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold text-foreground">Are you an experienced property manager?</h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Apply to be a Premium Service Agent. You will go through the standard agent verification, approval and
            onboarding workflow before being assigned to subscribed landlords and tenants.
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={() => navigate("/agent/register")}>
              Start Agent Application <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto max-w-6xl px-4 text-center text-xs text-muted-foreground">
          Rent Act, 1963 (Act 220) · Rent Control Ghana
        </div>
      </footer>
    </div>
  );
};

export default PremiumServiceLanding;

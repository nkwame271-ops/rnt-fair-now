import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export default function ApiPricing() {
  const { data: cfg } = useQuery({
    queryKey: ["billing-master-public"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config")
        .select("config_value").eq("config_key", "agency_api_billing_enabled").maybeSingle();
      return !!(data?.config_value as any)?.enabled;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["api-plans-public"],
    queryFn: async () => {
      const { data } = await supabase.from("api_pricing_plans" as any)
        .select("*").eq("is_public", true).eq("is_active", true).order("sort_order");
      return (data as any[]) || [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Agency API Pricing — Rent Control Ghana</title>
        <meta name="description" content="Pricing plans for the Rent Control Ghana Agency API. Connect GRA, NIA, GSS and accredited partners." />
        <link rel="canonical" href="https://rentcontrolghana.com/developers/api/pricing" />
      </Helmet>

      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">Rent Control Ghana</Link>
          <Link to="/developers/api" className="text-sm text-primary hover:underline">API Docs →</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h1 className="text-4xl font-bold mb-3">Agency API Pricing</h1>
          <p className="text-muted-foreground">
            Read-only access to rent, tenancy, property and complaint data for accredited Ghanaian agencies.
          </p>
        </div>

        {!cfg && (
          <Card className="mb-8 border-primary/40 bg-primary/5">
            <CardContent className="py-4 text-center text-sm">
              <Shield className="h-4 w-4 inline mr-2 text-primary" />
              <strong>Free during beta.</strong> All accredited agencies currently have free access. Pricing below shows future plans.
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((p: any) => (
            <Card key={p.id} className={p.is_enterprise ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{p.name}</CardTitle>
                  {p.is_enterprise && <Badge>Custom</Badge>}
                </div>
                <CardDescription>{p.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold">
                  {p.is_enterprise ? "Custom" : <>GHS {Number(p.price_ghs).toLocaleString()}<span className="text-base font-normal text-muted-foreground">/mo</span></>}
                </div>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {Number(p.included_calls).toLocaleString()} calls / month</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.rate_limit_per_minute}/min rate limit</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.environment_access} environment</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> {p.webhook_endpoints_max} webhook endpoint{p.webhook_endpoints_max !== 1 ? "s" : ""}</li>
                  {p.overage_price_ghs_per_1k && (
                    <li className="flex gap-2"><Check className="h-4 w-4 text-primary mt-0.5" /> GHS {p.overage_price_ghs_per_1k} per 1k overage</li>
                  )}
                  <li className="flex gap-2 text-xs text-muted-foreground">{(p.allowed_scopes || []).join(", ")}</li>
                </ul>
                <Button className="w-full" variant={p.is_enterprise ? "default" : "outline"} asChild>
                  <Link to="/contact-us">{p.is_enterprise ? "Contact sales" : "Request access"}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-12 max-w-2xl mx-auto text-center text-sm text-muted-foreground">
          <p>All access requires a signed Data Sharing Agreement and accreditation by the Rent Control Department.</p>
          <p className="mt-2"><Link to="/developers/api" className="text-primary hover:underline">View full API documentation →</Link></p>
        </div>
      </main>
    </div>
  );
}

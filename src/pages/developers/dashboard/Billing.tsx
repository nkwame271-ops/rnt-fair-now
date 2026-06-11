import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, ExternalLink } from "lucide-react";

export default function DeveloperBilling() {
  const { data: cfg } = useQuery({
    queryKey: ["billing-master-switch"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config")
        .select("config_value").eq("config_key", "agency_api_billing_enabled").maybeSingle();
      return !!(data?.config_value as any)?.enabled;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["public-pricing-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("api_pricing_plans" as any)
        .select("*").eq("is_active", true).eq("is_public", true)
        .order("price_ghs");
      return (data as any[]) || [];
    },
  });

  const billingOn = !!cfg;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-muted-foreground">Manage your plan and view invoices.</p>
      </div>

      {!billingOn && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>Free during beta — no payment required</AlertTitle>
          <AlertDescription>
            All plans are free while the API is in beta. You'll be notified before billing opens.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                {p.name}
                {p.slug === "free" && <Badge variant="secondary">Default</Badge>}
              </CardTitle>
              <CardDescription>{p.tagline ?? `${p.included_calls} calls / month`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-semibold">
                {Number(p.price_ghs) > 0 ? `GHS ${Number(p.price_ghs).toLocaleString()}` : "Free"}
                {Number(p.price_ghs) > 0 && <span className="text-xs text-muted-foreground"> /mo</span>}
              </p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>{p.included_calls.toLocaleString()} calls / month included</li>
                <li>{p.rate_limit_per_minute ?? 60} req/min</li>
                <li>Access: {p.environment_access}</li>
              </ul>
              <Button size="sm" disabled={!billingOn} className="w-full" variant={billingOn ? "default" : "outline"}>
                {billingOn ? "Choose plan" : "Available when billing opens"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Pricing details</CardTitle></CardHeader>
        <CardContent>
          <Link to="/developers/api/pricing" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            View full pricing page <ExternalLink className="h-3 w-3" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

import { Link } from "react-router-dom";
import { useDeveloperOrg, useDeveloperKeys } from "@/hooks/useDeveloperOrg";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sparkles, ArrowRight, KeyRound, FlaskConical, ShieldCheck } from "lucide-react";
import AccessRequestBanner from "@/components/developers/AccessRequestBanner";

export default function DeveloperOverview() {
  const { data: org } = useDeveloperOrg();
  const { data: keys = [] } = useDeveloperKeys(org?.id);

  const keyIds = keys.map((k) => k.id);
  const { data: usage } = useQuery({
    queryKey: ["developer-usage-summary", keyIds.join(",")],
    enabled: keyIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { data } = await supabase
        .from("api_request_log" as any)
        .select("status_code, response_ms, created_at")
        .in("api_key_id", keyIds)
        .gte("created_at", since)
        .limit(5000);
      const rows = (data as any[]) || [];
      const errs = rows.filter((r) => r.status_code >= 400).length;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const today = rows.filter((r) => new Date(r.created_at) >= todayStart).length;
      const latencies = rows.map((r) => r.response_ms || 0).sort((a, b) => a - b);
      const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
      return { total30d: rows.length, today, errs, p95, errorRate: rows.length ? (errs / rows.length) * 100 : 0 };
    },
  });

  const sandboxKey = keys.find((k) => k.environment === "sandbox" && k.is_active);
  const liveKey = keys.find((k) => k.environment === "live" || k.environment === "production");

  return (
    <div className="space-y-6">
      <Alert>
        <Sparkles className="h-4 w-4" />
        <AlertTitle>Free during beta</AlertTitle>
        <AlertDescription>
          All API calls are free while we're in beta. You'll see your plan and usage here once billing opens.
        </AlertDescription>
      </Alert>

      <AccessRequestBanner />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Calls today</p>
          <p className="text-2xl font-semibold">{usage?.today ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Calls (30d)</p>
          <p className="text-2xl font-semibold">{usage?.total30d ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Error rate (30d)</p>
          <p className="text-2xl font-semibold">{(usage?.errorRate ?? 0).toFixed(1)}%</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground">p95 latency</p>
          <p className="text-2xl font-semibold">{usage?.p95 ?? 0} ms</p>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Sandbox</CardTitle>
            <CardDescription>Test against safe synthetic data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sandboxKey ? (
              <>
                <p className="text-sm">Key prefix: <code>{sandboxKey.key_prefix}…</code></p>
                <Badge variant="outline">Active</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No sandbox key yet.</p>
            )}
            <div className="pt-2 flex gap-2">
              <Link to="/developers/dashboard/keys"><Button size="sm" variant="outline">Manage keys</Button></Link>
              <Link to="/developers/dashboard/sandbox"><Button size="sm">Open console <ArrowRight className="h-3 w-3 ml-1" /></Button></Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Live access</CardTitle>
            <CardDescription>Requires regulator approval and a signed DSA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {liveKey ? (
              <>
                <p className="text-sm">Key prefix: <code>{liveKey.key_prefix}…</code></p>
                <Badge>Active</Badge>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">You don't have a live key yet.</p>
                <Link to="/developers/request-access"><Button size="sm"><KeyRound className="h-3 w-3 mr-1" /> Request live access</Button></Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

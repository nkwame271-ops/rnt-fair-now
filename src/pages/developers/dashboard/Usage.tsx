import { useQuery } from "@tanstack/react-query";
import { useDeveloperOrg, useDeveloperKeys } from "@/hooks/useDeveloperOrg";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function DeveloperUsage() {
  const { data: org } = useDeveloperOrg();
  const { data: keys = [] } = useDeveloperKeys(org?.id);
  const keyIds = keys.map((k) => k.id);

  const { data: rows = [] } = useQuery({
    queryKey: ["developer-usage-rows", keyIds.join(",")],
    enabled: keyIds.length > 0,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { data } = await supabase
        .from("api_request_log" as any)
        .select("endpoint, status_code, response_ms, created_at")
        .in("api_key_id", keyIds)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000);
      return (data as any[]) || [];
    },
  });

  const byEndpoint: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] || 0) + 1;
    const bucket = `${Math.floor(r.status_code / 100)}xx`;
    byStatus[bucket] = (byStatus[bucket] || 0) + 1;
  }
  const topEndpoints = Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Usage (last 30 days)</h1>
        <p className="text-sm text-muted-foreground">{rows.length} total requests across {keys.length} key(s).</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-3">
        {["2xx", "3xx", "4xx", "5xx"].map((s) => (
          <Card key={s}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s}</p>
            <p className="text-2xl font-semibold">{byStatus[s] ?? 0}</p>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Top endpoints</CardTitle></CardHeader>
        <CardContent>
          {topEndpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No calls in the last 30 days.</p>
          ) : (
            <div className="space-y-1.5">
              {topEndpoints.map(([ep, n]) => (
                <div key={ep} className="flex items-center justify-between text-sm">
                  <code>{ep}</code>
                  <Badge variant="outline">{n}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent requests</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs font-mono max-h-96 overflow-auto">
            {rows.slice(0, 50).map((r, i) => (
              <div key={i} className="flex gap-3 border-b py-1">
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleTimeString()}</span>
                <span className={r.status_code >= 400 ? "text-destructive" : ""}>{r.status_code}</span>
                <span className="text-muted-foreground">{r.response_ms}ms</span>
                <span className="truncate">{r.endpoint}</span>
              </div>
            ))}
            {rows.length === 0 && <p className="text-muted-foreground font-sans">No recent requests.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

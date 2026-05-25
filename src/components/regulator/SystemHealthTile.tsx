import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface Snapshot {
  id: string;
  captured_at: string;
  missing_receipts: number;
  missing_receipt_numbers: number;
  unreconciled: number;
  open_failures_24h: number;
  dashboard_stale_seconds: number | null;
  alert: boolean;
  db_connections_used: number | null;
  db_connections_max: number | null;
  db_connections_pct: number | null;
}

const SystemHealthTile = () => {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("system_health_snapshots")
      .select("id, captured_at, missing_receipts, missing_receipt_numbers, unreconciled, open_failures_24h, dashboard_stale_seconds, alert")
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSnapshot(data as Snapshot | null);
    setLoading(false);
  };

  const captureNow = async () => {
    setRefreshing(true);
    await supabase.rpc("capture_system_health_snapshot");
    await load();
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading system health…
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
        No snapshots yet.
      </div>
    );
  }

  const healthy = !snapshot.alert;

  return (
    <div className={`rounded-xl p-5 border-2 ${healthy ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          {healthy ? <CheckCircle2 className="h-5 w-5 text-success" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" /> System Health
            </h3>
            <p className="text-xs text-muted-foreground">
              Last check {formatDistanceToNow(new Date(snapshot.captured_at), { addSuffix: true })}
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={captureNow} disabled={refreshing}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${refreshing ? "animate-spin" : ""}`} />
          Re-check
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Metric label="Missing receipts" value={snapshot.missing_receipts} />
        <Metric label="Missing receipt #" value={snapshot.missing_receipt_numbers} />
        <Metric label="Unreconciled" value={snapshot.unreconciled} />
        <Metric label="Open failures 24h" value={snapshot.open_failures_24h} />
      </div>

      {snapshot.dashboard_stale_seconds !== null && (
        <p className="text-xs text-muted-foreground mt-3">
          Dashboard cache age: {snapshot.dashboard_stale_seconds}s
        </p>
      )}
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-card rounded-lg p-3 border border-border">
    <div className={`text-2xl font-bold ${value > 0 ? "text-destructive" : "text-foreground"}`}>{value}</div>
    <div className="text-xs text-muted-foreground mt-1">{label}</div>
  </div>
);

export default SystemHealthTile;

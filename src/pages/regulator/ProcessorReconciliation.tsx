import { useEffect, useMemo, useState } from "react";
import { Loader2, Wallet, RefreshCw, Download, AlertTriangle, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";
import { getVisibleRecipients } from "@/lib/revenue/visibleRecipients";
import PageTransition from "@/components/PageTransition";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { toast } from "sonner";

interface Partition {
  recipient: string;
  label: string;
  due: number;
  settled: number;
  remaining: number;
}

interface Discrepancy {
  recipient: string;
  ledger: number;
  processor: number;
  delta: number;
}

interface ReconciliationResponse {
  processor: string;
  range: { from: string; to: string };
  balance: { available: number; pending: number; currency: string } | null;
  total_collected: number;
  total_settled: number;
  next_payout: { expected_at: string; amount: number } | null;
  partitions: Partition[];
  discrepancies: Discrepancy[];
  viewer_is_super_admin: boolean;
  generated_at: string;
}

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const daysAgoIso = (n: number) => format(new Date(Date.now() - n * 86_400_000), "yyyy-MM-dd");

const ProcessorReconciliation = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const { isVisible } = useModuleVisibility("escrow");
  const isSuperAdmin = !!profile?.isSuperAdmin;

  const [from, setFrom] = useState(daysAgoIso(30));
  const [to, setTo] = useState(todayIso());
  const [processor, setProcessor] = useState<"paystack">("paystack");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReconciliationResponse | null>(null);

  // Client-side guard: even if the server slips up, drop hidden recipients here.
  const visible = useMemo(
    () => getVisibleRecipients({ isSuperAdmin, isVisible }),
    [isSuperAdmin, isVisible],
  );

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("processor-reconciliation", {
        body: null,
        method: "GET",
      } as any).catch(() => ({ data: null, error: { message: "invoke failed" } } as any));
      // The functions.invoke shape doesn't support query params natively; fall back to fetch.
      let payload: ReconciliationResponse | null = null;
      if (res) payload = res as ReconciliationResponse;
      if (!payload) {
        const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/processor-reconciliation?processor=${processor}&from=${from}&to=${to}`;
        const session = (await supabase.auth.getSession()).data.session;
        const r = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        });
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error || `HTTP ${r.status}`);
        payload = json;
      }
      setData(payload);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load reconciliation");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profileLoading) return;
    if (!profile?.isSuperAdmin && !profile?.isMainAdmin) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileLoading, profile?.adminType]);

  const filteredPartitions = useMemo(() => {
    if (!data) return [] as Partition[];
    return data.partitions.filter((p) => visible.has(p.recipient as any) || isSuperAdmin);
  }, [data, visible, isSuperAdmin]);

  const filteredDiscrepancies = useMemo(() => {
    if (!data) return [] as Discrepancy[];
    return data.discrepancies.filter((d) => visible.has(d.recipient as any) || isSuperAdmin);
  }, [data, visible, isSuperAdmin]);

  const headlineDue = useMemo(
    () => filteredPartitions.reduce((s, p) => s + p.remaining, 0),
    [filteredPartitions],
  );

  const exportCsv = () => {
    if (!data) return;
    const header = ["Recipient", "Due (GHS)", "Settled (GHS)", "Remaining (GHS)"].join(",");
    const rows = filteredPartitions.map((p) =>
      [p.label, p.due.toFixed(2), p.settled.toFixed(2), p.remaining.toFixed(2)].join(","),
    );
    const csv = [
      `Processor reconciliation — ${data.processor.toUpperCase()} (${data.range.from} → ${data.range.to})`,
      `Total collected: ${data.total_collected.toFixed(2)}`,
      `Total settled (processor): ${data.total_settled.toFixed(2)}`,
      "",
      header,
      ...rows,
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processor-reconciliation-${data.processor}-${data.range.from}_to_${data.range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (profileLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!profile?.isSuperAdmin && !profile?.isMainAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-card rounded-xl border border-border text-center">
        <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Restricted</h2>
        <p className="text-sm text-muted-foreground">
          Processor Reconciliation is reserved for Main and Super Admins.
        </p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" /> Processor Reconciliation
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Compare what the payment processor or bank has settled against what the ledger says is due.
              {!isSuperAdmin && " Platform amounts are excluded from your view."}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={processor}
              onChange={(e) => setProcessor(e.target.value as "paystack")}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="paystack">Paystack</option>
            </select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
            <Button onClick={load} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button onClick={exportCsv} disabled={!data} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !data ? (
          <div className="p-8 text-center text-sm text-muted-foreground bg-card border border-border rounded-xl">
            No data yet. Pick a date range and click Refresh.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Processor Balance" value={data.balance?.available ?? 0} hint={data.balance ? `${data.balance.currency} · pending ${data.balance.pending.toFixed(2)}` : "Unavailable"} />
              <StatCard label="Total Collected" value={data.total_collected} hint={`${data.range.from} → ${data.range.to}`} />
              <StatCard label="Already Settled" value={data.total_settled} hint="Per processor" />
              <StatCard label="Remaining Due" value={headlineDue} hint="Ledger vs processor" highlight />
            </div>

            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-card-foreground">Per-Recipient Reconciliation</h2>
                <Badge variant="outline" className="text-xs">{filteredPartitions.length} recipients</Badge>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Recipient</th>
                      <th className="text-right px-4 py-2">Due (Ledger)</th>
                      <th className="text-right px-4 py-2">Settled</th>
                      <th className="text-right px-4 py-2">Remaining</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredPartitions.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No splits in range.</td></tr>
                    ) : filteredPartitions.map((p) => (
                      <tr key={p.recipient} className="hover:bg-muted/20">
                        <td className="px-4 py-2 text-card-foreground">{p.label}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p.due.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{p.settled.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">{p.remaining.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {filteredDiscrepancies.length > 0 && (
              <div className="bg-card rounded-xl border border-warning/40 shadow-card overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <h2 className="font-semibold text-card-foreground">Discrepancies</h2>
                </div>
                <div className="divide-y divide-border">
                  {filteredDiscrepancies.map((d) => (
                    <div key={d.recipient} className="px-4 py-3 flex items-center justify-between text-sm">
                      <span className="text-card-foreground">{d.recipient}</span>
                      <span className="text-muted-foreground text-xs">
                        Ledger {d.ledger.toFixed(2)} · Processor {d.processor.toFixed(2)} · Δ {d.delta.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-right">
              Generated {format(new Date(data.generated_at), "MMM d, yyyy HH:mm")}
            </p>
          </>
        )}
      </div>
    </PageTransition>
  );
};

const StatCard = ({ label, value, hint, highlight }: { label: string; value: number; hint?: string; highlight?: boolean }) => (
  <div className={`bg-card rounded-xl border ${highlight ? "border-primary/40" : "border-border"} shadow-card p-5`}>
    <div className="text-sm text-muted-foreground">{label}</div>
    <p className={`text-2xl font-bold mt-2 ${highlight ? "text-primary" : "text-foreground"}`}>
      GHS <AnimatedCounter value={Math.round(value)} />
    </p>
    {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
  </div>
);

export default ProcessorReconciliation;

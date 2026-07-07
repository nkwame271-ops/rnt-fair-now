import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert, Wallet, TrendingUp, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Seo from "@/components/Seo";

// Recipients considered "platform" revenue (aggregated for Super Admin view only)
const PLATFORM_RECIPIENTS = ["platform", "rent_control_hq", "admin_hq"];

type Bucket = {
  key: string;
  label: string;
  match: (row: any) => boolean;
};

const BUCKETS: Bucket[] = [
  {
    key: "premium_service",
    label: "Premium Service (Agents)",
    match: (r) => /premium|agent/i.test(r.description || ""),
  },
  {
    key: "wallet_fees",
    label: "NAFLIS Wallet Fees",
    match: (r) => /wallet|naflis/i.test(r.description || ""),
  },
  {
    key: "rent_management",
    label: "Rent Management",
    match: (r) => /rent.*(management|collect|arrears)/i.test(r.description || ""),
  },
  {
    key: "maintenance",
    label: "Maintenance Deductions",
    match: (r) => /maintenance|repair/i.test(r.description || ""),
  },
  {
    key: "agreement_sales",
    label: "Agreement Sales",
    match: (r) => /agreement.*sale/i.test(r.description || ""),
  },
  {
    key: "rent_cards",
    label: "Rent Cards",
    match: (r) => /rent.?card/i.test(r.description || ""),
  },
  {
    key: "service_fees",
    label: "Service / Processing Fees",
    match: (r) => /service fee|processing/i.test(r.description || ""),
  },
];

const PlatformEscrowDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("is_super_admin" as any, { _user_id: user.id });
      const ok = !!data;
      setAuthorized(ok);
      setChecking(false);
      if (!ok) return;
      setLoading(true);
      const { data: splits } = await supabase
        .from("escrow_splits")
        .select("id, recipient, amount, description, released_at, status, disbursement_status, office_id, is_service_fee, escrow_transaction_id")
        .in("recipient", PLATFORM_RECIPIENTS)
        .order("released_at", { ascending: false, nullsFirst: false })
        .limit(2000);
      setRows(splits || []);
      setLoading(false);
    })();
  }, [user]);

  const summary = useMemo(() => {
    const buckets: Record<string, { total: number; count: number }> = {};
    for (const b of BUCKETS) buckets[b.key] = { total: 0, count: 0 };
    let other = { total: 0, count: 0 };
    let grand = 0;
    for (const r of rows) {
      const amt = Number(r.amount || 0);
      grand += amt;
      const match = BUCKETS.find((b) => b.match(r));
      if (match) {
        buckets[match.key].total += amt;
        buckets[match.key].count += 1;
      } else {
        other.total += amt;
        other.count += 1;
      }
    }
    return { buckets, other, grand };
  }, [rows]);

  const downloadCsv = () => {
    const header = ["released_at", "recipient", "amount", "description", "status", "office_id"].join(",");
    const body = rows.map((r) =>
      [r.released_at || "", r.recipient, r.amount, `"${(r.description || "").replace(/"/g, '""')}"`, r.status || "", r.office_id || ""].join(","),
    ).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `platform-escrow-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (checking) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!authorized) return (
    <div className="max-w-md mx-auto rounded-2xl border border-border bg-card p-8 text-center space-y-3">
      <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
      <h1 className="text-xl font-bold">Restricted</h1>
      <p className="text-sm text-muted-foreground">Platform Escrow is visible to Super Admins only.</p>
      <Button variant="outline" onClick={() => navigate("/regulator/dashboard")}>Back</Button>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Seo title="Platform Escrow | Super Admin" description="Aggregated platform revenue across all sources." canonicalPath="/regulator/platform-escrow" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-amber-500" /> Platform Escrow
            <Badge className="bg-amber-500 text-white">Super Admin</Badge>
          </h1>
          <p className="text-muted-foreground mt-1">
            Aggregated platform-side revenue across Premium Service, wallet fees, rent management, maintenance, and other platform charges.
          </p>
        </div>
        <Button variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Total platform revenue</p>
                <p className="text-4xl font-extrabold text-primary mt-2">GHS {summary.grand.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">{rows.length.toLocaleString()} escrow splits</p>
              </div>
              <TrendingUp className="h-10 w-10 text-primary/60" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BUCKETS.map((b) => {
              const v = summary.buckets[b.key];
              return (
                <div key={b.key} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{b.label}</p>
                  <p className="text-2xl font-bold mt-2">GHS {v.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.count} entries</p>
                </div>
              );
            })}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Other platform charges</p>
              <p className="text-2xl font-bold mt-2">GHS {summary.other.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground mt-1">{summary.other.count} entries</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Recent platform escrow splits</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2">Released</th>
                    <th className="text-left px-4 py-2">Recipient</th>
                    <th className="text-left px-4 py-2">Description</th>
                    <th className="text-right px-4 py-2">Amount</th>
                    <th className="text-left px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">{r.released_at ? format(new Date(r.released_at), "dd MMM yy") : "—"}</td>
                      <td className="px-4 py-2">{r.recipient}</td>
                      <td className="px-4 py-2 max-w-[380px] truncate" title={r.description}>{r.description}</td>
                      <td className="px-4 py-2 text-right font-semibold">GHS {Number(r.amount).toLocaleString()}</td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{r.disbursement_status || r.status || "—"}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No platform escrow entries.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PlatformEscrowDashboard;

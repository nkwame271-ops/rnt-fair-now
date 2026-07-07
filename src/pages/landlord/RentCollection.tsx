import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Wallet, Users, Building2, Download, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import Seo from "@/components/Seo";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    paid: "bg-success/10 text-success",
    partial: "bg-blue-100 text-blue-800",
    pending: "bg-yellow-100 text-yellow-800",
    overdue: "bg-destructive/10 text-destructive",
    unpaid: "bg-yellow-100 text-yellow-800",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

const LandlordRentCollection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [propMap, setPropMap] = useState<Record<string, string>>({});
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [payments, setPayments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [splits, setSplits] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: ts } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, unit_id, agreed_rent, start_date, end_date, status")
        .eq("landlord_user_id", user.id);
      const tenancyIds = (ts || []).map((t: any) => t.id);
      const tenantIds = [...new Set((ts || []).map((t: any) => t.tenant_user_id).filter(Boolean))];
      const unitIds = [...new Set((ts || []).map((t: any) => t.unit_id).filter(Boolean))];

      const [pays, recs, unitsRes, profs, walletRes] = await Promise.all([
        tenancyIds.length
          ? supabase.from("rent_payments").select("*").in("tenancy_id", tenancyIds).order("due_date", { ascending: false })
          : Promise.resolve({ data: [] as any[] }),
        tenancyIds.length
          ? supabase.from("payment_receipts").select("id, receipt_number, tenancy_id, total_amount, payment_type, created_at, status")
              .in("tenancy_id", tenancyIds).order("created_at", { ascending: false }).limit(200)
          : Promise.resolve({ data: [] as any[] }),
        unitIds.length
          ? supabase.from("units").select("id, unit_number, property_id").in("id", unitIds)
          : Promise.resolve({ data: [] as any[] }),
        tenantIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", tenantIds as string[])
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("wallets").select("available_balance, currency").eq("user_id", user.id).maybeSingle(),
      ]);

      // Properties (via units)
      const propertyIds = [...new Set((unitsRes.data || []).map((u: any) => u.property_id).filter(Boolean))];
      let propAddrMap: Record<string, string> = {};
      if (propertyIds.length) {
        const { data: props } = await supabase.from("properties").select("id, address").in("id", propertyIds);
        propAddrMap = Object.fromEntries((props || []).map((p: any) => [p.id, p.address]));
      }
      const unitToProp = Object.fromEntries((unitsRes.data || []).map((u: any) => [u.id, u.property_id]));
      const perTenancyProp: Record<string, string> = {};
      (ts || []).forEach((t: any) => {
        const pid = unitToProp[t.unit_id];
        if (pid) perTenancyProp[t.id] = propAddrMap[pid] || pid.slice(0, 8);
      });

      // Escrow splits recipients matching this landlord (best-effort — recipient stored as text/label)
      const { data: splitRows } = tenancyIds.length
        ? await supabase
            .from("escrow_splits")
            .select("id, amount, description, released_at, disbursement_status, escrow_transaction_id")
            .eq("recipient", "landlord")
            .order("released_at", { ascending: false, nullsFirst: false })
            .limit(200)
        : { data: [] as any[] } as any;

      setTenancies(ts || []);
      setPropMap(perTenancyProp);
      setNameMap(Object.fromEntries((profs.data || []).map((p: any) => [p.user_id, p.full_name])));
      setPayments(pays.data || []);
      setReceipts(recs.data || []);
      setSplits(splitRows || []);
      setWalletBalance(walletRes.data ? Number((walletRes.data as any).available_balance || 0) : null);
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const totalCollected = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
    const outstanding = payments
      .filter((p) => ["unpaid", "pending", "overdue", "partial"].includes(p.status))
      .reduce((s, p) => s + Math.max(0, Number(p.monthly_rent || 0) - Number(p.amount_paid || 0)), 0);
    const activeTenancies = tenancies.filter((t) => t.status === "active").length;
    return { totalCollected, outstanding, activeTenancies };
  }, [payments, tenancies]);

  const downloadCsv = () => {
    const header = ["month", "tenancy", "tenant", "property", "due_date", "monthly_rent", "amount_paid", "status"].join(",");
    const body = payments.map((p) => {
      const t = tenancies.find((x) => x.id === p.tenancy_id);
      return [
        p.month_label || "",
        p.tenancy_id,
        t ? (nameMap[t.tenant_user_id] || "") : "",
        t ? (propMap[t.id] || "") : "",
        p.due_date || "",
        p.monthly_rent || 0,
        p.amount_paid || 0,
        p.status || "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    }).join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rent-collection-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Seo title="Rent Collection | Landlord" description="Consolidated rent records, payments, receipts and wallet credits." canonicalPath="/landlord/rent-collection" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" /> Rent Collection
          </h1>
          <p className="text-muted-foreground mt-1">
            Rent records, payment status, receipts, escrow releases and wallet credits — in one place.
          </p>
        </div>
        <Button variant="outline" onClick={downloadCsv} disabled={payments.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total collected" value={`GHS ${stats.totalCollected.toLocaleString()}`} icon={TrendingUp} />
        <StatCard label="Outstanding" value={`GHS ${stats.outstanding.toLocaleString()}`} icon={Wallet} tone="destructive" />
        <StatCard label="Active tenancies" value={String(stats.activeTenancies)} icon={Users} />
        <StatCard label="Wallet balance" value={walletBalance != null ? `GHS ${walletBalance.toLocaleString()}` : "—"} icon={Building2} />
      </div>

      <Tabs defaultValue="records">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="records">Rent records</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="wallet">Wallet credits</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Month</th>
                    <th className="text-left px-3 py-2">Tenant</th>
                    <th className="text-left px-3 py-2">Property</th>
                    <th className="text-right px-3 py-2">Rent</th>
                    <th className="text-right px-3 py-2">Paid</th>
                    <th className="text-left px-3 py-2">Status</th>
                    <th className="text-left px-3 py-2">Paid on</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No rent records yet.</td></tr>
                  )}
                  {payments.slice(0, 200).map((p) => {
                    const t = tenancies.find((x) => x.id === p.tenancy_id);
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-2">{p.month_label || (p.due_date ? format(new Date(p.due_date), "MMM yyyy") : "—")}</td>
                        <td className="px-3 py-2">{t ? (nameMap[t.tenant_user_id] || "—") : "—"}</td>
                        <td className="px-3 py-2 max-w-[240px] truncate">{t ? (propMap[t.id] || "—") : "—"}</td>
                        <td className="px-3 py-2 text-right">GHS {Number(p.monthly_rent || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-right font-semibold">GHS {Number(p.amount_paid || 0).toLocaleString()}</td>
                        <td className="px-3 py-2"><Badge className={statusBadge(p.status)}>{p.status || "—"}</Badge></td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{p.paid_date ? format(new Date(p.paid_date), "dd MMM yy") : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Receipt #</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No receipts yet.</td></tr>
                  )}
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{format(new Date(r.created_at), "dd MMM yy")}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.receipt_number}</td>
                      <td className="px-3 py-2 capitalize">{String(r.payment_type || "").replace(/_/g, " ")}</td>
                      <td className="px-3 py-2 text-right font-semibold">GHS {Number(r.total_amount || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-bold">Wallet credits & escrow releases</h2>
                <p className="text-xs text-muted-foreground">Landlord-recipient escrow splits released to your wallet.</p>
              </div>
              <a href="/landlord/wallet" className="text-sm text-primary hover:underline">Open NAFLIS Wallet →</a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Released</th>
                    <th className="text-left px-3 py-2">Description</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">No wallet credits yet.</td></tr>
                  )}
                  {splits.map((s) => (
                    <tr key={s.id} className="border-t border-border">
                      <td className="px-3 py-2 whitespace-nowrap">{s.released_at ? format(new Date(s.released_at), "dd MMM yy") : "—"}</td>
                      <td className="px-3 py-2 max-w-[420px] truncate">{s.description || "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold">GHS {Number(s.amount || 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{s.disbursement_status || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone?: "destructive" }) => (
  <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
    <div>
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className={`text-2xl font-extrabold mt-1 ${tone === "destructive" ? "text-destructive" : ""}`}>{value}</p>
    </div>
    <Icon className={`h-6 w-6 ${tone === "destructive" ? "text-destructive/70" : "text-primary/70"}`} />
  </div>
);

export default LandlordRentCollection;

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Loader2, ShieldAlert, Wallet, TrendingUp, Download, Crown, Banknote, ClipboardCheck, HandCoins, Wrench, ScrollText, IdCard, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { format, subDays, subMonths, startOfYear } from "date-fns";
import Seo from "@/components/Seo";

// Recipients considered "platform" revenue on escrow_splits (aggregated for Super Admin view only)
const PLATFORM_RECIPIENTS = ["platform", "rent_control_hq", "admin_hq"];

type UnifiedRow = {
  id: string;
  source: "escrow" | "premium" | "assessment" | "wallet_fee";
  bucket: string;
  bucket_label: string;
  released_at: string | null;
  description: string;
  amount: number;
  status: string | null;
};

const BUCKET_META: Record<string, { label: string; icon: any }> = {
  premium_service: { label: "Premium Service (Agents)", icon: Crown },
  wallet_fees: { label: "NAFLIS Wallet Fees", icon: Wallet },
  rent_management: { label: "Rent Management", icon: HandCoins },
  maintenance: { label: "Maintenance Deductions", icon: Wrench },
  agreement_sales: { label: "Agreement Sales", icon: ScrollText },
  rent_cards: { label: "Rent Cards", icon: IdCard },
  assessments: { label: "Property Assessments", icon: ClipboardCheck },
  landlord_registration: { label: "Landlord Registration", icon: Banknote },
  service_fees: { label: "Service / Processing Fees", icon: Receipt },
  other: { label: "Other platform charges", icon: TrendingUp },
};

const classify = (description: string): string => {
  const d = (description || "").toLowerCase();
  if (/premium|agent/i.test(d)) return "premium_service";
  if (/assessment|inspection|certificate/i.test(d)) return "assessments";
  if (/landlord.*(registration|renewal)|registration fee/i.test(d)) return "landlord_registration";
  if (/wallet|naflis|withdraw|top.?up/i.test(d)) return "wallet_fees";
  if (/rent.*(management|collect|arrears|deduction)/i.test(d)) return "rent_management";
  if (/maintenance|repair/i.test(d)) return "maintenance";
  if (/agreement.*sale|form.?32a|template/i.test(d)) return "agreement_sales";
  if (/rent.?card|serial/i.test(d)) return "rent_cards";
  if (/service fee|processing/i.test(d)) return "service_fees";
  return "other";
};

const bucketLabel = (k: string) => BUCKET_META[k]?.label || k;

const RANGES: { key: string; label: string; days?: number; ytd?: boolean; all?: boolean }[] = [
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
  { key: "365", label: "Last 12 months", days: 365 },
  { key: "ytd", label: "Year to date", ytd: true },
  { key: "all", label: "All time", all: true },
];

const PlatformEscrowDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<UnifiedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>("90");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.rpc("is_super_admin" as any, { _user_id: user.id });
      const ok = !!data;
      setAuthorized(ok);
      setChecking(false);
      if (!ok) return;
      setLoading(true);

      const cutoff = (() => {
        const r = RANGES.find((x) => x.key === range)!;
        if (r.all) return null;
        if (r.ytd) return startOfYear(new Date()).toISOString();
        return subDays(new Date(), r.days || 30).toISOString();
      })();

      const [splitsRes, premiumRes, assessmentsRes, walletRes] = await Promise.all([
        supabase
          .from("escrow_splits")
          .select("id, recipient, amount, description, released_at, status, disbursement_status")
          .in("recipient", PLATFORM_RECIPIENTS)
          .order("released_at", { ascending: false, nullsFirst: false })
          .limit(3000),
        supabase
          .from("premium_subscriptions")
          .select("id, fee_amount, yearly_fee, starts_at, status, billing_frequency")
          .eq("status", "active")
          .order("starts_at", { ascending: false })
          .limit(2000),
        supabase
          .from("property_assessment_applications")
          .select("id, fee_amount, fee_status, created_at, reason")
          .eq("fee_status", "paid")
          .order("created_at", { ascending: false })
          .limit(2000),
        supabase
          .from("wallet_entries")
          .select("id, amount, direction, entry_type, bucket, description, created_at")
          .in("entry_type", ["platform_fee", "service_fee", "withdrawal_fee"])
          .order("created_at", { ascending: false })
          .limit(2000),
      ]);

      const unified: UnifiedRow[] = [];

      for (const r of splitsRes.data || []) {
        const dt = r.released_at || null;
        if (cutoff && dt && dt < cutoff) continue;
        if (cutoff && !dt) continue;
        const desc = r.description || "";
        unified.push({
          id: `s:${r.id}`,
          source: "escrow",
          bucket: classify(desc),
          bucket_label: bucketLabel(classify(desc)),
          released_at: dt,
          description: desc || "Escrow split",
          amount: Number(r.amount || 0),
          status: r.disbursement_status || r.status || null,
        });
      }
      for (const r of premiumRes.data || []) {
        const dt = r.starts_at || null;
        if (cutoff && dt && dt < cutoff) continue;
        const amt = Number(r.fee_amount || r.yearly_fee || 0);
        if (!amt) continue;
        unified.push({
          id: `p:${r.id}`,
          source: "premium",
          bucket: "premium_service",
          bucket_label: bucketLabel("premium_service"),
          released_at: dt,
          description: `Premium Service subscription (${r.billing_frequency || "monthly"})`,
          amount: amt,
          status: r.status,
        });
      }
      for (const r of assessmentsRes.data || []) {
        const dt = r.created_at || null;
        if (cutoff && dt && dt < cutoff) continue;
        const amt = Number(r.fee_amount || 0);
        if (!amt) continue;
        unified.push({
          id: `a:${r.id}`,
          source: "assessment",
          bucket: "assessments",
          bucket_label: bucketLabel("assessments"),
          released_at: dt,
          description: `Property Assessment — ${r.reason || "application"}`,
          amount: amt,
          status: r.fee_status,
        });
      }
      for (const r of walletRes.data || []) {
        const dt = r.created_at || null;
        if (cutoff && dt && dt < cutoff) continue;
        if (r.direction !== "credit") continue;
        unified.push({
          id: `w:${r.id}`,
          source: "wallet_fee",
          bucket: "wallet_fees",
          bucket_label: bucketLabel("wallet_fees"),
          released_at: dt,
          description: r.description || `Wallet ${r.entry_type}`,
          amount: Number(r.amount || 0),
          status: r.entry_type,
        });
      }

      unified.sort((a, b) => (b.released_at || "").localeCompare(a.released_at || ""));
      setRows(unified);
      setLoading(false);
    })();
  }, [user, range]);

  const summary = useMemo(() => {
    const buckets: Record<string, { total: number; count: number }> = {};
    for (const k of Object.keys(BUCKET_META)) buckets[k] = { total: 0, count: 0 };
    let grand = 0;
    for (const r of rows) {
      grand += r.amount;
      buckets[r.bucket] = buckets[r.bucket] || { total: 0, count: 0 };
      buckets[r.bucket].total += r.amount;
      buckets[r.bucket].count += 1;
    }
    return { buckets, grand };
  }, [rows]);

  const downloadCsv = () => {
    const header = ["released_at", "source", "bucket", "amount", "description", "status"].join(",");
    const body = rows.map((r) =>
      [r.released_at || "", r.source, r.bucket, r.amount, `"${(r.description || "").replace(/"/g, '""')}"`, r.status || ""].join(","),
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

  const bucketKeys = Object.keys(BUCKET_META).filter((k) => k !== "other");
  const activeBuckets = bucketKeys.filter((k) => (summary.buckets[k]?.count || 0) > 0);
  const otherHasEntries = (summary.buckets.other?.count || 0) > 0;

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
            Platform-side revenue segmented by source: Premium Service, NAFLIS wallet fees, rent management, assessments, and other charges.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
          <Button variant="outline" onClick={downloadCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
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
                <p className="text-xs text-muted-foreground mt-1">{rows.length.toLocaleString()} entries across all sources</p>
              </div>
              <TrendingUp className="h-10 w-10 text-primary/60" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {bucketKeys.map((k) => {
              const v = summary.buckets[k] || { total: 0, count: 0 };
              const Icon = BUCKET_META[k].icon;
              return (
                <div key={k} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{BUCKET_META[k].label}</p>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-bold mt-2">GHS {v.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  <p className="text-xs text-muted-foreground mt-1">{v.count} entries</p>
                </div>
              );
            })}
            {otherHasEntries && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">Other platform charges</p>
                <p className="text-2xl font-bold mt-2">GHS {summary.buckets.other.total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary.buckets.other.count} entries</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <Tabs defaultValue="all">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold">Platform entries</h2>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  {activeBuckets.slice(0, 5).map((k) => (
                    <TabsTrigger key={k} value={k}>{BUCKET_META[k].label.split(" ")[0]}</TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {["all", ...activeBuckets].map((tab) => {
                const list = tab === "all" ? rows : rows.filter((r) => r.bucket === tab);
                return (
                  <TabsContent key={tab} value={tab} className="mt-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="text-left px-4 py-2">Date</th>
                            <th className="text-left px-4 py-2">Source</th>
                            <th className="text-left px-4 py-2">Bucket</th>
                            <th className="text-left px-4 py-2">Description</th>
                            <th className="text-right px-4 py-2">Amount</th>
                            <th className="text-left px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.slice(0, 200).map((r) => (
                            <tr key={r.id} className="border-t border-border">
                              <td className="px-4 py-2 whitespace-nowrap">{r.released_at ? format(new Date(r.released_at), "dd MMM yy") : "—"}</td>
                              <td className="px-4 py-2 text-xs capitalize">{r.source.replace("_", " ")}</td>
                              <td className="px-4 py-2 text-xs">{r.bucket_label}</td>
                              <td className="px-4 py-2 max-w-[380px] truncate" title={r.description}>{r.description}</td>
                              <td className="px-4 py-2 text-right font-semibold">GHS {r.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              <td className="px-4 py-2 text-xs text-muted-foreground">{r.status || "—"}</td>
                            </tr>
                          ))}
                          {list.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No entries in this bucket.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
};

export default PlatformEscrowDashboard;

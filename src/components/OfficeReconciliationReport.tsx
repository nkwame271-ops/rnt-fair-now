import { useState } from "react";
import { Loader2, FileBarChart, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHSDecimal } from "@/lib/formatters";
import { format } from "date-fns";

/**
 * Office Reconciliation Report
 *
 * Sole source of truth: active escrow_splits rows joined to completed escrow_transactions.
 * Bundle parents (existing_tenancy_bundle, add_tenant_fee) are excluded — only their child
 * components count, matching the receipts and the Allocation Summary on the Escrow dashboard.
 *
 * Partitions reported:
 *   • IGF (Office)   = recipient = "rent_control"
 *   • IGF (HQ)       = recipient = "rent_control_hq"
 *   • Admin (Office) = recipient = "admin"
 *   • Admin (HQ)     = recipient = "admin_hq"
 *   • Platform       = recipient = "platform"
 *   • GRA            = recipient = "gra"
 *   • Landlord       = recipient = "landlord"
 */

const BUNDLE_PARENT_TYPES = ["existing_tenancy_bundle", "add_tenant_fee"];

interface Partitions {
  igfOffice: number;
  igfHq: number;
  adminOffice: number;
  adminHq: number;
  platform: number;
  gra: number;
  landlord: number;
  total: number;
}

interface Props {
  offices: { id: string; name: string }[];
  defaultOfficeId?: string | null;
  isUnscoped: boolean;
}

const OfficeReconciliationReport = ({ offices, defaultOfficeId, isUnscoped }: Props) => {
  const [officeId, setOfficeId] = useState<string>(defaultOfficeId || (offices[0]?.id ?? ""));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [partitions, setPartitions] = useState<Partitions | null>(null);
  const [byType, setByType] = useState<{ type: string; total: number; count: number; partitions: Partitions }[]>([]);

  const compute = async () => {
    if (!officeId) return;
    setLoading(true);
    setPartitions(null);
    setByType([]);

    // 1) Completed transactions for this office (excluding bundle parents)
    let txQ = supabase
      .from("escrow_transactions")
      .select("id, total_amount, payment_type, created_at")
      .eq("office_id", officeId)
      .eq("status", "completed");
    if (from) txQ = txQ.gte("created_at", new Date(from).toISOString());
    if (to) txQ = txQ.lte("created_at", new Date(to + "T23:59:59").toISOString());
    const { data: txns } = await txQ;
    const completed = (txns || []).filter((t: any) => !BUNDLE_PARENT_TYPES.includes(t.payment_type));
    const ids = completed.map((t: any) => t.id);

    if (ids.length === 0) {
      setPartitions({ igfOffice: 0, igfHq: 0, adminOffice: 0, adminHq: 0, platform: 0, gra: 0, landlord: 0, total: 0 });
      setLoading(false);
      return;
    }

    // 2) Active splits for those transactions (batched .in)
    const splits: any[] = [];
    const batch = 200;
    for (let i = 0; i < ids.length; i += batch) {
      const chunk = ids.slice(i, i + batch);
      const { data } = await supabase
        .from("escrow_splits")
        .select("escrow_transaction_id, recipient, amount")
        .in("escrow_transaction_id", chunk)
        .eq("status", "active");
      if (data) splits.push(...data);
    }

    const empty = (): Partitions => ({ igfOffice: 0, igfHq: 0, adminOffice: 0, adminHq: 0, platform: 0, gra: 0, landlord: 0, total: 0 });
    const accumulate = (p: Partitions, recipient: string, amount: number) => {
      const a = Number(amount);
      p.total += a;
      if (recipient === "rent_control") p.igfOffice += a;
      else if (recipient === "rent_control_hq") p.igfHq += a;
      else if (recipient === "admin") p.adminOffice += a;
      else if (recipient === "admin_hq") p.adminHq += a;
      else if (recipient === "platform") p.platform += a;
      else if (recipient === "gra") p.gra += a;
      else if (recipient === "landlord") p.landlord += a;
    };

    // Index splits by transaction
    const splitsByTx = new Map<string, any[]>();
    for (const s of splits) {
      const arr = splitsByTx.get(s.escrow_transaction_id) || [];
      arr.push(s);
      splitsByTx.set(s.escrow_transaction_id, arr);
    }

    // Overall partitions
    const overall = empty();
    splits.forEach(s => accumulate(overall, s.recipient, s.amount));

    // Per type partitions
    const typeMap = new Map<string, { total: number; count: number; partitions: Partitions }>();
    for (const t of completed) {
      const e = typeMap.get(t.payment_type) || { total: 0, count: 0, partitions: empty() };
      e.total += Number(t.total_amount);
      e.count += 1;
      const sList = splitsByTx.get(t.id) || [];
      sList.forEach(s => accumulate(e.partitions, s.recipient, s.amount));
      typeMap.set(t.payment_type, e);
    }

    setPartitions(overall);
    setByType(Array.from(typeMap.entries()).map(([type, v]) => ({ type, ...v })).sort((a, b) => b.total - a.total));
    setLoading(false);
  };

  const exportCSV = () => {
    if (!partitions) return;
    const officeName = offices.find(o => o.id === officeId)?.name || officeId;
    const rows: string[][] = [
      ["Office Reconciliation Report"],
      ["Office", officeName],
      ["Period", `${from || "All time"} → ${to || "Now"}`],
      ["Generated", format(new Date(), "yyyy-MM-dd HH:mm")],
      [],
      ["PARTITION TOTALS"],
      ["Partition", "Amount (GHS)"],
      ["IGF (Office)", partitions.igfOffice.toFixed(2)],
      ["IGF (HQ)", partitions.igfHq.toFixed(2)],
      ["Admin (Office)", partitions.adminOffice.toFixed(2)],
      ["Admin (HQ)", partitions.adminHq.toFixed(2)],
      ["Platform", partitions.platform.toFixed(2)],
      ["GRA", partitions.gra.toFixed(2)],
      ["Landlord (Held)", partitions.landlord.toFixed(2)],
      ["TOTAL", partitions.total.toFixed(2)],
      [],
      ["REVENUE BY TYPE"],
      ["Type", "Transactions", "Total (GHS)", "IGF (Office)", "IGF (HQ)", "Admin (Office)", "Admin (HQ)", "Platform", "GRA", "Landlord"],
      ...byType.map(r => [
        r.type,
        String(r.count),
        r.total.toFixed(2),
        r.partitions.igfOffice.toFixed(2),
        r.partitions.igfHq.toFixed(2),
        r.partitions.adminOffice.toFixed(2),
        r.partitions.adminHq.toFixed(2),
        r.partitions.platform.toFixed(2),
        r.partitions.gra.toFixed(2),
        r.partitions.landlord.toFixed(2),
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `office-reconciliation_${officeName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="bg-card rounded-xl p-5 border border-border space-y-4">
      <div className="flex items-center gap-2">
        <FileBarChart className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Office Reconciliation Report</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Computes revenue and per-partition totals (IGF Office/HQ, Admin Office/HQ, Platform, GRA, Landlord) for the selected office, sourced
        from active ledger entries only.
      </p>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1 min-w-[220px]">
          <label className="text-xs text-muted-foreground">Office</label>
          <Select value={officeId} onValueChange={setOfficeId} disabled={!isUnscoped}>
            <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
            <SelectContent>
              {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button onClick={compute} disabled={loading || !officeId}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileBarChart className="h-4 w-4 mr-2" />}
          Compute
        </Button>
        {partitions && (
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
        )}
      </div>

      {partitions && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "IGF (Office)", v: partitions.igfOffice },
              { label: "IGF (HQ)", v: partitions.igfHq },
              { label: "Admin (Office)", v: partitions.adminOffice },
              { label: "Admin (HQ)", v: partitions.adminHq },
              { label: "Platform", v: partitions.platform },
              { label: "GRA", v: partitions.gra },
              { label: "Landlord (Held)", v: partitions.landlord },
              { label: "TOTAL", v: partitions.total },
            ].map(c => (
              <div key={c.label} className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted-foreground">{c.label}</div>
                <div className="text-base font-bold text-foreground">{formatGHSDecimal(c.v)}</div>
              </div>
            ))}
          </div>

          {byType.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left py-2 pr-3">Type</th>
                    <th className="text-right py-2 px-2">Txns</th>
                    <th className="text-right py-2 px-2">Total</th>
                    <th className="text-right py-2 px-2">IGF (O)</th>
                    <th className="text-right py-2 px-2">IGF (HQ)</th>
                    <th className="text-right py-2 px-2">Admin (O)</th>
                    <th className="text-right py-2 px-2">Admin (HQ)</th>
                    <th className="text-right py-2 px-2">Platform</th>
                    <th className="text-right py-2 px-2">GRA</th>
                    <th className="text-right py-2 pl-2">Landlord</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(r => (
                    <tr key={r.type} className="border-b border-border/50">
                      <td className="py-2 pr-3 capitalize text-foreground">{r.type.replace(/_/g, " ")}</td>
                      <td className="text-right py-2 px-2">{r.count}</td>
                      <td className="text-right py-2 px-2 font-semibold">{formatGHSDecimal(r.total)}</td>
                      <td className="text-right py-2 px-2 text-primary">{formatGHSDecimal(r.partitions.igfOffice)}</td>
                      <td className="text-right py-2 px-2 text-primary/80">{formatGHSDecimal(r.partitions.igfHq)}</td>
                      <td className="text-right py-2 px-2 text-info">{formatGHSDecimal(r.partitions.adminOffice)}</td>
                      <td className="text-right py-2 px-2 text-info/80">{formatGHSDecimal(r.partitions.adminHq)}</td>
                      <td className="text-right py-2 px-2 text-success">{formatGHSDecimal(r.partitions.platform)}</td>
                      <td className="text-right py-2 px-2">{formatGHSDecimal(r.partitions.gra)}</td>
                      <td className="text-right py-2 pl-2 text-warning">{formatGHSDecimal(r.partitions.landlord)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OfficeReconciliationReport;

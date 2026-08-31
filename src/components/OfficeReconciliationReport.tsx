import { useEffect, useMemo, useState } from "react";
import { Loader2, FileBarChart, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatGHSDecimal } from "@/lib/formatters";
import { format } from "date-fns";
import { useAdminProfile } from "@/hooks/useAdminProfile";

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
  const { profile } = useAdminProfile();
  const isSuperAdmin = !!profile?.isSuperAdmin;
  // Sub-totals: when the viewer cannot see Platform, totals must shrink to match.
  const visibleTotal = (p: Partitions) =>
    p.igfOffice + p.igfHq + p.adminOffice + p.adminHq + (isSuperAdmin ? p.platform : 0) + p.gra + p.landlord;
  const [officeId, setOfficeId] = useState<string>(defaultOfficeId || (offices[0]?.id ?? ""));
  // Offices load asynchronously — adopt the scoped default once it arrives.
  useEffect(() => {
    if (!officeId) setOfficeId(defaultOfficeId || (offices[0]?.id ?? ""));
  }, [defaultOfficeId, offices.length]);

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

    const empty = (): Partitions => ({ igfOffice: 0, igfHq: 0, adminOffice: 0, adminHq: 0, platform: 0, gra: 0, landlord: 0, total: 0 });
    try {
      const { data, error } = await supabase.functions.invoke("admin-reconciliation", {
        body: { action: "office_summary", office_id: officeId, from: from || null, to: to || null },
      });
      if (error) throw error;
      const rows = (data?.rows ?? []) as Array<Record<string, number | string | boolean>>;
      const mapped = rows.map((row) => {
        const p: Partitions = {
          igfOffice: Number(row.igf_office ?? 0), igfHq: Number(row.igf_hq ?? 0),
          adminOffice: Number(row.admin_office ?? 0), adminHq: Number(row.admin_hq ?? 0),
          platform: Number(row.platform ?? 0), gra: Number(row.gra ?? 0),
          landlord: Number(row.landlord ?? 0), total: Number(row.split_total ?? 0),
        };
        return { type: String(row.payment_type), total: Number(row.gross_total ?? 0), count: Number(row.transaction_count ?? 0), partitions: p };
      });
      const overall = mapped.reduce((sum, row) => ({
        igfOffice: sum.igfOffice + row.partitions.igfOffice, igfHq: sum.igfHq + row.partitions.igfHq,
        adminOffice: sum.adminOffice + row.partitions.adminOffice, adminHq: sum.adminHq + row.partitions.adminHq,
        platform: sum.platform + row.partitions.platform, gra: sum.gra + row.partitions.gra,
        landlord: sum.landlord + row.partitions.landlord, total: sum.total + row.partitions.total,
      }), empty());
      setPartitions(overall);
      setByType(mapped);
    } finally {
      setLoading(false);
    }
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
      ...(isSuperAdmin ? [["Platform", partitions.platform.toFixed(2)]] : []),
      ["GRA", partitions.gra.toFixed(2)],
      ["Landlord (Held)", partitions.landlord.toFixed(2)],
      ["TOTAL", visibleTotal(partitions).toFixed(2)],
      [],
      ["REVENUE BY TYPE"],
      [
        "Type", "Transactions", "Total (GHS)", "IGF (Office)", "IGF (HQ)", "Admin (Office)", "Admin (HQ)",
        ...(isSuperAdmin ? ["Platform"] : []),
        "GRA", "Landlord",
      ],
      ...byType.map(r => [
        r.type,
        String(r.count),
        visibleTotal(r.partitions).toFixed(2),
        r.partitions.igfOffice.toFixed(2),
        r.partitions.igfHq.toFixed(2),
        r.partitions.adminOffice.toFixed(2),
        r.partitions.adminHq.toFixed(2),
        ...(isSuperAdmin ? [r.partitions.platform.toFixed(2)] : []),
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
          <Select value={officeId} onValueChange={setOfficeId} disabled={offices.length <= 1}>
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
              ...(isSuperAdmin ? [{ label: "Platform", v: partitions.platform }] : []),
              { label: "GRA", v: partitions.gra },
              { label: "Landlord (Held)", v: partitions.landlord },
              { label: "TOTAL", v: visibleTotal(partitions) },
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
                    {isSuperAdmin && <th className="text-right py-2 px-2">Platform</th>}
                    <th className="text-right py-2 px-2">GRA</th>
                    <th className="text-right py-2 pl-2">Landlord</th>
                  </tr>
                </thead>
                <tbody>
                  {byType.map(r => (
                    <tr key={r.type} className="border-b border-border/50">
                      <td className="py-2 pr-3 capitalize text-foreground">{r.type.replace(/_/g, " ")}</td>
                      <td className="text-right py-2 px-2">{r.count}</td>
                      <td className="text-right py-2 px-2 font-semibold">{formatGHSDecimal(visibleTotal(r.partitions))}</td>
                      <td className="text-right py-2 px-2 text-primary">{formatGHSDecimal(r.partitions.igfOffice)}</td>
                      <td className="text-right py-2 px-2 text-primary/80">{formatGHSDecimal(r.partitions.igfHq)}</td>
                      <td className="text-right py-2 px-2 text-info">{formatGHSDecimal(r.partitions.adminOffice)}</td>
                      <td className="text-right py-2 px-2 text-info/80">{formatGHSDecimal(r.partitions.adminHq)}</td>
                      {isSuperAdmin && <td className="text-right py-2 px-2 text-success">{formatGHSDecimal(r.partitions.platform)}</td>}
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

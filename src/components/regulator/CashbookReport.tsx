import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Printer, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { useAdminScope } from "@/hooks/useAdminScope";
import { PaginationBar } from "@/components/ui/pagination-bar";

type Entry = {
  id: string;
  entry_date: string;
  receipt_no: string | null;
  payment_ref: string | null;
  description: string | null;
  category: string | null;
  payer: string | null;
  office: string | null;
  channel: string | null;
  method: string | null;
  money_in: number;
  money_out: number;
  running_balance: number;
  reconciliation_status: string;
};

const fmtGHS = (n: number) =>
  `GHS ${Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  /** Optional filter to scope to a service (e.g. only wallet fee entries) */
  categoryFilter?: string;
  title?: string;
}

const PAGE_SIZE = 100;

const CashbookReport = ({ categoryFilter, title = "Automated Cashbook" }: Props) => {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7" | "30" | "90" | "365" | "all">("30");
  const [office, setOffice] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const [recStatus, setRecStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totals, setTotals] = useState({ entry_count: 0, money_in: 0, money_out: 0, reconciled: 0, pending: 0 });
  const [officeOptions, setOfficeOptions] = useState<string[]>([]);
  const [methodOptions, setMethodOptions] = useState<string[]>([]);
  const { scopeOfficeId, isUnscoped, officeName, loading: scopeLoading } = useAdminScope();

  const effectiveOffice = !isUnscoped && scopeOfficeId ? scopeOfficeId : office;

  const fromIso = range === "all" ? null : new Date(Date.now() - Number(range) * 24 * 3600 * 1000).toISOString();

  const load = async () => {
    setLoading(true);
    try {
      let q = supabase.from("cashbook_entries").select("*").order("entry_date", { ascending: false });
      if (fromIso) q = q.gte("entry_date", fromIso);
      if (categoryFilter) q = q.eq("category", categoryFilter);
      if (effectiveOffice !== "all") q = q.eq("office", effectiveOffice);
      if (method !== "all") q = q.eq("method", method === "unspecified" ? null as any : method);
      if (recStatus !== "all") q = q.eq("reconciliation_status", recStatus);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(
          [`receipt_no.ilike.${s}`, `payment_ref.ilike.${s}`, `description.ilike.${s}`, `payer.ilike.${s}`, `category.ilike.${s}`].join(","),
        );
      }
      const fromRow = (page - 1) * PAGE_SIZE;
      const [rowsRes, totalsRes] = await Promise.all([
        q.range(fromRow, fromRow + PAGE_SIZE - 1),
        (supabase as any).rpc("cashbook_totals", {
          _from: fromIso,
          _category: categoryFilter ?? null,
          _office: effectiveOffice === "all" ? null : effectiveOffice,
          _method: method === "all" ? null : method,
          _rec_status: recStatus === "all" ? null : recStatus,
          _search: search.trim() || null,
        }),
      ]);
      if (rowsRes.error) throw rowsRes.error;
      setEntries((rowsRes.data as Entry[]) || []);
      const t = Array.isArray(totalsRes?.data) ? totalsRes.data[0] : totalsRes?.data;
      setTotals({
        entry_count: Number(t?.entry_count || 0),
        money_in: Number(t?.money_in || 0),
        money_out: Number(t?.money_out || 0),
        reconciled: Number(t?.reconciled || 0),
        pending: Number(t?.pending || 0),
      });
    } catch (e: any) {
      toast({ title: "Failed to load cashbook", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (scopeLoading) return;
    load();
     
  }, [range, categoryFilter, scopeLoading, isUnscoped, scopeOfficeId, office, method, recStatus, page]);

  // Debounced search
  useEffect(() => {
    if (scopeLoading) return;
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 400);
    return () => clearTimeout(t);
     
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [range, office, method, recStatus]);

  useEffect(() => {
    if (!isUnscoped && scopeOfficeId) setOffice(scopeOfficeId);
  }, [isUnscoped, scopeOfficeId]);

  // Keep filter dropdown options growing from what has been seen
  useEffect(() => {
    setOfficeOptions((prev) => Array.from(new Set([...prev, ...entries.map((e) => e.office || "unassigned")])));
    setMethodOptions((prev) => Array.from(new Set([...prev, ...entries.map((e) => e.method || "unspecified")])));
  }, [entries]);

  const filtered = entries;
  const offices = officeOptions;
  const methods = methodOptions;
  const total = totals.entry_count;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const paged = entries;
  const pageSize = PAGE_SIZE;


  const exportCSV = () => {
    const rows = [
      ["Date", "Receipt No", "Payment Ref", "Description", "Category", "Payer", "Office", "Method", "Money In", "Money Out", "Running Balance", "Reconciliation"],
      ...filtered.map((e) => [
        format(new Date(e.entry_date), "yyyy-MM-dd HH:mm"),
        e.receipt_no || "",
        e.payment_ref || "",
        e.description || "",
        e.category || "",
        e.payer || "",
        e.office || "",
        e.method || "",
        e.money_in.toString(),
        e.money_out.toString(),
        e.running_balance.toString(),
        e.reconciliation_status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashbook_${format(new Date(), "yyyyMMdd_HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Range</Label>
              <Select value={range} onValueChange={(v) => setRange(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Office</Label>
              <Select value={!isUnscoped && scopeOfficeId ? scopeOfficeId : office} onValueChange={setOffice} disabled={!isUnscoped}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isUnscoped ? <SelectItem value="all">All offices</SelectItem> : null}
                  {!isUnscoped && scopeOfficeId ? <SelectItem value={scopeOfficeId}>{officeName || scopeOfficeId}</SelectItem> : null}
                  {offices.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  {methods.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Reconciliation</Label>
              <Select value={recStatus} onValueChange={setRecStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="reconciled">Reconciled</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search</Label>
              <Input placeholder="Receipt, ref, payer…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Entries (all matching)" value={total.toLocaleString()} />
            <StatCard label="Money In" value={fmtGHS(totals.money_in)} tone="pos" />
            <StatCard label="Money Out" value={fmtGHS(totals.money_out)} tone="neg" />
            <StatCard label="Net Balance" value={fmtGHS(totals.money_in - totals.money_out)} tone="bold" />
            <StatCard label="Reconciled" value={fmtGHS(totals.reconciled)} />
          </div>


          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Money In</TableHead>
                  <TableHead className="text-right">Money Out</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-6">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-6 text-muted-foreground">No entries in range.</TableCell></TableRow>
                ) : (
                  paged.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(e.entry_date), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{e.receipt_no || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{e.description || "-"}</TableCell>
                      <TableCell><Badge variant="outline">{e.category || "-"}</Badge></TableCell>
                      <TableCell>{e.payer || "-"}</TableCell>
                      <TableCell>{e.office || "-"}</TableCell>
                      <TableCell>{e.method || "-"}</TableCell>
                      <TableCell className="text-right text-emerald-600">{fmtGHS(e.money_in)}</TableCell>
                      <TableCell className="text-right text-red-600">{fmtGHS(e.money_out)}</TableCell>
                      <TableCell className="text-right font-medium">{fmtGHS(e.running_balance)}</TableCell>
                      <TableCell>
                        <Badge variant={e.reconciliation_status === "reconciled" ? "default" : "secondary"}>
                          {e.reconciliation_status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onChange={setPage} label="entries" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" | "bold" }) => (
  <div className="rounded-md border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div
      className={
        tone === "pos"
          ? "text-lg font-semibold text-emerald-600"
          : tone === "neg"
          ? "text-lg font-semibold text-red-600"
          : tone === "bold"
          ? "text-lg font-bold"
          : "text-lg font-semibold"
      }
    >
      {value}
    </div>
  </div>
);

export default CashbookReport;

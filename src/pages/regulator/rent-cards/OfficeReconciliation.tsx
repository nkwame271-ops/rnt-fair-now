import { useState, useEffect } from "react";
import { ClipboardCheck, Loader2, Download, AlertTriangle, CheckCircle, Save, CalendarIcon, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS, getOfficesForRegion } from "@/hooks/useAdminProfile";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import jsPDF from "jspdf";

type DatePreset = "today" | "yesterday" | "this_week" | "this_month" | "custom";

interface SalesMetrics {
  totalPayments: number;
  totalPairsPaidFor: number;
  awaitingSerial: number;
  assignedSerials: number;
  unassignedPairs: number;
  netAssigned: number;
  adjustmentIncreases: number;
  adjustmentDecreases: number;
  stockByOffice: { office_name: string; available: number }[];
}

interface Snapshot {
  id: string;
  office_id: string;
  office_name: string;
  snapshot_date: string;
  total_office_stock: number;
  available_pairs: number;
  assigned_pairs: number;
  sold_pairs: number;
  spoilt_pairs: number;
  pending_purchases: number;
  fulfilled_purchases: number;
  is_balanced: boolean;
  discrepancy_notes: string | null;
  created_at: string;
}

const getDateRange = (preset: DatePreset, customFrom?: Date, customTo?: Date): { from: string; to: string } => {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() };
    }
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfDay(now).toISOString() };
    case "this_month":
      return { from: startOfMonth(now).toISOString(), to: endOfDay(now).toISOString() };
    case "custom":
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : startOfDay(now).toISOString(),
        to: customTo ? endOfDay(customTo).toISOString() : endOfDay(now).toISOString(),
      };
  }
};

const OfficeReconciliation = () => {
  const [datePreset, setDatePreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);

  // Existing office-level reconciliation
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [officeResult, setOfficeResult] = useState<any>(null);
  const [officeLoading, setOfficeLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);
  const officeName = selectedOffice?.name || "";

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { from, to } = getDateRange(datePreset, customFrom, customTo);

      // 1. Total successful rent card payments
      const { count: totalPayments } = await supabase
        .from("escrow_transactions")
        .select("id", { count: "exact", head: true })
        .eq("payment_type", "rent_card_purchase")
        .eq("status", "completed")
        .gte("created_at", from)
        .lte("created_at", to);

      // 2. Total cards created in period (pairs = cards / 2)
      const { count: totalCards } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .gte("created_at", from)
        .lte("created_at", to);

      // 3. Awaiting serial
      const { count: awaitingCards } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_serial")
        .gte("created_at", from)
        .lte("created_at", to);

      // 4. Assigned serials (valid)
      const { count: assignedCards } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .eq("status", "valid")
        .gte("created_at", from)
        .lte("created_at", to);

      // 5. Unassigned pairs (from audit log)
      const { count: unassignedCount } = await supabase
        .from("admin_audit_log")
        .select("id", { count: "exact", head: true })
        .eq("action", "unassign_serial")
        .gte("created_at", from)
        .lte("created_at", to);

      // 7 & 8. Inventory adjustments
      const { data: adjustments } = await supabase
        .from("inventory_adjustments")
        .select("adjustment_type, quantity")
        .gte("created_at", from)
        .lte("created_at", to);

      const adjIncreases = (adjustments || [])
        .filter((a: any) => a.adjustment_type === "increase")
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);
      const adjDecreases = (adjustments || [])
        .filter((a: any) => a.adjustment_type === "decrease")
        .reduce((sum: number, a: any) => sum + (a.quantity || 0), 0);

      // 9. Current available stock by office (live, not date-filtered)
      // We need to paginate since there could be many rows
      let stockData: any[] = [];
      let stockFrom = 0;
      const S_PAGE = 1000;
      while (true) {
        const { data: page } = await supabase
          .from("rent_card_serial_stock" as any)
          .select("office_name")
          .eq("stock_type", "office")
          .eq("status", "available")
          .eq("pair_index", 1)
          .range(stockFrom, stockFrom + S_PAGE - 1);
        if (!page || page.length === 0) break;
        stockData = stockData.concat(page);
        if (page.length < S_PAGE) break;
        stockFrom += S_PAGE;
      }

      const officeMap = new Map<string, number>();
      stockData.forEach((r: any) => {
        officeMap.set(r.office_name, (officeMap.get(r.office_name) || 0) + 1);
      });
      const stockByOffice = Array.from(officeMap.entries())
        .map(([office_name, available]) => ({ office_name, available }))
        .sort((a, b) => b.available - a.available);

      const pairsPaidFor = Math.floor((totalCards || 0) / 2);
      const awaitingPairs = Math.floor((awaitingCards || 0) / 2);
      const assignedPairs = Math.floor((assignedCards || 0) / 2);
      const unassigned = unassignedCount || 0;

      setMetrics({
        totalPayments: totalPayments || 0,
        totalPairsPaidFor: pairsPaidFor,
        awaitingSerial: awaitingPairs,
        assignedSerials: assignedPairs,
        unassignedPairs: unassigned,
        netAssigned: assignedPairs - unassigned,
        adjustmentIncreases: adjIncreases,
        adjustmentDecreases: adjDecreases,
        stockByOffice,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to load metrics");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMetrics();
  }, [datePreset, customFrom, customTo]);

  // Office-level reconciliation snapshots
  useEffect(() => {
    if (!selectedOfficeId) { setSnapshots([]); return; }
    const fetchSnapshots = async () => {
      setLoadingSnapshots(true);
      const { data } = await supabase
        .from("office_reconciliation_snapshots" as any)
        .select("*")
        .eq("office_id", selectedOfficeId)
        .order("snapshot_date", { ascending: false })
        .limit(20);
      setSnapshots((data || []) as unknown as Snapshot[]);
      setLoadingSnapshots(false);
    };
    fetchSnapshots();
  }, [selectedOfficeId]);

  const runOfficeReconciliation = async () => {
    if (!officeName) return;
    setOfficeLoading(true);
    setOfficeResult(null);
    try {
      let allSerials: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("rent_card_serial_stock" as any)
          .select("serial_number, status")
          .eq("office_name", officeName)
          .eq("stock_type", "office")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allSerials = allSerials.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const available = allSerials.filter((s: any) => s.status === "available").length;
      const assigned = allSerials.filter((s: any) => s.status === "assigned").length;
      const sold = allSerials.filter((s: any) => s.status === "sold").length;
      const spoilt = allSerials.filter((s: any) => s.status === "spoilt").length;
      const totalOfficeStock = allSerials.length;
      const accountedFor = available + assigned + sold + spoilt;
      const isBalanced = totalOfficeStock === accountedFor;

      const { count: pendingCount } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_serial");

      const { count: fulfilledCount } = await (supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true }) as any)
        .eq("assigned_office_name", officeName)
        .eq("status", "valid");

      setOfficeResult({
        totalOfficeStock, available, assigned, sold, spoilt,
        pendingPurchases: pendingCount || 0,
        fulfilledPurchases: fulfilledCount || 0,
        isBalanced,
      });
    } catch (err: any) {
      toast.error(err.message || "Reconciliation failed");
    }
    setOfficeLoading(false);
  };

  const saveSnapshot = async () => {
    if (!officeResult || !selectedOfficeId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("office_reconciliation_snapshots" as any)
        .upsert({
          office_id: selectedOfficeId,
          office_name: officeName,
          snapshot_date: new Date().toISOString().split("T")[0],
          total_office_stock: officeResult.totalOfficeStock,
          available_pairs: officeResult.available,
          assigned_pairs: officeResult.assigned,
          sold_pairs: officeResult.sold,
          spoilt_pairs: officeResult.spoilt,
          pending_purchases: officeResult.pendingPurchases,
          fulfilled_purchases: officeResult.fulfilledPurchases,
          is_balanced: officeResult.isBalanced,
          discrepancy_notes: notes || null,
        }, { onConflict: "office_id,snapshot_date" });
      if (error) throw error;
      toast.success("Snapshot saved!");
      const { data } = await supabase
        .from("office_reconciliation_snapshots" as any)
        .select("*")
        .eq("office_id", selectedOfficeId)
        .order("snapshot_date", { ascending: false })
        .limit(20);
      setSnapshots((data || []) as unknown as Snapshot[]);
    } catch (err: any) {
      toast.error(err.message || "Failed to save snapshot");
    }
    setSaving(false);
  };

  const exportPDF = () => {
    if (!metrics) return;
    const doc = new jsPDF();
    const { from, to } = getDateRange(datePreset, customFrom, customTo);
    doc.setFontSize(16);
    doc.text("Sales & Reconciliation Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Period: ${format(new Date(from), "dd/MM/yyyy")} — ${format(new Date(to), "dd/MM/yyyy")}`, 14, 30);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 36);

    let y = 48;
    const lines = [
      `1. Total Successful Payments: ${metrics.totalPayments}`,
      `2. Total Pairs Paid For: ${metrics.totalPairsPaidFor}`,
      `3. Pairs Awaiting Serial: ${metrics.awaitingSerial}`,
      `4. Pairs Assigned Serials: ${metrics.assignedSerials}`,
      `5. Pairs Unassigned: ${metrics.unassignedPairs}`,
      `6. Net Assigned Pairs: ${metrics.netAssigned}`,
      `7. Inventory Increases: +${metrics.adjustmentIncreases}`,
      `8. Inventory Decreases: -${metrics.adjustmentDecreases}`,
    ];
    lines.forEach(l => { doc.text(l, 14, y); y += 7; });

    if (metrics.stockByOffice.length > 0) {
      y += 4;
      doc.setFontSize(12);
      doc.text("Current Available Stock by Office", 14, y);
      y += 8;
      doc.setFontSize(9);
      metrics.stockByOffice.forEach(s => {
        if (y > 280) { doc.addPage(); y = 20; }
        doc.text(`${s.office_name}: ${s.available} pairs`, 14, y);
        y += 6;
      });
    }

    doc.save(`sales-reconciliation-${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  const presetLabel: Record<DatePreset, string> = {
    today: "Today",
    yesterday: "Yesterday",
    this_week: "This Week",
    this_month: "This Month",
    custom: "Custom Range",
  };

  return (
    <div className="space-y-6">
      {/* ─── Sales Metrics Section ─── */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" /> Sales & Reconciliation
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {(["today", "yesterday", "this_week", "this_month", "custom"] as DatePreset[]).map(p => (
              <Button
                key={p}
                size="sm"
                variant={datePreset === p ? "default" : "outline"}
                onClick={() => setDatePreset(p)}
                className="text-xs"
              >
                {presetLabel[p]}
              </Button>
            ))}
          </div>
        </div>

        {datePreset === "custom" && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs w-36 justify-start">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {customFrom ? format(customFrom, "dd/MM/yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} /></PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs w-36 justify-start">
                    <CalendarIcon className="h-3 w-3 mr-1" />
                    {customTo ? format(customTo, "dd/MM/yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={customTo} onSelect={setCustomTo} /></PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : metrics ? (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <MetricCard label="Successful Payments" value={metrics.totalPayments} />
              <MetricCard label="Pairs Paid For" value={metrics.totalPairsPaidFor} />
              <MetricCard label="Awaiting Serial" value={metrics.awaitingSerial} variant="warning" />
              <MetricCard label="Assigned Serials" value={metrics.assignedSerials} variant="success" />
              <MetricCard label="Unassigned (reversed)" value={metrics.unassignedPairs} variant="destructive" />
              <MetricCard label="Net Assigned" value={metrics.netAssigned} variant="primary" />
              <MetricCard label="Adj. Increases" value={`+${metrics.adjustmentIncreases}`} variant="success" />
              <MetricCard label="Adj. Decreases" value={`-${metrics.adjustmentDecreases}`} variant="destructive" />
            </div>

            {/* Stock by Office */}
            {metrics.stockByOffice.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-card-foreground">Current Available Stock by Office</h3>
                <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                  {metrics.stockByOffice.map(s => (
                    <div key={s.office_name} className="flex items-center justify-between px-4 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-card-foreground">{s.office_name}</span>
                      </div>
                      <span className="font-bold text-primary">{s.available}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="outline" onClick={exportPDF} size="sm">
              <Download className="h-4 w-4 mr-1" /> Export PDF
            </Button>
          </div>
        ) : null}
      </div>

      {/* ─── Office-Level Reconciliation ─── */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Office Stock Reconciliation
        </h2>
        <p className="text-sm text-muted-foreground">
          Run a balance check comparing allocated stock against available, assigned, sold, and spoilt serials for a specific office.
        </p>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[180px]">
            <Label>Region</Label>
            <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedOfficeId(""); setOfficeResult(null); }}>
              <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
              <SelectContent>
                {GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedRegion && (
            <div className="space-y-2 flex-1 min-w-[180px]">
              <Label>Office</Label>
              <Select value={selectedOfficeId} onValueChange={v => { setSelectedOfficeId(v); setOfficeResult(null); }}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {regionOffices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={runOfficeReconciliation} disabled={officeLoading || !officeName}>
            {officeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
            Run Check
          </Button>
        </div>

        {officeResult && (
          <div className="space-y-4 pt-2">
            <div className={`flex items-center gap-2 rounded-lg p-3 border ${officeResult.isBalanced ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              {officeResult.isBalanced ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {officeResult.isBalanced ? "Stock is balanced — all serials accounted for." : "Discrepancy detected — stock does not balance."}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{officeResult.totalOfficeStock}</p>
                <p className="text-xs text-muted-foreground">Total Office Stock</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
                <p className="text-xl font-bold text-success">{officeResult.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xl font-bold text-primary">{officeResult.assigned}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xl font-bold text-destructive">{officeResult.spoilt}</p>
                <p className="text-xs text-muted-foreground">Spoilt</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{officeResult.pendingPurchases}</p>
                <p className="text-xs text-muted-foreground">Pending Purchases (all offices)</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{officeResult.fulfilledPurchases}</p>
                <p className="text-xs text-muted-foreground">Fulfilled by this Office</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Discrepancy Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about any discrepancies..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSnapshot} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Snapshot
              </Button>
              <Button variant="outline" onClick={() => {
                if (!officeResult) return;
                const doc = new jsPDF();
                doc.setFontSize(16);
                doc.text("Office Reconciliation Report", 14, 20);
                doc.setFontSize(10);
                doc.text(`Office: ${officeName}`, 14, 30);
                doc.text(`Date: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 36);
                doc.text(`Status: ${officeResult.isBalanced ? "BALANCED" : "DISCREPANCY DETECTED"}`, 14, 42);
                let y = 54;
                const lines = [
                  `Total Office Stock: ${officeResult.totalOfficeStock}`,
                  `Available: ${officeResult.available}`,
                  `Assigned: ${officeResult.assigned}`,
                  `Sold: ${officeResult.sold}`,
                  `Spoilt: ${officeResult.spoilt}`,
                  `Pending Purchases (system-wide): ${officeResult.pendingPurchases}`,
                  `Fulfilled by this Office: ${officeResult.fulfilledPurchases}`,
                ];
                lines.forEach(l => { doc.text(l, 14, y); y += 7; });
                if (notes) { y += 4; doc.text("Notes:", 14, y); y += 7; doc.setFontSize(9); doc.text(notes.substring(0, 500), 14, y, { maxWidth: 180 }); }
                doc.save(`reconciliation_${officeName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
              }}>
                <Download className="h-4 w-4 mr-1" /> Export PDF
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Snapshot history */}
      {snapshots.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h3 className="text-sm font-semibold text-card-foreground">Snapshot History — {officeName}</h3>
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Spoilt</TableHead>
                  <TableHead className="text-right">Fulfilled</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.snapshot_date}</TableCell>
                    <TableCell className="text-right font-semibold">{s.total_office_stock}</TableCell>
                    <TableCell className="text-right text-success">{s.available_pairs}</TableCell>
                    <TableCell className="text-right text-primary">{s.assigned_pairs}</TableCell>
                    <TableCell className="text-right text-destructive">{s.spoilt_pairs}</TableCell>
                    <TableCell className="text-right">{s.fulfilled_purchases}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_balanced ? "default" : "destructive"} className="text-[10px]">
                        {s.is_balanced ? "Balanced" : "Discrepancy"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {loadingSnapshots && <p className="text-sm text-muted-foreground text-center py-4">Loading history...</p>}
    </div>
  );
};

const MetricCard = ({ label, value, variant }: { label: string; value: number | string; variant?: "success" | "destructive" | "warning" | "primary" }) => {
  const colorClass = variant === "success" ? "text-success" : variant === "destructive" ? "text-destructive" : variant === "warning" ? "text-orange-500" : variant === "primary" ? "text-primary" : "text-card-foreground";
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
};

export default OfficeReconciliation;

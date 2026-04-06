import { useState, useEffect } from "react";
import { ClipboardCheck, Loader2, Download, AlertTriangle, CheckCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS, getOfficesForRegion } from "@/hooks/useAdminProfile";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface ReconciliationResult {
  totalOfficeStock: number;
  available: number;
  assigned: number;
  sold: number;
  spoilt: number;
  pendingPurchases: number;
  fulfilledPurchases: number;
  isBalanced: boolean;
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

const OfficeReconciliation = () => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReconciliationResult | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);
  const officeName = selectedOffice?.name || "";

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

  const runReconciliation = async () => {
    if (!officeName) return;
    setLoading(true);
    setResult(null);

    try {
      // 1. Fetch office stock serials
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

      const available = allSerials.filter(s => s.status === "available").length;
      const assigned = allSerials.filter(s => s.status === "assigned").length;
      const sold = allSerials.filter(s => s.status === "sold").length;
      const spoilt = allSerials.filter(s => s.status === "spoilt").length;
      const totalOfficeStock = allSerials.length;

      // 2. Fetch pending purchases (awaiting_serial rent_cards for this office — approximated)
      const { count: pendingCount } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_serial");

      // 3. Fulfilled purchases (rent_cards with assigned_office_name matching)
      const { count: fulfilledCount } = await supabase
        .from("rent_cards")
        .select("id", { count: "exact", head: true })
        .eq("assigned_office_name" as any, officeName)
        .eq("status", "valid");

      // Balance: total = available + assigned + sold + spoilt
      const accountedFor = available + assigned + sold + spoilt;
      const isBalanced = totalOfficeStock === accountedFor;

      setResult({
        totalOfficeStock,
        available,
        assigned,
        sold,
        spoilt,
        pendingPurchases: pendingCount || 0,
        fulfilledPurchases: fulfilledCount || 0,
        isBalanced,
      });
    } catch (err: any) {
      toast.error(err.message || "Reconciliation failed");
    }
    setLoading(false);
  };

  const saveSnapshot = async () => {
    if (!result || !selectedOfficeId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("office_reconciliation_snapshots" as any)
        .upsert({
          office_id: selectedOfficeId,
          office_name: officeName,
          snapshot_date: new Date().toISOString().split("T")[0],
          total_office_stock: result.totalOfficeStock,
          available_pairs: result.available,
          assigned_pairs: result.assigned,
          sold_pairs: result.sold,
          spoilt_pairs: result.spoilt,
          pending_purchases: result.pendingPurchases,
          fulfilled_purchases: result.fulfilledPurchases,
          is_balanced: result.isBalanced,
          discrepancy_notes: notes || null,
        }, { onConflict: "office_id,snapshot_date" });
      if (error) throw error;
      toast.success("Snapshot saved!");
      // Refresh snapshots
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
    if (!result) return;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Office Reconciliation Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Office: ${officeName}`, 14, 30);
    doc.text(`Date: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 36);
    doc.text(`Status: ${result.isBalanced ? "BALANCED" : "DISCREPANCY DETECTED"}`, 14, 42);

    let y = 54;
    const lines = [
      `Total Office Stock: ${result.totalOfficeStock}`,
      `Available: ${result.available}`,
      `Assigned: ${result.assigned}`,
      `Sold: ${result.sold}`,
      `Spoilt: ${result.spoilt}`,
      `Pending Purchases (system-wide): ${result.pendingPurchases}`,
      `Fulfilled by this Office: ${result.fulfilledPurchases}`,
    ];
    lines.forEach(l => { doc.text(l, 14, y); y += 7; });

    if (notes) {
      y += 4;
      doc.text("Notes:", 14, y);
      y += 7;
      doc.setFontSize(9);
      doc.text(notes.substring(0, 500), 14, y, { maxWidth: 180 });
    }

    doc.save(`reconciliation_${officeName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-primary" /> Office Reconciliation
        </h2>
        <p className="text-sm text-muted-foreground">
          Run a balance check comparing allocated stock against available, assigned, sold, and spoilt serials.
        </p>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[180px]">
            <Label>Region</Label>
            <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedOfficeId(""); setResult(null); }}>
              <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
              <SelectContent>
                {GHANA_REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {selectedRegion && (
            <div className="space-y-2 flex-1 min-w-[180px]">
              <Label>Office</Label>
              <Select value={selectedOfficeId} onValueChange={v => { setSelectedOfficeId(v); setResult(null); }}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {regionOffices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={runReconciliation} disabled={loading || !officeName}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
            Run Check
          </Button>
        </div>

        {result && (
          <div className="space-y-4 pt-2">
            {/* Balance status */}
            <div className={`flex items-center gap-2 rounded-lg p-3 border ${result.isBalanced ? "border-success/30 bg-success/5 text-success" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
              {result.isBalanced ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              <span className="text-sm font-medium">
                {result.isBalanced ? "Stock is balanced — all serials accounted for." : "Discrepancy detected — stock does not balance."}
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{result.totalOfficeStock}</p>
                <p className="text-xs text-muted-foreground">Total Office Stock</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
                <p className="text-xl font-bold text-success">{result.available}</p>
                <p className="text-xs text-muted-foreground">Available</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xl font-bold text-primary">{result.assigned}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xl font-bold text-destructive">{result.spoilt}</p>
                <p className="text-xs text-muted-foreground">Spoilt</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{result.pendingPurchases}</p>
                <p className="text-xs text-muted-foreground">Pending Purchases (all offices)</p>
              </div>
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{result.fulfilledPurchases}</p>
                <p className="text-xs text-muted-foreground">Fulfilled by this Office</p>
              </div>
            </div>

            {/* Notes + actions */}
            <div className="space-y-2">
              <Label>Discrepancy Notes (optional)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about any discrepancies..." />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveSnapshot} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Save Snapshot
              </Button>
              <Button variant="outline" onClick={exportPDF}>
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

export default OfficeReconciliation;

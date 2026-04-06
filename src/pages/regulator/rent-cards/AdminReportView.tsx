import { useState, useEffect } from "react";
import { BarChart3, Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import jsPDF from "jspdf";

interface DailyReport {
  id: string;
  office_id: string;
  office_name: string;
  staff_user_id: string;
  staff_name: string;
  report_date: string;
  opening_pairs: number;
  assigned_today: number;
  sold_today: number;
  spoilt_today: number;
  closing_pairs: number;
  notes: string | null;
  signed_name: string | null;
  created_at: string;
  fulfilled_purchases?: number;
}

const AdminReportView = () => {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [officeFilter, setOfficeFilter] = useState("all");
  const [offices, setOffices] = useState<string[]>([]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("daily_stock_reports" as any)
        .select("*")
        .order("report_date", { ascending: false })
        .order("office_name");

      if (dateFrom) query = query.gte("report_date", dateFrom);
      if (dateTo) query = query.lte("report_date", dateTo);
      if (officeFilter !== "all") query = query.eq("office_name", officeFilter);

      const { data, error } = await query.limit(500);
      if (error) throw error;
      const items = (data || []) as unknown as DailyReport[];

      // Fetch fulfilled purchase counts per office
      const officeNames = [...new Set(items.map(r => r.office_name))];
      const fulfilledMap = new Map<string, number>();
      for (const oName of officeNames) {
        const { count } = await (supabase
          .from("rent_cards")
          .select("id", { count: "exact", head: true }) as any)
          .eq("assigned_office_name", oName)
          .eq("status", "valid");
        fulfilledMap.set(oName, count || 0);
      }
      items.forEach(r => { r.fulfilled_purchases = fulfilledMap.get(r.office_name) || 0; });

      setReports(items);

      const uniqueOffices = [...new Set(items.map(r => r.office_name))].sort();
      setOffices(uniqueOffices);
    } catch (err: any) {
      toast.error(err.message || "Failed to load reports");
    }
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const filtered = reports.filter(r => {
    if (officeFilter !== "all" && r.office_name !== officeFilter) return false;
    return true;
  });

  // Aggregated totals
  const totals = filtered.reduce(
    (acc, r) => ({
      opening: acc.opening + r.opening_pairs,
      assigned: acc.assigned + r.assigned_today,
      sold: acc.sold + r.sold_today,
      spoilt: acc.spoilt + r.spoilt_today,
      closing: acc.closing + r.closing_pairs,
    }),
    { opening: 0, assigned: 0, sold: 0, spoilt: 0, closing: 0 }
  );

  const exportCSV = () => {
    const headers = ["Date", "Office", "Staff", "Opening", "Assigned", "Sold", "Spoilt", "Closing", "Notes", "Signed By"];
    const rows = filtered.map(r => [
      r.report_date, r.office_name, r.staff_name, r.opening_pairs, r.assigned_today,
      r.sold_today, r.spoilt_today, r.closing_pairs, `"${(r.notes || "").replace(/"/g, '""')}"`, r.signed_name || "",
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `daily_reports_${dateFrom || "all"}_to_${dateTo || "all"}.csv`;
    a.click();
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Daily Rent Card Reports", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
    if (dateFrom || dateTo) doc.text(`Period: ${dateFrom || "Start"} to ${dateTo || "Present"}`, 14, 34);

    let y = 44;
    doc.setFontSize(8);
    const headers = ["Date", "Office", "Staff", "Opening", "Assigned", "Sold", "Spoilt", "Closing"];
    const colWidths = [25, 50, 45, 22, 22, 18, 18, 22];

    // Header row
    doc.setFont(undefined!, "bold");
    let x = 14;
    headers.forEach((h, i) => { doc.text(h, x, y); x += colWidths[i]; });
    y += 6;
    doc.setFont(undefined!, "normal");

    for (const r of filtered) {
      if (y > 190) { doc.addPage(); y = 20; }
      x = 14;
      const vals = [r.report_date, r.office_name, r.staff_name, String(r.opening_pairs), String(r.assigned_today), String(r.sold_today), String(r.spoilt_today), String(r.closing_pairs)];
      vals.forEach((v, i) => { doc.text(v.substring(0, colWidths[i] / 2.5), x, y); x += colWidths[i]; });
      y += 5;
    }

    // Totals
    y += 4;
    doc.setFont(undefined!, "bold");
    doc.text(`Totals — Opening: ${totals.opening} | Assigned: ${totals.assigned} | Sold: ${totals.sold} | Spoilt: ${totals.spoilt} | Closing: ${totals.closing}`, 14, y);

    doc.save(`daily_reports_${dateFrom || "all"}_to_${dateTo || "all"}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Admin Report View
        </h2>
        <p className="text-sm text-muted-foreground">View and download aggregated daily stock reports across offices and staff.</p>

        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-2">
            <Label>Office</Label>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices</SelectItem>
                {offices.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={fetchReports} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>

        {/* Summary */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-lg border border-border p-3 text-center">
              <p className="text-xl font-bold text-card-foreground">{totals.opening}</p>
              <p className="text-xs text-muted-foreground">Total Opening</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-xl font-bold text-primary">{totals.assigned}</p>
              <p className="text-xs text-muted-foreground">Total Assigned</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
              <p className="text-xl font-bold text-success">{totals.sold}</p>
              <p className="text-xs text-muted-foreground">Total Sold</p>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
              <p className="text-xl font-bold text-destructive">{totals.spoilt}</p>
              <p className="text-xs text-muted-foreground">Total Spoilt</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-xl font-bold text-card-foreground">{totals.closing}</p>
              <p className="text-xs text-muted-foreground">Total Closing</p>
            </div>
          </div>
        )}

        {/* Export buttons */}
        {filtered.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1" /> Export Excel (CSV)
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <Download className="h-4 w-4 mr-1" /> Export PDF
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Loading reports...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No reports found.</p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Office</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Assigned</TableHead>
                  <TableHead className="text-right">Sold</TableHead>
                  <TableHead className="text-right">Spoilt</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">Fulfilled</TableHead>
                  <TableHead>Signed By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.report_date}</TableCell>
                    <TableCell className="text-sm">{r.office_name}</TableCell>
                    <TableCell className="text-sm">{r.staff_name}</TableCell>
                    <TableCell className="text-right font-semibold">{r.opening_pairs}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{r.assigned_today}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{r.sold_today}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{r.spoilt_today}</TableCell>
                    <TableCell className="text-right font-semibold">{r.closing_pairs}</TableCell>
                    <TableCell className="text-right font-semibold text-info">{r.fulfilled_purchases ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.signed_name || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReportView;

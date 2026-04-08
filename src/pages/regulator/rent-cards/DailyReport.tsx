import { useState, useEffect } from "react";
import { FileText, Loader2, CheckCircle, Download, Calendar as CalendarIcon, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AdminProfile, GHANA_REGIONS, getOfficesForRegion, getRegionForOffice } from "@/hooks/useAdminProfile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import jsPDF from "jspdf";

interface Props {
  profile: AdminProfile | null;
  refreshKey: number;
}

interface DailyStats {
  openingPairs: number;
  assignedToday: number;
  soldToday: number;
  spoiltToday: number;
  closingPairs: number;
}

type ReportPeriod = "daily" | "weekly" | "custom";

const DailyReport = ({ profile }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState(profile?.officeId || "");
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [signedName, setSignedName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Period & date state
  const [period, setPeriod] = useState<ReportPeriod>("daily");
  const [reportDate, setReportDate] = useState<Date>(new Date());
  const [rangeFrom, setRangeFrom] = useState<Date | undefined>();
  const [rangeTo, setRangeTo] = useState<Date | undefined>();

  // Previous reports
  const [prevReports, setPrevReports] = useState<any[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(false);

  const isMain = !profile || profile.isMainAdmin;
  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);
  const officeName = selectedOffice?.name || "";

  useEffect(() => {
    if (profile && !profile.isMainAdmin && profile.officeId) {
      setSelectedOfficeId(profile.officeId);
      const region = getRegionForOffice(profile.officeId);
      if (region) setSelectedRegion(region);
    }
  }, [profile]);

  // Load previous reports when office changes
  useEffect(() => {
    if (!selectedOfficeId || !officeName) { setPrevReports([]); return; }
    const fetchPrev = async () => {
      setLoadingPrev(true);
      const { data } = await supabase
        .from("daily_stock_reports" as any)
        .select("*")
        .eq("office_id", selectedOfficeId)
        .order("report_date", { ascending: false })
        .limit(30);
      setPrevReports(data || []);
      setLoadingPrev(false);
    };
    fetchPrev();
  }, [selectedOfficeId, officeName, submitted]);

  const getDateRange = (): { from: string; to: string; label: string } => {
    if (period === "daily") {
      const d = reportDate;
      return {
        from: startOfDay(d).toISOString(),
        to: endOfDay(d).toISOString(),
        label: format(d, "dd/MM/yyyy"),
      };
    }
    if (period === "weekly") {
      const ws = startOfWeek(reportDate, { weekStartsOn: 1 });
      const we = endOfWeek(reportDate, { weekStartsOn: 1 });
      return {
        from: startOfDay(ws).toISOString(),
        to: endOfDay(we).toISOString(),
        label: `${format(ws, "dd/MM")} – ${format(we, "dd/MM/yyyy")}`,
      };
    }
    // custom
    return {
      from: startOfDay(rangeFrom || new Date()).toISOString(),
      to: endOfDay(rangeTo || new Date()).toISOString(),
      label: `${format(rangeFrom || new Date(), "dd/MM/yyyy")} – ${format(rangeTo || new Date(), "dd/MM/yyyy")}`,
    };
  };

  const generateReport = async () => {
    if (!officeName) { toast.error("Select an office first"); return; }
    if (period === "custom" && (!rangeFrom || !rangeTo)) { toast.error("Select both from and to dates"); return; }
    setLoading(true);
    setSubmitted(false);

    try {
      const { from: periodStart, to: periodEnd } = getDateRange();

      // Fetch all serials for office (office stock only)
      let allSerials: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("rent_card_serial_stock")
          .select("serial_number, status, assigned_at, created_at, pair_index")
          .eq("office_name", officeName)
          .eq("stock_type", "office")
          .order("serial_number", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allSerials = allSerials.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const uniqueAvailable = new Set(allSerials.filter(s => s.status === "available").map(s => s.serial_number)).size;
      const uniqueSpoilt = new Set(allSerials.filter(s => s.status === "spoilt").map(s => s.serial_number)).size;
      const uniqueAssignedInPeriod = new Set(
        allSerials.filter(s => s.status === "assigned" && s.assigned_at && s.assigned_at >= periodStart && s.assigned_at < periodEnd)
          .map(s => s.serial_number)
      ).size;

      // Fetch quota info
      let quotaRemaining = 0;
      let quotaUsedInPeriod = 0;
      if (selectedOfficeId) {
        const { data: quotaAllocs } = await supabase
          .from("office_allocations" as any)
          .select("quota_limit")
          .eq("office_id", selectedOfficeId)
          .in("allocation_mode", ["quota", "quantity_transfer"]);
        const totalQuota = (quotaAllocs || []).reduce((sum: number, a: any) => sum + (a.quota_limit || 0), 0);
        if (totalQuota > 0) {
          const { data: assignments } = await supabase
            .from("serial_assignments" as any)
            .select("card_count, created_at")
            .eq("office_id", selectedOfficeId);
          const totalUsed = (assignments || []).reduce((sum: number, a: any) => sum + (a.card_count || 0), 0);
          quotaRemaining = Math.max(0, totalQuota - totalUsed);
          quotaUsedInPeriod = (assignments || []).filter((a: any) => a.created_at >= periodStart && a.created_at < periodEnd)
            .reduce((sum: number, a: any) => sum + (a.card_count || 0), 0);
        }
      }

      const physicalAvailablePairs = Math.floor(uniqueAvailable / 2);
      const openingPairs = physicalAvailablePairs + quotaRemaining + uniqueAssignedInPeriod + quotaUsedInPeriod;

      setStats({
        openingPairs,
        assignedToday: uniqueAssignedInPeriod + quotaUsedInPeriod,
        soldToday: uniqueAssignedInPeriod + quotaUsedInPeriod,
        spoiltToday: uniqueSpoilt,
        closingPairs: physicalAvailablePairs + quotaRemaining,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    }
    setLoading(false);
  };

  const submitReport = async () => {
    if (!stats || !signedName.trim()) {
      toast.error("Please sign off by entering your full name");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { toast.error("Not authenticated"); setSubmitting(false); return; }
      const reportDateStr = period === "daily" ? format(reportDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const { error } = await supabase.from("daily_stock_reports" as any).insert({
        office_id: selectedOfficeId,
        office_name: officeName,
        staff_user_id: authUser.id,
        staff_name: signedName,
        report_date: reportDateStr,
        opening_pairs: stats.openingPairs,
        assigned_today: stats.assignedToday,
        sold_today: stats.soldToday,
        spoilt_today: stats.spoiltToday,
        closing_pairs: stats.closingPairs,
        notes: notes || null,
        signed_name: signedName,
      });
      if (error) throw error;
      toast.success("Daily report submitted and signed off!");
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit report");
    }
    setSubmitting(false);
  };

  const exportCSV = () => {
    if (!stats) return;
    const { label } = getDateRange();
    const rows = [
      ["Rent Card Stock Report"],
      ["Office", officeName],
      ["Period", label],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["Metric", "Value"],
      ["Opening Rent Card Pairs", String(stats.openingPairs)],
      ["Assigned", String(stats.assignedToday)],
      ["Sold", String(stats.soldToday)],
      ["Spoilt", String(stats.spoiltToday)],
      ["Closing Rent Card Pairs", String(stats.closingPairs)],
      [],
      ["Signed By", signedName || "—"],
      ["Notes", notes || "—"],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rent-card-report-${officeName.replace(/\s+/g, "-")}-${format(reportDate, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    if (!stats) return;
    const { label } = getDateRange();
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Rent Card Stock Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Office: ${officeName}`, 14, 30);
    doc.text(`Period: ${label}`, 14, 36);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 42);

    const startY = 52;
    const metrics = [
      ["Opening Rent Card Pairs", String(stats.openingPairs)],
      ["Assigned", String(stats.assignedToday)],
      ["Sold", String(stats.soldToday)],
      ["Spoilt", String(stats.spoiltToday)],
      ["Closing Rent Card Pairs", String(stats.closingPairs)],
    ];

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Metric", 14, startY);
    doc.text("Value", 120, startY);
    doc.line(14, startY + 2, 196, startY + 2);
    doc.setFont("helvetica", "normal");

    metrics.forEach(([metric, value], i) => {
      const y = startY + 8 + i * 7;
      doc.text(metric, 14, y);
      doc.text(value, 120, y);
    });

    const notesY = startY + 8 + metrics.length * 7 + 10;
    doc.text(`Signed By: ${signedName || "—"}`, 14, notesY);
    doc.text(`Notes: ${notes || "—"}`, 14, notesY + 7);

    doc.save(`rent-card-report-${officeName.replace(/\s+/g, "-")}-${format(reportDate, "yyyy-MM-dd")}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Rent Card Stock Report
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate reports by date, week, or custom range. All values are auto-calculated from system data.
        </p>

        {/* Office selection */}
        <div className="flex items-end gap-4 flex-wrap">
          {isMain ? (
            <>
              <div className="space-y-2 flex-1 min-w-[180px]">
                <Label>Region</Label>
                <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedOfficeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRegion && (
                <div className="space-y-2 flex-1 min-w-[180px]">
                  <Label>Office</Label>
                  <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                    <SelectContent>
                      {regionOffices.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Office</Label>
              <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted/30">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-card-foreground">{officeName || "No office assigned"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Period selector */}
        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2">
            <Label>Report Period</Label>
            <Select value={period} onValueChange={v => setPeriod(v as ReportPeriod)}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(period === "daily" || period === "weekly") && (
            <div className="space-y-2">
              <Label>{period === "daily" ? "Date" : "Week of"}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !reportDate && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {format(reportDate, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={reportDate} onSelect={d => d && setReportDate(d)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {period === "custom" && (
            <>
              <div className="space-y-2">
                <Label>From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !rangeFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {rangeFrom ? format(rangeFrom, "dd/MM/yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={rangeFrom} onSelect={setRangeFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !rangeTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {rangeTo ? format(rangeTo, "dd/MM/yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={rangeTo} onSelect={setRangeTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}
        </div>

        <Button onClick={generateReport} disabled={loading || !officeName}>
          {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Compiling...</> : <><FileText className="h-4 w-4 mr-1" /> Generate Report</>}
        </Button>

        {stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{stats.openingPairs}</p>
                <p className="text-xs text-muted-foreground">Opening Rent Card Pairs</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
                <p className="text-xl font-bold text-primary">{stats.assignedToday}</p>
                <p className="text-xs text-muted-foreground">Assigned</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 text-center">
                <p className="text-xl font-bold text-success">{stats.soldToday}</p>
                <p className="text-xs text-muted-foreground">Sold</p>
              </div>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
                <p className="text-xl font-bold text-destructive">{stats.spoiltToday}</p>
                <p className="text-xs text-muted-foreground">Spoilt</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                <p className="text-xl font-bold text-card-foreground">{stats.closingPairs}</p>
                <p className="text-xs text-muted-foreground">Closing Rent Card Pairs</p>
              </div>
            </div>

            <div className="bg-muted/20 rounded-lg p-4 space-y-2 text-xs text-muted-foreground">
              <p><strong>Staff:</strong> {profile?.officeName || "—"}</p>
              <p><strong>Office:</strong> {officeName} ({selectedOfficeId})</p>
              <p><strong>Period:</strong> {getDateRange().label}</p>
              <p><strong>Generated:</strong> {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
            </div>

            {/* Export buttons */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <Download className="h-4 w-4 mr-1" /> Export PDF
              </Button>
            </div>

            {!submitted && (
              <div className="space-y-3 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add any notes about today's activity..." />
                </div>
                <div className="space-y-2">
                  <Label>Sign Off — Type your full name</Label>
                  <Input value={signedName} onChange={e => setSignedName(e.target.value)} placeholder="Enter your full name to sign off..." />
                </div>
                <Button onClick={submitReport} disabled={submitting || !signedName.trim()}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Submitting...</> : <><CheckCircle className="h-4 w-4 mr-1" /> Submit & Sign Off</>}
                </Button>
              </div>
            )}

            {submitted && (
              <div className="flex items-center gap-2 text-success bg-success/10 border border-success/20 rounded-lg p-3">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">Report submitted and signed off successfully.</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Previous Reports */}
      {selectedOfficeId && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" /> Previous Reports
          </h2>
          {loadingPrev ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : prevReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No previous reports submitted for this office.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Opening</TableHead>
                    <TableHead className="text-center">Assigned</TableHead>
                    <TableHead className="text-center">Sold</TableHead>
                    <TableHead className="text-center">Spoilt</TableHead>
                    <TableHead className="text-center">Closing</TableHead>
                    <TableHead>Signed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prevReports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.report_date}</TableCell>
                      <TableCell className="text-center">{r.opening_pairs}</TableCell>
                      <TableCell className="text-center">{r.assigned_today}</TableCell>
                      <TableCell className="text-center">{r.sold_today}</TableCell>
                      <TableCell className="text-center">{r.spoilt_today}</TableCell>
                      <TableCell className="text-center">{r.closing_pairs}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.signed_name || r.staff_name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyReport;

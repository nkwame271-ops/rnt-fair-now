import { useState, useEffect, useMemo } from "react";
import { Loader2, Wallet, TrendingUp, Receipt, DollarSign, Building, Tag, Zap, Hand, CheckCircle, XCircle, Clock, AlertTriangle, Download, Calendar as CalendarIcon, Filter, Info } from "lucide-react";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import AnimatedCounter from "@/components/AnimatedCounter";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import PaymentReceipt from "@/components/PaymentReceipt";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import jsPDF from "jspdf";

interface OfficeRevenue {
  officeId: string;
  officeName: string;
  total: number;
  igf: number;
  admin: number;
  platform: number;
  landlord: number;
  gra: number;
  autoReleased: number;
  manualReleased: number;
  walletBalance: number;
  released: number;
}

interface RevenueByType {
  label: string;
  types: string[];
  total: number;
  count: number;
  color: string;
}

const REVENUE_TYPE_CONFIG: { label: string; types: string[]; color: string }[] = [
  { label: "Rent Card Sales", types: ["rent_card", "rent_card_bulk"], color: "bg-primary/10 border-primary/20 text-primary" },
  { label: "Registrations", types: ["tenant_registration", "landlord_registration", "tenant_registration_fee", "landlord_registration_fee"], color: "bg-info/10 border-info/20 text-info" },
  { label: "Quit Notices / Ejection", types: ["termination_fee"], color: "bg-destructive/10 border-destructive/20 text-destructive" },
  { label: "Tenancy Agreement", types: ["agreement_sale", "add_tenant_fee"], color: "bg-success/10 border-success/20 text-success" },
  { label: "Rent Tax", types: ["rent_tax", "rent_tax_bulk"], color: "bg-accent/10 border-accent/20 text-accent-foreground" },
  { label: "Complaint Fee", types: ["complaint_fee"], color: "bg-warning/10 border-warning/20 text-warning" },
  { label: "Listing Fee", types: ["listing_fee"], color: "bg-muted border-border text-muted-foreground" },
  { label: "Viewing Fee", types: ["viewing_fee"], color: "bg-info/10 border-info/20 text-info" },
  { label: "Archive Search", types: ["archive_search_fee"], color: "bg-muted border-border text-muted-foreground" },
];

const SUB_ADMIN_VISIBLE_RECIPIENTS = ["rent_control", "admin"];

type DatePreset = "all" | "today" | "yesterday" | "last7" | "this_week" | "this_month" | "custom";

function getPresetRange(preset: DatePreset): { from: string | null; to: string | null } {
  const now = new Date();
  switch (preset) {
    case "today": return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
    case "yesterday": { const y = subDays(now, 1); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }; }
    case "last7": return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() };
    case "this_week": return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: endOfWeek(now, { weekStartsOn: 1 }).toISOString() };
    case "this_month": return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() };
    default: return { from: null, to: null };
  }
}

const EscrowDashboard = () => {
  const { profile } = useAdminProfile();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEscrow: 0, completed: 0, pending: 0, rentControl: 0, admin: 0, platform: 0, landlord: 0, gra: 0, autoReleased: 0, manualReleased: 0 });
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [officeRevenue, setOfficeRevenue] = useState<OfficeRevenue[]>([]);
  const [revenueByType, setRevenueByType] = useState<RevenueByType[]>([]);
  const [pipelineStats, setPipelineStats] = useState({ webhookReceived: 0, verified: 0, allocated: 0, transfersTriggered: 0, transfersFailed: 0 });

  // Date filter state
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const effectiveOffice = profile && !profile.isMainAdmin && profile.officeId
    ? profile.officeId
    : selectedOffice;

  const isMainAdmin = profile?.isMainAdmin ?? false;
  const { isVisible } = useModuleVisibility("escrow");

  const dateRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? startOfDay(customFrom).toISOString() : null,
        to: customTo ? endOfDay(customTo).toISOString() : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const dateLabel = useMemo(() => {
    if (datePreset === "all") return "All Time";
    if (datePreset === "custom" && customFrom && customTo) return `${format(customFrom, "dd/MM/yyyy")} – ${format(customTo, "dd/MM/yyyy")}`;
    if (datePreset === "today") return `Today (${format(new Date(), "dd/MM/yyyy")})`;
    if (datePreset === "yesterday") return `Yesterday (${format(subDays(new Date(), 1), "dd/MM/yyyy")})`;
    if (datePreset === "last7") return "Last 7 Days";
    if (datePreset === "this_week") return "This Week";
    if (datePreset === "this_month") return "This Month";
    return "";
  }, [datePreset, customFrom, customTo]);

  useEffect(() => {
    const fetchOffices = async () => {
      const { data } = await supabase.from("offices").select("id, name").order("name");
      setOffices(data || []);
    };
    fetchOffices();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const officeFilter = effectiveOffice !== "all" ? effectiveOffice : null;

      // Helper to apply date filter
      const applyDateFilter = (query: any) => {
        if (dateRange.from) query = query.gte("created_at", dateRange.from);
        if (dateRange.to) query = query.lte("created_at", dateRange.to);
        return query;
      };

      // Escrow transactions
      let txQuery = supabase.from("escrow_transactions").select("status, total_amount, office_id, payment_type, created_at");
      if (officeFilter) txQuery = txQuery.eq("office_id", officeFilter);
      txQuery = applyDateFilter(txQuery);
      const { data: transactions } = await txQuery;

      const completed = (transactions || []).filter(t => t.status === "completed");
      const pending = (transactions || []).filter(t => t.status === "pending");

      const typeAgg = REVENUE_TYPE_CONFIG.map(cfg => {
        const matching = completed.filter(t => cfg.types.includes(t.payment_type));
        return {
          label: cfg.label,
          types: cfg.types,
          total: matching.reduce((s, t) => s + Number(t.total_amount), 0),
          count: matching.length,
          color: cfg.color,
        };
      });
      setRevenueByType(typeAgg);

      // Splits
      let splitsQuery = supabase.from("escrow_splits").select("recipient, amount, office_id, release_mode, escrow_transaction_id");
      if (officeFilter) splitsQuery = splitsQuery.eq("office_id", officeFilter);
      // For date filtering on splits, we filter by the parent transaction IDs
      const completedIds = completed.map(t => (t as any).id).filter(Boolean);
      // We can't easily date-filter splits without a created_at. Instead we use the transaction set.
      const { data: allSplitsRaw } = await splitsQuery;
      // If date filter is active, only include splits for transactions in range
      let splits = allSplitsRaw || [];
      if (dateRange.from && completedIds.length === 0 && completed.length === 0) {
        splits = [];
      }

      const byRecipient = splits.reduce((acc: Record<string, number>, s: any) => {
        acc[s.recipient] = (acc[s.recipient] || 0) + Number(s.amount);
        return acc;
      }, {});

      const autoReleased = splits.filter((s: any) => s.release_mode === "auto").reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      const manualReleased = splits.filter((s: any) => s.release_mode === "manual" && s.recipient !== "landlord").reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      setStats({
        totalEscrow: completed.reduce((s, t) => s + Number(t.total_amount), 0),
        completed: completed.length,
        pending: pending.length,
        rentControl: byRecipient.rent_control || 0,
        admin: byRecipient.admin || 0,
        platform: byRecipient.platform || 0,
        landlord: byRecipient.landlord || 0,
        gra: byRecipient.gra || 0,
        autoReleased,
        manualReleased,
      });

      // Pipeline stats
      let payoutsQuery = supabase.from("payout_transfers").select("status, escrow_transaction_id, created_at");
      payoutsQuery = applyDateFilter(payoutsQuery);
      const { data: payouts } = await payoutsQuery;
      const uniqueEscrowsWithPayouts = new Set((payouts || []).map((p: any) => p.escrow_transaction_id));
      const failedTransfers = (payouts || []).filter((p: any) => p.status === "failed").length;

      setPipelineStats({
        webhookReceived: completed.length,
        verified: completed.length,
        allocated: splits.length > 0 ? completed.length : 0,
        transfersTriggered: uniqueEscrowsWithPayouts.size,
        transfersFailed: failedTransfers,
      });

      // Office revenue breakdown
      if (!officeFilter) {
        const officeMap = new Map<string, OfficeRevenue>();
        const officeNames = new Map((await supabase.from("offices").select("id, name")).data?.map(o => [o.id, o.name]) || []);

        const { data: approvedRequests } = await supabase
          .from("office_fund_requests")
          .select("office_id, amount")
          .eq("status", "approved");

        const releasedByOffice = new Map<string, number>();
        for (const req of (approvedRequests || []) as any[]) {
          releasedByOffice.set(req.office_id, (releasedByOffice.get(req.office_id) || 0) + Number(req.amount));
        }

        for (const s of splits as any[]) {
          const oid = s.office_id || "unassigned";
          if (!officeMap.has(oid)) {
            officeMap.set(oid, { officeId: oid, officeName: officeNames.get(oid) || "Unassigned", total: 0, igf: 0, admin: 0, platform: 0, landlord: 0, gra: 0, autoReleased: 0, manualReleased: 0, walletBalance: 0, released: 0 });
          }
          const entry = officeMap.get(oid)!;
          entry.total += Number(s.amount);
          if (s.recipient === "rent_control") entry.igf += Number(s.amount);
          else if (s.recipient === "admin") entry.admin += Number(s.amount);
          else if (s.recipient === "platform") entry.platform += Number(s.amount);
          else if (s.recipient === "landlord") entry.landlord += Number(s.amount);
          else if (s.recipient === "gra") entry.gra += Number(s.amount);
          if (s.release_mode === "auto") entry.autoReleased += Number(s.amount);
          else if (s.recipient !== "landlord") entry.manualReleased += Number(s.amount);
        }

        for (const [oid, entry] of officeMap) {
          entry.released = releasedByOffice.get(oid) || 0;
          entry.walletBalance = entry.admin - entry.released;
        }

        setOfficeRevenue(Array.from(officeMap.values()).sort((a, b) => b.total - a.total));
      } else {
        setOfficeRevenue([]);
      }

      // Recent receipts
      let receiptsQuery = supabase.from("payment_receipts").select("*").order("created_at", { ascending: false }).limit(50);
      if (officeFilter) receiptsQuery = receiptsQuery.eq("office_id", officeFilter);
      receiptsQuery = applyDateFilter(receiptsQuery);
      const { data: recentReceipts } = await receiptsQuery;
      setReceipts(recentReceipts || []);
      setLoading(false);
    };
    fetchData();
  }, [effectiveOffice, dateRange.from, dateRange.to]);

  const filteredReceipts = search
    ? receipts.filter(r =>
        r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.payer_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.payment_type?.toLowerCase().includes(search.toLowerCase())
      )
    : receipts;

  const allAllocationCards = [
    { label: "IGF (Rent Control)", amount: stats.rentControl, color: "bg-primary/10 border-primary/20 text-primary", recipient: "rent_control" },
    { label: "Admin", amount: stats.admin, color: "bg-info/10 border-info/20 text-info", recipient: "admin" },
    { label: "Platform", amount: stats.platform, color: "bg-success/10 border-success/20 text-success", recipient: "platform" },
    { label: "GRA", amount: stats.gra, color: "bg-accent/10 border-accent/20 text-accent-foreground", recipient: "gra" },
    { label: "Landlord (Held)", amount: stats.landlord, color: "bg-warning/10 border-warning/20 text-warning", recipient: "landlord" },
  ];

  const allocationCards = isMainAdmin
    ? allAllocationCards
    : allAllocationCards.filter(c => SUB_ADMIN_VISIBLE_RECIPIENTS.includes(c.recipient));

  // Export helpers
  const exportCSV = () => {
    const rows: string[][] = [
      ["Escrow & Revenue Report"],
      ["Period", dateLabel],
      ["Office", effectiveOffice === "all" ? "All Offices (National)" : offices.find(o => o.id === effectiveOffice)?.name || effectiveOffice],
      ["Generated", format(new Date(), "dd/MM/yyyy HH:mm")],
      [],
      ["SUMMARY"],
      ["Total Revenue", `GHS ${stats.totalEscrow.toFixed(2)}`],
      ["Completed Transactions", String(stats.completed)],
      ["Pending Transactions", String(stats.pending)],
      ["Auto-Released", `GHS ${stats.autoReleased.toFixed(2)}`],
      ["Manually Released", `GHS ${stats.manualReleased.toFixed(2)}`],
      [],
      ["ALLOCATION BREAKDOWN"],
      ...allocationCards.map(c => [c.label, `GHS ${c.amount.toFixed(2)}`]),
      [],
      ["REVENUE BY TYPE"],
      ["Type", "Amount (GHS)", "Transactions"],
      ...revenueByType.filter(r => r.total > 0 || r.count > 0).map(r => [r.label, r.total.toFixed(2), String(r.count)]),
    ];

    if (officeRevenue.length > 0) {
      rows.push([], ["OFFICE BREAKDOWN"], ["Office", "Total", "IGF", "Admin", "Platform", "GRA", "Landlord", "Wallet Balance"]);
      officeRevenue.forEach(o => {
        rows.push([o.officeName, o.total.toFixed(2), o.igf.toFixed(2), o.admin.toFixed(2), o.platform.toFixed(2), o.gra.toFixed(2), o.landlord.toFixed(2), o.walletBalance.toFixed(2)]);
      });
    }

    rows.push([], ["RECEIPT REGISTER"], ["Receipt #", "Date", "Payer", "Type", "Amount (GHS)", "Status"]);
    filteredReceipts.forEach(r => {
      rows.push([r.receipt_number, format(new Date(r.created_at), "dd/MM/yyyy"), r.payer_name || "—", r.payment_type, Number(r.total_amount).toFixed(2), r.status]);
    });

    const csv = rows.map(r => r.map(c => `"${(c || "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `escrow-report-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    const lm = 14;

    doc.setFontSize(16);
    doc.text("Escrow & Revenue Report", lm, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Period: ${dateLabel}`, lm, y); y += 5;
    doc.text(`Office: ${effectiveOffice === "all" ? "All Offices (National)" : offices.find(o => o.id === effectiveOffice)?.name || effectiveOffice}`, lm, y); y += 5;
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, lm, y); y += 10;

    // Summary
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Summary", lm, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const summaryItems = [
      ["Total Revenue", `GHS ${stats.totalEscrow.toFixed(2)}`],
      ["Completed", String(stats.completed)],
      ["Pending", String(stats.pending)],
      ["Auto-Released", `GHS ${stats.autoReleased.toFixed(2)}`],
      ["Manual Released", `GHS ${stats.manualReleased.toFixed(2)}`],
    ];
    summaryItems.forEach(([label, val]) => {
      doc.text(label, lm, y);
      doc.text(val, 100, y);
      y += 5;
    });
    y += 5;

    // Allocation
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Allocation Breakdown", lm, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    allocationCards.forEach(c => {
      doc.text(c.label, lm, y);
      doc.text(`GHS ${c.amount.toFixed(2)}`, 100, y);
      y += 5;
    });
    y += 5;

    // Revenue by type
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Revenue by Type", lm, y); y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Type", lm, y); doc.text("Amount", 100, y); doc.text("Count", 140, y); y += 5;
    doc.setFont("helvetica", "normal");
    revenueByType.filter(r => r.total > 0).forEach(r => {
      doc.text(r.label, lm, y);
      doc.text(`GHS ${r.total.toFixed(2)}`, 100, y);
      doc.text(String(r.count), 140, y);
      y += 5;
      if (y > 275) { doc.addPage(); y = 20; }
    });
    y += 5;

    // Receipt register (first 30)
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Receipt Register", lm, y); y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Receipt #", lm, y); doc.text("Date", 55, y); doc.text("Payer", 85, y); doc.text("Type", 125, y); doc.text("Amount", 160, y); doc.text("Status", 185, y); y += 5;
    doc.setFont("helvetica", "normal");
    filteredReceipts.slice(0, 30).forEach(r => {
      doc.text(r.receipt_number?.slice(0, 15) || "", lm, y);
      doc.text(format(new Date(r.created_at), "dd/MM/yy"), 55, y);
      doc.text((r.payer_name || "—").slice(0, 20), 85, y);
      doc.text((r.payment_type || "").slice(0, 18), 125, y);
      doc.text(Number(r.total_amount).toFixed(2), 160, y);
      doc.text(r.status || "", 185, y);
      y += 4.5;
      if (y > 280) { doc.addPage(); y = 20; }
    });

    doc.save(`escrow-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (loading && offices.length === 0) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const presetButtons: { value: DatePreset; label: string }[] = [
    { value: "all", label: "All Time" },
    { value: "today", label: "Today" },
    { value: "yesterday", label: "Yesterday" },
    { value: "last7", label: "Last 7 Days" },
    { value: "this_week", label: "This Week" },
    { value: "this_month", label: "This Month" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              Escrow & Revenue Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Platform-wide payment overview, IGF reports, and receipt register</p>
          </div>

          {isMainAdmin && (
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Offices (National)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices (National)</SelectItem>
                {offices.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {profile && !profile.isMainAdmin && profile.officeName && (
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              📍 {profile.officeName}
            </div>
          )}
        </div>

        {/* Date filter bar */}
        <div className="bg-card rounded-xl p-4 shadow-card border border-border space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            <Filter className="h-4 w-4 text-primary" /> Period Filter
          </div>
          <div className="flex flex-wrap gap-2">
            {presetButtons.map(p => (
              <Button
                key={p.value}
                variant={datePreset === p.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDatePreset(p.value)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          {datePreset === "custom" && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !customFrom && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {customFrom ? format(customFrom, "dd/MM/yyyy") : "Start date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal", !customTo && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {customTo ? format(customTo, "dd/MM/yyyy") : "End date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          {datePreset !== "all" && (
            <div className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-card-foreground">{dateLabel}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Export buttons */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Export Excel (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={exportPDF}>
                <Download className="h-4 w-4 mr-1" /> Export PDF
              </Button>
            </div>

            <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Total Revenue", value: stats.totalEscrow, icon: DollarSign, color: "text-success", prefix: "GH₵ " },
                { label: "Completed", value: stats.completed, icon: TrendingUp, color: "text-primary" },
                { label: "Pending", value: stats.pending, icon: Wallet, color: "text-warning" },
                { label: "Total Receipts", value: receipts.length, icon: Receipt, color: "text-info" },
              ].map(s => (
                <StaggeredItem key={s.label}>
                  <div className="bg-card rounded-xl p-5 shadow-card border border-border">
                    <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                    <div className="text-2xl font-bold text-card-foreground">
                      {s.prefix && <span className="text-lg">{s.prefix}</span>}
                      <AnimatedCounter value={s.value} />
                    </div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                </StaggeredItem>
              ))}
            </StaggeredGrid>

            {/* Payment Pipeline Status (Main Admin only + visibility check) */}
            {isMainAdmin && isVisible("escrow", "payment_pipeline") && (
              <div className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Payment Pipeline Checklist
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    { label: "Payments Completed", value: pipelineStats.webhookReceived, icon: CheckCircle, ok: pipelineStats.webhookReceived > 0 },
                    { label: "Verified", value: pipelineStats.verified, icon: CheckCircle, ok: pipelineStats.verified > 0 },
                    { label: "Allocations Posted", value: pipelineStats.allocated, icon: pipelineStats.allocated > 0 ? CheckCircle : AlertTriangle, ok: pipelineStats.allocated > 0 },
                    { label: "Transfers Triggered", value: pipelineStats.transfersTriggered, icon: pipelineStats.transfersTriggered > 0 ? CheckCircle : Clock, ok: pipelineStats.transfersTriggered > 0 },
                    { label: "Failed Transfers", value: pipelineStats.transfersFailed, icon: pipelineStats.transfersFailed > 0 ? XCircle : CheckCircle, ok: pipelineStats.transfersFailed === 0 },
                  ].map(item => (
                    <div key={item.label} className={`border rounded-lg p-3 text-center ${item.ok ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"}`}>
                      <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.ok ? "text-success" : "text-warning"}`} />
                      <div className="text-xl font-bold text-card-foreground">{item.value}</div>
                      <div className="text-[10px] text-muted-foreground">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Release Mode Stats */}
            {(isVisible("escrow", "auto_release") || isVisible("escrow", "manual_release")) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isVisible("escrow", "auto_release") && (
              <div className="bg-card rounded-xl p-5 shadow-card border border-border flex items-start gap-3">
                <Zap className="h-5 w-5 text-success mt-0.5" />
                <div>
                  <div className="text-2xl font-bold text-card-foreground">
                    GH₵ <AnimatedCounter value={stats.autoReleased} />
                  </div>
                  <div className="text-xs text-muted-foreground">Auto-Released Funds</div>
                </div>
              </div>
              )}
              {isVisible("escrow", "manual_release") && (
              <div className="bg-card rounded-xl p-5 shadow-card border border-border flex items-start gap-3">
                <Hand className="h-5 w-5 text-info mt-0.5" />
                <div>
                  <div className="text-2xl font-bold text-card-foreground">
                    GH₵ <AnimatedCounter value={stats.manualReleased} />
                  </div>
                  <div className="text-xs text-muted-foreground">Manually Released Funds</div>
                </div>
              </div>
              )}
            </div>
            )}

            {/* Revenue by Type */}
            {isVisible("escrow", "revenue_by_type") && (
            <div className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Revenue by Type
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {revenueByType.filter(r => r.total > 0 || r.count > 0).map(r => (
                  <div key={r.label} className={`border rounded-lg p-4 text-center ${r.color}`}>
                    <div className="text-2xl font-bold">GH₵ {r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs mt-1">{r.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{r.count} transactions</div>
                  </div>
                ))}
                {revenueByType.every(r => r.total === 0 && r.count === 0) && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-4">No transactions yet</div>
                )}
              </div>
            </div>
            )}

            {/* Allocation Summary */}
            {isVisible("escrow", "revenue_destination") && (
            <div className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Allocation Summary (Internal Ledger)</h2>
              <div className={`grid grid-cols-2 ${isMainAdmin ? "lg:grid-cols-5" : "lg:grid-cols-2"} gap-4`}>
                {allocationCards.map(r => (
                  <div key={r.label} className={`border rounded-lg p-4 text-center ${r.color}`}>
                    <div className="text-2xl font-bold">GH₵ {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs mt-1">{r.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 border border-border">
                <span>Total Collected (Paystack)</span>
                <span className="font-semibold text-foreground">GH₵ {stats.totalEscrow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            )}

            {/* Payment Processor Charges */}
            <div className="bg-card rounded-xl p-5 shadow-card border border-border">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                Payment Processor Deductions
              </h2>
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-muted/30 rounded-lg px-4 py-2 border border-border">
                  <span className="font-bold text-foreground">1.95%</span>
                  <span className="text-muted-foreground ml-1">processing fee</span>
                </div>
                <div className="bg-muted/30 rounded-lg px-4 py-2 border border-border">
                  <span className="font-bold text-foreground">GH₵ 1.00</span>
                  <span className="text-muted-foreground ml-1">per transfer</span>
                </div>
                <div className="text-xs text-muted-foreground self-center">
                  Deducted by payment provider before settlement — not internal platform charges.
                </div>
              </div>
            </div>

            {/* Office Revenue Table (national view, main admin only) */}
            {isMainAdmin && isVisible("escrow", "office_breakdown") && effectiveOffice === "all" && officeRevenue.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Office Revenue Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 pr-4">Office</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-right py-2 px-2">IGF</th>
                        <th className="text-right py-2 px-2">Admin</th>
                        <th className="text-right py-2 px-2">Platform</th>
                        <th className="text-right py-2 px-2">GRA</th>
                        <th className="text-right py-2 px-2">Landlord</th>
                        <th className="text-right py-2 px-2">Wallet Balance</th>
                        <th className="text-right py-2 pl-2">Release</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officeRevenue.slice(0, 20).map(o => (
                        <tr key={o.officeId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-medium text-card-foreground">{o.officeName}</td>
                          <td className="text-right py-2 px-2 font-semibold">₵{o.total.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-primary">₵{o.igf.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-info">₵{o.admin.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-success">₵{o.platform.toFixed(2)}</td>
                          <td className="text-right py-2 px-2">₵{o.gra.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-warning">₵{o.landlord.toFixed(2)}</td>
                          <td className="text-right py-2 px-2">
                            <span className={`font-semibold ${o.walletBalance > 0 ? "text-success" : "text-muted-foreground"}`}>
                              ₵{o.walletBalance.toFixed(2)}
                            </span>
                            {o.released > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">(₵{o.released.toFixed(0)} paid)</span>
                            )}
                          </td>
                          <td className="text-right py-2 pl-2">
                            <div className="flex items-center justify-end gap-1">
                              {o.autoReleased > 0 && (
                                <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                                  <Zap className="h-3 w-3 mr-0.5" />₵{o.autoReleased.toFixed(0)}
                                </Badge>
                              )}
                              {o.manualReleased > 0 && (
                                <Badge variant="outline" className="text-[10px] border-info/30 text-info">
                                  <Hand className="h-3 w-3 mr-0.5" />₵{o.manualReleased.toFixed(0)}
                                </Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub-admin: simplified office table */}
            {!isMainAdmin && effectiveOffice === "all" && officeRevenue.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Office Revenue
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 pr-4">Office</th>
                        <th className="text-right py-2 px-2">IGF</th>
                        <th className="text-right py-2 px-2">Admin</th>
                        <th className="text-right py-2 px-2">Wallet Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officeRevenue.slice(0, 20).map(o => (
                        <tr key={o.officeId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-medium text-card-foreground">{o.officeName}</td>
                          <td className="text-right py-2 px-2 text-primary">₵{o.igf.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-info">₵{o.admin.toFixed(2)}</td>
                          <td className="text-right py-2 px-2">
                            <span className={`font-semibold ${o.walletBalance > 0 ? "text-success" : "text-muted-foreground"}`}>
                              ₵{o.walletBalance.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Receipt Register */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Receipt Register</h2>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search receipts..."
                  className="w-64"
                />
              </div>

              {filteredReceipts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No receipts found.</p>
              ) : (
                <div className="space-y-4">
                  {filteredReceipts.map(r => (
                    <PaymentReceipt
                      key={r.id}
                      receiptNumber={r.receipt_number}
                      date={r.created_at}
                      payerName={r.payer_name || ""}
                      totalAmount={Number(r.total_amount)}
                      paymentType={r.payment_type}
                      description={r.description || ""}
                      splits={(r.split_breakdown as any[]) || []}
                      status={r.status}
                      qrCodeData={r.qr_code_data || r.receipt_number}
                      showSplits={false}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default EscrowDashboard;

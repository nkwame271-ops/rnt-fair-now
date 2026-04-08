import { useState, useEffect, useMemo } from "react";
import { FileText, Download, CalendarIcon, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth } from "date-fns";
import jsPDF from "jspdf";

type DatePreset = "all" | "today" | "yesterday" | "last7" | "this_week" | "this_month" | "custom";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "All" },
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last7", label: "Last 7 Days" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom" },
];

function getPresetRange(preset: DatePreset): { from: Date | null; to: Date | null } {
  const now = new Date();
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = subDays(now, 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "last7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "this_week":
      return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfDay(now) };
    case "this_month":
      return { from: startOfMonth(now), to: endOfDay(now) };
    default:
      return { from: null, to: null };
  }
}

interface Batch {
  id: string;
  batch_label: string;
  prefix: string;
  regions: string[];
  region_details: any[];
  total_unique_serials: number;
  total_physical_cards: number;
  paired_mode: boolean;
  created_at: string;
}

const ProcurementReport = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const effectiveRange = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom ? startOfDay(customFrom) : null,
        to: customTo ? endOfDay(customTo) : null,
      };
    }
    return getPresetRange(datePreset);
  }, [datePreset, customFrom, customTo]);

  const fetchBatches = async () => {
    setLoading(true);
    let query = supabase
      .from("generation_batches" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (effectiveRange.from) {
      query = query.gte("created_at", effectiveRange.from.toISOString());
    }
    if (effectiveRange.to) {
      query = query.lte("created_at", effectiveRange.to.toISOString());
    }

    const { data } = await query;
    setBatches((data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const rangeLabel = useMemo(() => {
    if (datePreset === "all") return "All Time";
    const { from, to } = effectiveRange;
    if (from && to) return `${format(from, "dd/MM/yyyy")} – ${format(to, "dd/MM/yyyy")}`;
    if (from) return `From ${format(from, "dd/MM/yyyy")}`;
    if (to) return `Up to ${format(to, "dd/MM/yyyy")}`;
    return "All Time";
  }, [datePreset, effectiveRange]);

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Procurement Report — Generation Batches", 14, 20);
    doc.setFontSize(9);
    doc.text(`Period: ${rangeLabel}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);

    let y = 44;
    batches.forEach((b, idx) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFontSize(10);
      doc.text(`${idx + 1}. ${b.batch_label}`, 14, y);
      doc.setFontSize(8);
      y += 5;
      doc.text(`Prefix: ${b.prefix} | Mode: ${b.paired_mode ? "Paired" : "Single"} | Date: ${new Date(b.created_at).toLocaleDateString()}`, 18, y);
      y += 4;
      doc.text(`Regions: ${b.regions?.join(", ") || "N/A"}`, 18, y);
      y += 4;
      doc.text(`Unique Serials: ${b.total_unique_serials} | Physical Cards: ${b.total_physical_cards}`, 18, y);
      y += 7;
    });

    doc.save(`procurement-report-${Date.now()}.pdf`);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Procurement Report
        </h2>
        {batches.length > 0 && (
          <Button variant="outline" size="sm" onClick={downloadPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        )}
      </div>

      {/* Date filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.value}
            variant={datePreset === p.value ? "default" : "outline"}
            size="sm"
            onClick={() => setDatePreset(p.value)}
            className="text-xs"
          >
            {p.label}
          </Button>
        ))}
      </div>

      {datePreset === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {customFrom ? format(customFrom, "dd/MM/yyyy") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} />
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs gap-1">
                <CalendarIcon className="h-3 w-3" />
                {customTo ? format(customTo, "dd/MM/yyyy") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={customTo} onSelect={setCustomTo} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={fetchBatches} disabled={loading}>
        <Search className="h-4 w-4 mr-1" /> Search
      </Button>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No generation batches found for this period.</p>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground border-b border-border bg-muted/50">
                <th className="text-left px-3 py-2">Batch</th>
                <th className="text-left px-3 py-2">Prefix</th>
                <th className="text-left px-3 py-2">Regions</th>
                <th className="text-right px-3 py-2">Unique</th>
                <th className="text-right px-3 py-2">Cards</th>
                <th className="text-left px-3 py-2">Mode</th>
                <th className="text-left px-3 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {batches.map(b => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-medium text-card-foreground">{b.batch_label}</td>
                  <td className="px-3 py-2 font-mono">{b.prefix}</td>
                  <td className="px-3 py-2">
                    {b.regions?.slice(0, 3).map(r => (
                      <Badge key={r} variant="outline" className="text-[10px] mr-1">{r}</Badge>
                    ))}
                    {(b.regions?.length || 0) > 3 && (
                      <Badge variant="secondary" className="text-[10px]">+{b.regions.length - 3}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-bold">{b.total_unique_serials.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{b.total_physical_cards.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Badge variant={b.paired_mode ? "default" : "secondary"} className="text-[10px]">
                      {b.paired_mode ? "Paired" : "Single"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ProcurementReport;

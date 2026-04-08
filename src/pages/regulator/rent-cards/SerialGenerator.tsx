import { useState, useMemo, useEffect } from "react";
import { Wand2, Eye, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import jsPDF from "jspdf";

interface RegionCode {
  region: string;
  code: string;
}

interface RegionEntry {
  region: string;
  code: string;
  start: number;
  end: number;
  selected: boolean;
}

interface Props {
  onStockChanged: () => void;
}

const SerialGenerator = ({ onStockChanged }: Props) => {
  const [prefix, setPrefix] = useState("RCD-2026-");
  const [padLength, setPadLength] = useState(4);
  const [batchLabel, setBatchLabel] = useState("");
  const [pairedMode, setPairedMode] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regionCodes, setRegionCodes] = useState<RegionCode[]>([]);
  const [regionEntries, setRegionEntries] = useState<RegionEntry[]>([]);
  const [lastBatchResult, setLastBatchResult] = useState<any>(null);

  // Fetch region codes
  useEffect(() => {
    const fetchCodes = async () => {
      const { data } = await supabase
        .from("region_codes" as any)
        .select("region, code")
        .order("region");
      const codes = (data || []) as any[];
      setRegionCodes(codes);

      // Initialize region entries
      setRegionEntries(
        GHANA_REGIONS.map(r => {
          const rc = codes.find((c: any) => c.region === r);
          return {
            region: r,
            code: rc?.code || r.substring(0, 3).toUpperCase(),
            start: 1,
            end: 100,
            selected: false,
          };
        })
      );
    };
    fetchCodes();
  }, []);

  const selectedEntries = regionEntries.filter(e => e.selected);
  const allSelected = regionEntries.length > 0 && regionEntries.every(e => e.selected);

  const toggleAll = () => {
    const newVal = !allSelected;
    setRegionEntries(prev => prev.map(e => ({ ...e, selected: newVal })));
  };

  const updateEntry = (region: string, field: string, value: any) => {
    setRegionEntries(prev =>
      prev.map(e => (e.region === region ? { ...e, [field]: value } : e))
    );
  };

  const summary = useMemo(() => {
    let totalUnique = 0;
    selectedEntries.forEach(e => {
      const qty = Math.max(0, e.end - e.start + 1);
      totalUnique += qty;
    });
    return {
      totalUnique,
      totalPhysical: pairedMode ? totalUnique * 2 : totalUnique,
      regionCount: selectedEntries.length,
    };
  }, [selectedEntries, pairedMode]);

  const canGenerate = selectedEntries.length > 0 && prefix.trim() && summary.totalUnique > 0 && summary.totalUnique <= 50000;

  const handleGenerate = () => {
    if (!canGenerate) {
      toast.error("Please select regions and fill in all required fields");
      return;
    }
    setShowPasswordDialog(true);
  };

  const handleConfirm = async (password: string, reason: string) => {
    setGenerating(true);
    try {
      const regions = selectedEntries.map(e => ({
        region: e.region,
        code: e.code,
        start_range: e.start,
        end_range: e.end,
      }));

      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: {
          action: "generate_serials_multi",
          target_id: batchLabel || `MGEN-${Date.now()}`,
          reason,
          password,
          extra: {
            prefix,
            pad_length: padLength,
            regions,
            batch_label: batchLabel || `MGEN-${prefix}${Date.now()}`,
            paired_mode: pairedMode,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setLastBatchResult(data?.new_state);
      toast.success(`Generated ${data?.new_state?.total_unique || summary.totalUnique} unique serials across ${selectedEntries.length} region(s)!`);
      onStockChanged();
      setShowPreview(false);
    } catch (err: any) {
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Serial Generation Report", 14, 20);
    doc.setFontSize(10);
    doc.text(`Batch: ${batchLabel || "N/A"}`, 14, 30);
    doc.text(`Prefix: ${prefix}`, 14, 36);
    doc.text(`Mode: ${pairedMode ? "Paired" : "Single"}`, 14, 42);
    doc.text(`Date: ${new Date().toLocaleString()}`, 14, 48);

    let y = 60;
    doc.setFontSize(9);
    doc.text("Region", 14, y);
    doc.text("Code", 60, y);
    doc.text("Start", 80, y);
    doc.text("End", 100, y);
    doc.text("Qty", 120, y);
    doc.text("Sample", 140, y);
    y += 6;

    selectedEntries.forEach(e => {
      const qty = Math.max(0, e.end - e.start + 1);
      doc.text(e.region, 14, y);
      doc.text(e.code, 60, y);
      doc.text(String(e.start), 80, y);
      doc.text(String(e.end), 100, y);
      doc.text(String(qty), 120, y);
      doc.text(`${prefix}${e.code}-${String(e.start).padStart(padLength, "0")}`, 140, y);
      y += 5;
      if (y > 280) { doc.addPage(); y = 20; }
    });

    y += 6;
    doc.setFontSize(10);
    doc.text(`Total Unique Serials: ${summary.totalUnique}`, 14, y);
    doc.text(`Total Physical Cards: ${summary.totalPhysical}`, 14, y + 6);

    doc.save(`serial-generation-${batchLabel || Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" /> Multi-Region Serial Generator
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate sequential serial numbers across multiple regions in a single batch.
        </p>

        {/* Paired Mode */}
        <div className="flex items-center gap-3 bg-primary/5 rounded-lg p-4 border border-primary/20">
          <Switch checked={pairedMode} onCheckedChange={setPairedMode} />
          <div>
            <p className="text-sm font-medium text-card-foreground">Generate in Pairs</p>
            <p className="text-xs text-muted-foreground">
              {pairedMode
                ? "Each serial duplicated (Landlord + Tenant Copy). 1 serial = 2 physical cards."
                : "Each serial generated once only."}
            </p>
          </div>
        </div>

        {/* Format Settings */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Prefix / Format</Label>
            <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="RCD-2026-" />
          </div>
          <div className="space-y-2">
            <Label>Zero Padding</Label>
            <Input type="number" min={1} max={10} value={padLength} onChange={e => setPadLength(parseInt(e.target.value) || 4)} />
          </div>
          <div className="space-y-2">
            <Label>Batch Label (optional)</Label>
            <Input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="e.g. Batch-Q1-2026" />
          </div>
        </div>

        {/* Region Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Select Regions</Label>
            <Button variant="ghost" size="sm" onClick={toggleAll}>
              <Check className="h-3.5 w-3.5 mr-1" />
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
              <span />
              <span>Region</span>
              <span>Code</span>
              <span>Start</span>
              <span>End</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border">
              {regionEntries.map(entry => (
                <div
                  key={entry.region}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 items-center px-4 py-2.5 ${entry.selected ? "bg-primary/5" : ""}`}
                >
                  <Checkbox
                    checked={entry.selected}
                    onCheckedChange={v => updateEntry(entry.region, "selected", !!v)}
                  />
                  <span className="text-sm text-card-foreground">{entry.region}</span>
                  <Badge variant="outline" className="font-mono text-xs">{entry.code}</Badge>
                  {entry.selected ? (
                    <>
                      <Input
                        type="number"
                        min={1}
                        className="w-20 h-8 text-xs"
                        value={entry.start}
                        onChange={e => updateEntry(entry.region, "start", parseInt(e.target.value) || 1)}
                      />
                      <Input
                        type="number"
                        min={1}
                        className="w-20 h-8 text-xs"
                        value={entry.end}
                        onChange={e => updateEntry(entry.region, "end", parseInt(e.target.value) || 1)}
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground">—</span>
                      <span className="text-xs text-muted-foreground">—</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Summary */}
        {selectedEntries.length > 0 && (
          <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-2">
            <p className="text-sm font-medium text-card-foreground">Generation Summary</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-2xl font-bold text-primary">{selectedEntries.length}</p>
                <p className="text-xs text-muted-foreground">Region(s)</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{summary.totalUnique.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Unique Serials</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{summary.totalPhysical.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Physical Cards</p>
              </div>
            </div>
            {summary.totalUnique > 50000 && (
              <p className="text-sm text-destructive font-medium">Maximum 50,000 serials per batch</p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)} disabled={selectedEntries.length === 0}>
            <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
            <Wand2 className="h-4 w-4 mr-1" />
            {generating ? "Generating..." : `Generate ${summary.totalUnique.toLocaleString()} Serial(s)`}
          </Button>
          {selectedEntries.length > 0 && (
            <Button variant="outline" onClick={downloadPdf}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
          )}
        </div>

        {/* Preview Table */}
        {showPreview && selectedEntries.length > 0 && (() => {
          const allSerials: { serial: string; region: string; copies: number }[] = [];
          selectedEntries.forEach(e => {
            for (let i = e.start; i <= e.end; i++) {
              allSerials.push({
                serial: `${prefix}${e.code}-${String(i).padStart(padLength, "0")}`,
                region: e.region,
                copies: pairedMode ? 2 : 1,
              });
            }
          });
          return (
            <div className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">
                  Showing {allSerials.length.toLocaleString()} serial(s) ({(allSerials.length * (pairedMode ? 2 : 1)).toLocaleString()} physical cards)
                </p>
                <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>Close</Button>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-muted-foreground border-b border-border">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Serial Number</th>
                      <th className="text-left py-1">Region</th>
                      <th className="text-left py-1">Copies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSerials.map((s, idx) => (
                      <tr key={s.serial} className="border-b border-border/50">
                        <td className="py-1 text-muted-foreground">{idx + 1}</td>
                        <td className="py-1 font-mono">{s.serial}</td>
                        <td className="py-1">{s.region}</td>
                        <td className="py-1">
                          <Badge variant={s.copies === 2 ? "default" : "secondary"} className="text-[10px]">
                            {s.copies === 2 ? "2 (Paired)" : "1 (Single)"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      <AdminPasswordConfirm
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        title="Confirm Multi-Region Serial Generation"
        description={`You are about to generate ${summary.totalUnique.toLocaleString()} unique serial(s) across ${selectedEntries.length} region(s) (${summary.totalPhysical.toLocaleString()} physical cards). This action will be logged.`}
        actionLabel="Generate Serials"
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default SerialGenerator;

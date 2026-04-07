import { useState } from "react";
import { Upload, FileUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS, getOfficesForRegion } from "@/hooks/useAdminProfile";

interface Props {
  onStockChanged: () => void;
}

const parseSerials = (text: string): string[] => {
  const lines = text.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  const serials: string[] = [];
  for (const line of lines) {
    const rangeMatch = line.match(/^(.+?)(\d+)\s*(?:to|-)\s*\1(\d+)$/i);
    if (rangeMatch) {
      const prefix = rangeMatch[1];
      const start = parseInt(rangeMatch[2]);
      const end = parseInt(rangeMatch[3]);
      const padLen = rangeMatch[2].length;
      for (let i = start; i <= end; i++) {
        serials.push(prefix + String(i).padStart(padLen, "0"));
      }
    } else {
      serials.push(line);
    }
  }
  return serials;
};

const SerialBatchUpload = ({ onStockChanged }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [targetOfficeId, setTargetOfficeId] = useState("");
  const [assignToRegion, setAssignToRegion] = useState(false);
  const [serialInput, setSerialInput] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const targetOffice = regionOffices.find(o => o.id === targetOfficeId);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\n\r]+/).map(l => l.split(",")[0]?.trim()).filter(Boolean);
      const start = lines[0]?.toLowerCase().includes("serial") ? 1 : 0;
      setSerialInput(lines.slice(start).join("\n"));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handlePreview = () => {
    const parsed = parseSerials(serialInput);
    if (parsed.length === 0) {
      toast.error("No valid serials found");
      return;
    }
    setPreview(parsed);
  };

  const handleUpload = async () => {
    const officeName = assignToRegion ? (regionOffices[0]?.name || selectedRegion) : targetOffice?.name;
    if (!officeName && !assignToRegion) { toast.error("Select a target office or region"); return; }
    const serials = preview || parseSerials(serialInput);
    if (serials.length === 0) { toast.error("No serials to upload"); return; }

    setUploading(true);
    try {
      // 1. Delete ALL revoked rows matching incoming serials FIRST
      for (let i = 0; i < serials.length; i += 100) {
        const batch = serials.slice(i, i + 100);
        await supabase
          .from("rent_card_serial_stock")
          .delete()
          .in("serial_number", batch)
          .eq("status", "revoked");
      }

      // 2. Check which serials still exist (available/assigned)
      const existingSet = new Set<string>();
      for (let i = 0; i < serials.length; i += 100) {
        const batch = serials.slice(i, i + 100);
        const { data } = await supabase
          .from("rent_card_serial_stock")
          .select("serial_number")
          .in("serial_number", batch);
        if (data) data.forEach((r: any) => existingSet.add(r.serial_number));
      }

      // 3. Filter to new serials and insert
      const newSerials = serials.filter(s => !existingSet.has(s));
      const skippedCount = serials.length - newSerials.length;

      if (newSerials.length === 0) {
        toast.warning(`All ${serials.length} serial(s) already exist in stock. Nothing uploaded.`);
        setUploading(false);
        return;
      }

      const rows = newSerials.map(s => ({
        serial_number: s,
        office_name: assignToRegion ? regionOffices[0]?.name || selectedRegion : officeName!,
        status: "available" as const,
        batch_label: batchLabel || null,
        region: assignToRegion ? selectedRegion : null,
        pair_index: 1,
      }));

      const { error } = await supabase.from("rent_card_serial_stock").insert(rows);
      if (error) throw error;

      // Create generation_batches record so it appears in Procurement Report
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        await supabase.from("generation_batches" as any).insert({
          batch_label: batchLabel || `Upload-${Date.now()}`,
          prefix: "UPLOAD",
          regions: [selectedRegion],
          region_details: [{ region: selectedRegion, generated: newSerials.length, skipped: skippedCount }],
          total_unique_serials: newSerials.length,
          total_physical_cards: newSerials.length,
          paired_mode: false,
          generated_by: authUser.id,
        });
      }

      const targetLabel = assignToRegion ? `${selectedRegion} region` : officeName;
      const msg = skippedCount > 0
        ? `${newSerials.length} new serial(s) added to ${targetLabel}. ${skippedCount} duplicate(s) skipped.`
        : `${newSerials.length} serial(s) added to ${targetLabel}`;
      toast.success(msg);
      setSerialInput("");
      setBatchLabel("");
      setPreview(null);
      onStockChanged();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  const isReady = serialInput.trim() && selectedRegion && (assignToRegion || targetOfficeId);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> Serial Batch Upload
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload serial numbers in bulk and assign them to an office or region. Paste directly, use ranges, or upload a CSV file.
        </p>

        {/* Region → Office Selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setTargetOfficeId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
              <SelectContent>
                {GHANA_REGIONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedRegion && !assignToRegion && (
            <div className="space-y-2">
              <Label>Target Office</Label>
              <Select value={targetOfficeId} onValueChange={setTargetOfficeId}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {regionOffices.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {selectedRegion && (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
            <Switch
              checked={assignToRegion}
              onCheckedChange={v => { setAssignToRegion(v); if (v) setTargetOfficeId(""); }}
            />
            <div>
              <p className="text-sm font-medium text-card-foreground">Assign to entire region</p>
              <p className="text-xs text-muted-foreground">
                All {regionOffices.length} office(s) in {selectedRegion} will have access to these serials.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Batch Label (optional)</Label>
          <Input
            placeholder="e.g. Batch 2026-Q1"
            value={batchLabel}
            onChange={e => setBatchLabel(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Serial Numbers</Label>
          <p className="text-xs text-muted-foreground">
            One per line or comma-separated. Ranges supported: <code>RC-001 to RC-050</code>
          </p>
          <Textarea
            rows={5}
            placeholder="RC-20260319-0001, RC-20260319-0002&#10;or RC-20260319-0001 to RC-20260319-0100"
            value={serialInput}
            onChange={e => setSerialInput(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <Label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-accent text-sm font-medium">
            <FileUp className="h-4 w-4" /> Import CSV
          </Label>
          <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={handleCSVUpload} />

          <Button variant="outline" onClick={handlePreview} disabled={!serialInput.trim()}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>

          <Button onClick={handleUpload} disabled={uploading || !isReady}>
            <Upload className="h-4 w-4 mr-1" />
            {uploading ? "Uploading..." : "Upload to Stock"}
          </Button>
        </div>

        {preview && (
          <div className="border border-border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-card-foreground">Preview — {preview.length} serial(s)</p>
              <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Close</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.slice(0, 100).map(s => (
                <Badge key={s} variant="outline" className="font-mono text-xs">{s}</Badge>
              ))}
              {preview.length > 100 && (
                <Badge variant="secondary" className="text-xs">+{preview.length - 100} more</Badge>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SerialBatchUpload;

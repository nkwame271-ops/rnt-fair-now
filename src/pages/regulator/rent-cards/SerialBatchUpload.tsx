import { useState } from "react";
import { Upload, FileUp, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_OFFICES } from "@/hooks/useAdminProfile";

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
  const [targetOfficeId, setTargetOfficeId] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [batchLabel, setBatchLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string[] | null>(null);

  const targetOffice = GHANA_OFFICES.find(o => o.id === targetOfficeId);

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/[\n\r]+/).map(l => l.split(",")[0]?.trim()).filter(Boolean);
      // Skip header if it looks like one
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
    if (!targetOffice) { toast.error("Select a target office"); return; }
    const serials = preview || parseSerials(serialInput);
    if (serials.length === 0) { toast.error("No serials to upload"); return; }

    setUploading(true);
    try {
      const rows = serials.map(s => ({
        serial_number: s,
        office_name: targetOffice.name,
        status: "available",
        batch_label: batchLabel || null,
      }));

      const { error } = await supabase.from("rent_card_serial_stock" as any).insert(rows);
      if (error) throw error;

      toast.success(`${serials.length} serial(s) added to ${targetOffice.name}`);
      setSerialInput("");
      setBatchLabel("");
      setPreview(null);
      onStockChanged();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" /> Serial Batch Upload
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload serial numbers in bulk and assign them to an office. Paste directly, use ranges, or upload a CSV file.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Target Office</Label>
            <Select value={targetOfficeId} onValueChange={setTargetOfficeId}>
              <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
              <SelectContent>
                {GHANA_OFFICES.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Batch Label (optional)</Label>
            <Input
              placeholder="e.g. Batch 2026-Q1"
              value={batchLabel}
              onChange={e => setBatchLabel(e.target.value)}
            />
          </div>
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

          <Button onClick={handleUpload} disabled={uploading || !targetOfficeId || !serialInput.trim()}>
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

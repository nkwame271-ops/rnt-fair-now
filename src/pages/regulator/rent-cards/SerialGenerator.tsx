import { useState, useMemo } from "react";
import { Wand2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS, getOfficesForRegion } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

interface Props {
  onStockChanged: () => void;
}

const SerialGenerator = ({ onStockChanged }: Props) => {
  const [prefix, setPrefix] = useState("RCD-2026-");
  const [startRange, setStartRange] = useState(1);
  const [endRange, setEndRange] = useState(100);
  const [padLength, setPadLength] = useState(4);
  const [batchLabel, setBatchLabel] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState("");
  const [assignToRegion, setAssignToRegion] = useState(false);
  const [pairedMode, setPairedMode] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [generating, setGenerating] = useState(false);

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);

  const rawQuantity = useMemo(() => Math.max(0, endRange - startRange + 1), [startRange, endRange]);
  const uniqueSerials = pairedMode ? rawQuantity : rawQuantity;
  const physicalCards = pairedMode ? rawQuantity * 2 : rawQuantity;

  const generatedSerials = useMemo(() => {
    if (rawQuantity <= 0 || rawQuantity > 10000) return [];
    const serials: string[] = [];
    for (let i = startRange; i <= endRange; i++) {
      serials.push(prefix + String(i).padStart(padLength, "0"));
    }
    return serials;
  }, [prefix, startRange, endRange, padLength, rawQuantity]);

  // Preview with pairing
  const previewSerials = useMemo(() => {
    if (!pairedMode) return generatedSerials;
    const paired: string[] = [];
    for (const s of generatedSerials) {
      paired.push(s, s);
    }
    return paired;
  }, [generatedSerials, pairedMode]);

  const canGenerate = rawQuantity > 0 && rawQuantity <= 10000 && prefix.trim() && selectedRegion && (assignToRegion || selectedOfficeId);

  const handleGenerate = () => {
    if (!canGenerate) {
      toast.error("Please fill in all required fields");
      return;
    }
    setShowPasswordDialog(true);
  };

  const handleConfirm = async (password: string, reason: string) => {
    setGenerating(true);
    try {
      const officeName = assignToRegion
        ? (regionOffices[0]?.name || selectedRegion)
        : (selectedOffice?.name || "");

      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: {
          action: "generate_serials",
          target_id: batchLabel || `GEN-${Date.now()}`,
          reason,
          password,
          extra: {
            prefix,
            start_range: startRange,
            end_range: endRange,
            pad_length: padLength,
            office_name: assignToRegion ? regionOffices[0]?.name || selectedRegion : officeName,
            region: assignToRegion ? selectedRegion : null,
            batch_label: batchLabel || `GEN-${prefix}${startRange}-${endRange}`,
            paired_mode: pairedMode,
          },
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`${pairedMode ? uniqueSerials + " unique serial(s) × 2 = " + physicalCards + " physical cards" : rawQuantity + " serial(s)"} generated and added to stock!`);
      onStockChanged();
      setShowPreview(false);
    } catch (err: any) {
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" /> Serial Number Generator
        </h2>
        <p className="text-sm text-muted-foreground">
          Generate sequential serial numbers with a custom format and assign them to an office or entire region.
        </p>

        {/* Paired Mode Toggle */}
        <div className="flex items-center gap-3 bg-primary/5 rounded-lg p-4 border border-primary/20">
          <Switch
            checked={pairedMode}
            onCheckedChange={setPairedMode}
          />
          <div>
            <p className="text-sm font-medium text-card-foreground">Generate in Pairs</p>
            <p className="text-xs text-muted-foreground">
              {pairedMode
                ? "Each serial number is duplicated (Landlord Copy + Tenant Copy). 1 serial = 2 physical cards."
                : "Each serial number is generated once only. No duplication."}
            </p>
          </div>
        </div>

        {/* Format Settings */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Prefix / Format</Label>
            <Input
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              placeholder="RCD-2026-"
            />
          </div>
          <div className="space-y-2">
            <Label>Start Number</Label>
            <Input
              type="number"
              min={1}
              value={startRange}
              onChange={e => setStartRange(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Number</Label>
            <Input
              type="number"
              min={1}
              value={endRange}
              onChange={e => setEndRange(parseInt(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-2">
            <Label>Zero Padding</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={padLength}
              onChange={e => setPadLength(parseInt(e.target.value) || 4)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Batch Label (optional)</Label>
            <Input
              value={batchLabel}
              onChange={e => setBatchLabel(e.target.value)}
              placeholder="e.g. Batch-Q1-2026"
            />
          </div>
          <div className="flex items-center justify-between gap-4 bg-muted/30 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-card-foreground">
                {pairedMode ? "Rent Card Pairs" : "Quantity"}
              </p>
              {rawQuantity > 10000 ? (
                <p className="text-2xl font-bold text-destructive">Too large</p>
              ) : pairedMode ? (
                <div>
                  <p className="text-2xl font-bold text-primary">{uniqueSerials.toLocaleString()} pairs</p>
                  <p className="text-xs text-muted-foreground">{uniqueSerials.toLocaleString()} unique serials × 2 = {physicalCards.toLocaleString()} physical cards</p>
                </div>
              ) : (
                <p className="text-2xl font-bold text-primary">{rawQuantity.toLocaleString()}</p>
              )}
            </div>
            {rawQuantity > 0 && rawQuantity <= 10000 && (
              <div className="text-right text-xs text-muted-foreground font-mono">
                <p>{prefix}{String(startRange).padStart(padLength, "0")}</p>
                <p>to</p>
                <p>{prefix}{String(endRange).padStart(padLength, "0")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Region → Office Selection */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
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

          {selectedRegion && !assignToRegion && (
            <div className="space-y-2">
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
        </div>

        {selectedRegion && (
          <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
            <Switch
              checked={assignToRegion}
              onCheckedChange={v => { setAssignToRegion(v); if (v) setSelectedOfficeId(""); }}
            />
            <div>
              <p className="text-sm font-medium text-card-foreground">Assign to entire region</p>
              <p className="text-xs text-muted-foreground">
                All {regionOffices.length} office(s) in {selectedRegion} will have access to these serials.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)} disabled={rawQuantity <= 0 || rawQuantity > 10000}>
            <Eye className="h-4 w-4 mr-1" /> {showPreview ? "Hide Preview" : "Preview Serials"}
          </Button>
          <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
            <Wand2 className="h-4 w-4 mr-1" />
            {generating ? "Generating..." : pairedMode
              ? `Generate ${uniqueSerials.toLocaleString()} Pair(s) (${physicalCards.toLocaleString()} cards)`
              : `Generate ${rawQuantity.toLocaleString()} Serial(s)`}
          </Button>
        </div>

        {/* Preview */}
        {showPreview && previewSerials.length > 0 && (
          <div className="border border-border rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-card-foreground">
                Preview — {pairedMode ? `${generatedSerials.length} unique serial(s) × 2 = ${previewSerials.length} entries` : `${generatedSerials.length} serial(s)`}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setShowPreview(false)}>Close</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previewSerials.slice(0, 100).map((s, idx) => (
                <Badge key={`${s}-${idx}`} variant="outline" className="font-mono text-xs">{s}</Badge>
              ))}
              {previewSerials.length > 100 && (
                <Badge variant="secondary" className="text-xs">+{previewSerials.length - 100} more</Badge>
              )}
            </div>
          </div>
        )}
      </div>

      <AdminPasswordConfirm
        open={showPasswordDialog}
        onOpenChange={setShowPasswordDialog}
        title="Confirm Serial Generation"
        description={pairedMode
          ? `You are about to generate ${uniqueSerials.toLocaleString()} unique serial(s) in paired mode (${physicalCards.toLocaleString()} physical cards). This action will be logged.`
          : `You are about to generate ${rawQuantity.toLocaleString()} serial number(s) and add them to stock. This action will be logged.`}
        actionLabel="Generate Serials"
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default SerialGenerator;

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, Building2, Globe, MapPinned } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

type MoveTarget = "central" | "regional" | "office";

interface OfficeRow {
  region: string | null;
  office_name: string;
  office_id: string | null;
}

interface Props {
  onStockChanged?: () => void;
}

const expandSerials = (input: string): string[] => {
  const tokens = input.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  for (const tok of tokens) {
    const rangeMatch = tok.match(/^(\S+?)\s*(?:→|->|-|to)\s*(\S+)$/i);
    if (rangeMatch) {
      const [, a, b] = rangeMatch;
      const pm = a.match(/^(.*?)(\d+)$/);
      const qm = b.match(/^(.*?)(\d+)$/);
      if (pm && qm && pm[1] === qm[1]) {
        const start = parseInt(pm[2], 10);
        const end = parseInt(qm[2], 10);
        const pad = pm[2].length;
        const [lo, hi] = start <= end ? [start, end] : [end, start];
        if (hi - lo <= 2000) {
          for (let i = lo; i <= hi; i++) out.push(pm[1] + String(i).padStart(pad, "0"));
          continue;
        }
      }
    }
    out.push(tok);
  }
  return Array.from(new Set(out.map((s) => s.toUpperCase())));
};

const StockMovement = ({ onStockChanged }: Props) => {
  const [serialInput, setSerialInput] = useState("");
  const [targetKind, setTargetKind] = useState<MoveTarget>("regional");
  const [targetRegion, setTargetRegion] = useState<string>("");
  const [targetOffice, setTargetOffice] = useState<string>(""); // office_name
  const [regions, setRegions] = useState<string[]>([]);
  const [offices, setOffices] = useState<OfficeRow[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("region_codes" as any).select("region").order("region");
      const list = Array.from(new Set(((data as any[]) || []).map((r) => r.region).filter(Boolean)));
      setRegions(list);
    })();
  }, []);

  useEffect(() => {
    if (targetKind !== "office") return;
    setLoadingOffices(true);
    (async () => {
      // Distinct office_name + region from office_allocations (history) + current office stock
      const [{ data: alloc }, { data: stock }] = await Promise.all([
        supabase.from("office_allocations" as any).select("office_id, office_name, region"),
        supabase
          .from("rent_card_serial_stock" as any)
          .select("office_name, region")
          .eq("stock_type", "office")
          .neq("office_name", "")
          .limit(2000),
      ]);
      const map = new Map<string, OfficeRow>();
      ((alloc as any[]) || []).forEach((r) => {
        if (!r.office_name) return;
        const key = `${r.office_name}|${r.region || ""}`;
        if (!map.has(key)) map.set(key, { office_name: r.office_name, region: r.region, office_id: r.office_id });
      });
      ((stock as any[]) || []).forEach((r) => {
        if (!r.office_name) return;
        const key = `${r.office_name}|${r.region || ""}`;
        if (!map.has(key)) map.set(key, { office_name: r.office_name, region: r.region, office_id: null });
      });
      const list = Array.from(map.values()).sort((a, b) =>
        (a.region || "").localeCompare(b.region || "") || a.office_name.localeCompare(b.office_name)
      );
      setOffices(list);
      setLoadingOffices(false);
    })();
  }, [targetKind]);

  const parsed = useMemo(() => expandSerials(serialInput), [serialInput]);

  const canSubmit =
    parsed.length > 0 &&
    (targetKind === "central" ||
      (targetKind === "regional" && targetRegion) ||
      (targetKind === "office" && targetOffice));

  const handleConfirm = async (password: string, reason: string) => {
    const selectedOffice = offices.find((o) => o.office_name === targetOffice);
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: {
        action: "stock_move",
        target_id: parsed.length === 1 ? parsed[0] : `bulk:${parsed.length}`,
        password,
        reason,
        extra: {
          serials: parsed,
          target_kind: targetKind,
          target_region:
            targetKind === "regional" ? targetRegion : targetKind === "office" ? selectedOffice?.region ?? null : null,
          target_office_id: targetKind === "office" ? selectedOffice?.office_id ?? null : null,
          target_office_name: targetKind === "office" ? targetOffice : null,
        },
      },
    });

    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);

    const res = (data as any)?.result || {};
    const moved = (res.moved || []).length;
    const skipped = (res.skipped || []).length;
    toast.success(`Moved ${moved} serial(s)` + (skipped ? ` · ${skipped} skipped` : ""));
    if (skipped && res.skipped) {
      // Show first few skipped reasons
      res.skipped.slice(0, 5).forEach((s: any) => {
        toast.message(`${s.serial}: ${s.reason}`);
      });
    }
    setSerialInput("");
    onStockChanged?.();
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" /> Stock Movement
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Move available serials between <strong>Central Pool</strong>, <strong>Regional Pools</strong>, and{" "}
            <strong>Office stock</strong>. Only serials with status <code>available</code> can be moved. Assigned
            or revoked serials are skipped automatically.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Serials to move</Label>
          <Textarea
            rows={4}
            placeholder={"e.g. RC-0001\nRC-0010, RC-0011\nRC-0050 → RC-0099"}
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {parsed.length > 0 ? `${parsed.length} serial(s) parsed` : "Paste, comma-separate, or use ranges"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>Destination</Label>
            <Select value={targetKind} onValueChange={(v) => setTargetKind(v as MoveTarget)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="central">
                  <span className="inline-flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Central Pool</span>
                </SelectItem>
                <SelectItem value="regional">
                  <span className="inline-flex items-center gap-2"><MapPinned className="h-3.5 w-3.5" /> Regional Pool</span>
                </SelectItem>
                <SelectItem value="office">
                  <span className="inline-flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Office</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetKind === "regional" && (
            <div className="space-y-2 md:col-span-2">
              <Label>Region</Label>
              <Select value={targetRegion} onValueChange={setTargetRegion}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {regions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {targetKind === "office" && (
            <div className="space-y-2 md:col-span-2">
              <Label>Office</Label>
              <Select value={targetOffice} onValueChange={setTargetOffice} disabled={loadingOffices}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingOffices ? "Loading offices…" : "Select office"} />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={`${o.office_name}|${o.region || ""}`} value={o.office_name}>
                      {o.office_name}{o.region ? ` — ${o.region}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-border/60">
          <div className="text-xs text-muted-foreground space-x-2">
            <Badge variant="outline" className="font-mono">{parsed.length}</Badge>
            <span>→</span>
            <Badge className="bg-primary/10 text-primary">
              {targetKind === "central" && "Central Pool"}
              {targetKind === "regional" && `Regional: ${targetRegion || "—"}`}
              {targetKind === "office" && `Office: ${targetOffice || "—"}`}
            </Badge>
          </div>
          <Button onClick={() => setConfirmOpen(true)} disabled={!canSubmit}>
            <ArrowRightLeft className="h-4 w-4 mr-1" />
            Move {parsed.length || ""} Serial(s)
          </Button>
        </div>
      </div>

      <div className="bg-muted/30 border border-border/60 rounded-lg p-4 text-xs text-muted-foreground space-y-1">
        <p><strong>Movement rules</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Only <code>available</code> serials are moved. Assigned, revoked, or missing serials are reported back as skipped.</li>
          <li>Both pair rows for a serial move together (atomic per serial).</li>
          <li>Regional pool is shared across all offices in that region — any office in the region can draw from it (quota permitting).</li>
          <li>Every move writes one audit row per serial, visible in Admin Actions → Audit Log and in Serial Lookup.</li>
        </ul>
      </div>

      <AdminPasswordConfirm
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Move Serials"
        description={`Move ${parsed.length} serial(s) to ${
          targetKind === "central" ? "Central Pool" :
          targetKind === "regional" ? `Regional Pool (${targetRegion})` :
          `Office: ${targetOffice}`
        }. Already-assigned serials will be skipped.`}
        actionLabel="Move"
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default StockMovement;

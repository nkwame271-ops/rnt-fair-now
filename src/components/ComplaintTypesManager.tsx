import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, AlertTriangle, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ComplaintTypeRow, FixedFeeRow, BandRow, PercentageRow } from "@/lib/complaintFees";

const splitSum = (i: number, a: number, p: number) => Math.round((Number(i) + Number(a) + Number(p)) * 100) / 100;

const SplitInputs = ({ row, onChange }: { row: { igf_pct: number; admin_pct: number; platform_pct: number }; onChange: (patch: any) => void }) => {
  const sum = splitSum(row.igf_pct, row.admin_pct, row.platform_pct);
  const ok = sum === 100;
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1">
        <Label className="text-xs">IGF %</Label>
        <Input type="number" step="0.01" value={row.igf_pct} onChange={(e) => onChange({ igf_pct: Number(e.target.value) })} className={!ok ? "border-destructive" : ""} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Admin %</Label>
        <Input type="number" step="0.01" value={row.admin_pct} onChange={(e) => onChange({ admin_pct: Number(e.target.value) })} className={!ok ? "border-destructive" : ""} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Platform %</Label>
        <Input type="number" step="0.01" value={row.platform_pct} onChange={(e) => onChange({ platform_pct: Number(e.target.value) })} className={!ok ? "border-destructive" : ""} />
      </div>
      <div className="col-span-3 text-xs">
        Sum: <span className={ok ? "text-success font-semibold" : "text-destructive font-semibold"}>{sum}%</span> {!ok && "(must equal 100)"}
      </div>
    </div>
  );
};

const ComplaintTypesManager = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState<ComplaintTypeRow[]>([]);
  const [fixedMap, setFixedMap] = useState<Record<string, FixedFeeRow>>({});
  const [bandsMap, setBandsMap] = useState<Record<string, BandRow[]>>({});
  const [percentMap, setPercentMap] = useState<Record<string, PercentageRow>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<"fixed" | "rent_band" | "percentage" | null>(null);
  const [draft, setDraft] = useState({ key: "", label: "" });

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: f }, { data: b }, { data: p }] = await Promise.all([
      (supabase.from("complaint_types") as any).select("*").eq("active", true).order("display_order"),
      (supabase.from("complaint_fee_fixed") as any).select("*"),
      (supabase.from("complaint_fee_bands") as any).select("*").order("display_order"),
      (supabase.from("complaint_fee_percentage") as any).select("*"),
    ]);
    setTypes((t || []) as ComplaintTypeRow[]);
    const fm: Record<string, FixedFeeRow> = {};
    (f || []).forEach((r: FixedFeeRow) => { fm[r.complaint_type_id] = r; });
    setFixedMap(fm);
    const bm: Record<string, BandRow[]> = {};
    (b || []).forEach((r: BandRow) => { (bm[r.complaint_type_id] ||= []).push(r); });
    setBandsMap(bm);
    const pm: Record<string, PercentageRow> = {};
    (p || []).forEach((r: PercentageRow) => { pm[r.complaint_type_id] = r; });
    setPercentMap(pm);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fixedTypes = types.filter((t) => t.fee_structure === "fixed");
  const bandTypes = types.filter((t) => t.fee_structure === "rent_band");
  const pctTypes = types.filter((t) => t.fee_structure === "percentage");

  const saveFixed = async (typeId: string) => {
    const row = fixedMap[typeId];
    if (!row) return;
    if (splitSum(row.igf_pct, row.admin_pct, row.platform_pct) !== 100) { toast.error("Splits must sum to 100%"); return; }
    setSavingId(typeId);
    try {
      const { error } = await (supabase.from("complaint_fee_fixed") as any).upsert({
        complaint_type_id: typeId,
        fee_amount: row.fee_amount,
        igf_pct: row.igf_pct,
        admin_pct: row.admin_pct,
        platform_pct: row.platform_pct,
        updated_by: user?.id,
      }, { onConflict: "complaint_type_id" });
      if (error) throw error;
      toast.success("Saved");
      load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSavingId(null); }
  };

  const saveBand = async (band: BandRow) => {
    if (splitSum(band.igf_pct, band.admin_pct, band.platform_pct) !== 100) { toast.error("Splits must sum to 100%"); return; }
    setSavingId(band.id);
    try {
      const { error } = await (supabase.from("complaint_fee_bands") as any).update({
        band_label: band.band_label,
        rent_min: band.rent_min,
        rent_max: band.rent_max,
        fee_amount: band.fee_amount,
        igf_pct: band.igf_pct,
        admin_pct: band.admin_pct,
        platform_pct: band.platform_pct,
        display_order: band.display_order,
        updated_by: user?.id,
      }).eq("id", band.id);
      if (error) throw error;
      toast.success("Band saved");
      load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSavingId(null); }
  };

  const addBand = async (typeId: string) => {
    const existing = bandsMap[typeId] || [];
    const lastMax = existing.length ? Math.max(...existing.map((b) => Number(b.rent_max ?? b.rent_min))) : 0;
    const { error } = await (supabase.from("complaint_fee_bands") as any).insert({
      complaint_type_id: typeId,
      band_label: `Band ${existing.length + 1}`,
      rent_min: lastMax + 1,
      rent_max: null,
      fee_amount: 0,
      display_order: existing.length + 1,
      updated_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    load();
  };

  const removeBand = async (id: string) => {
    if (!confirm("Delete this rent band?")) return;
    const { error } = await (supabase.from("complaint_fee_bands") as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const savePct = async (typeId: string) => {
    const row = percentMap[typeId]; if (!row) return;
    if (splitSum(row.igf_pct, row.admin_pct, row.platform_pct) !== 100) { toast.error("Splits must sum to 100%"); return; }
    setSavingId(typeId);
    try {
      const { error } = await (supabase.from("complaint_fee_percentage") as any).upsert({
        complaint_type_id: typeId,
        base_source: row.base_source,
        threshold_amount: row.threshold_amount,
        below_threshold_pct: row.below_threshold_pct,
        above_threshold_pct: row.above_threshold_pct,
        igf_pct: row.igf_pct,
        admin_pct: row.admin_pct,
        platform_pct: row.platform_pct,
        updated_by: user?.id,
      }, { onConflict: "complaint_type_id" });
      if (error) throw error;
      toast.success("Saved"); load();
    } catch (e: any) { toast.error(e.message || "Save failed"); }
    finally { setSavingId(null); }
  };

  const toggleActive = async (typeId: string, value: boolean) => {
    await (supabase.from("complaint_types") as any).update({ active: value, updated_by: user?.id }).eq("id", typeId);
    load();
  };

  const removeType = async (typeId: string) => {
    if (!confirm("Delete this complaint type? Existing complaints already linked will keep their reference but it will no longer be selectable.")) return;
    const { error } = await (supabase.from("complaint_types") as any).delete().eq("id", typeId);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted"); load();
  };

  const createType = async () => {
    if (!creatingFor) return;
    if (!draft.key || !draft.label) { toast.error("Key and label required"); return; }
    const lastOrder = Math.max(0, ...types.map((t) => t.display_order));
    const { data, error } = await (supabase.from("complaint_types") as any).insert({
      key: draft.key.toLowerCase().replace(/\s+/g, "_"),
      label: draft.label,
      fee_mode: creatingFor,
      fee_structure: creatingFor,
      requires_property_link: creatingFor === "rent_band" || creatingFor === "percentage",
      display_order: lastOrder + 10,
      active: true,
      updated_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    if (creatingFor === "fixed") {
      await (supabase.from("complaint_fee_fixed") as any).insert({ complaint_type_id: data.id });
    } else if (creatingFor === "percentage") {
      await (supabase.from("complaint_fee_percentage") as any).insert({ complaint_type_id: data.id, base_source: "monthly_rent" });
    }
    toast.success("Type created");
    setCreatingFor(null); setDraft({ key: "", label: "" });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const renderHeader = (t: ComplaintTypeRow) => (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold text-foreground truncate">{t.label}</span>
        <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{t.key}</code>
        {t.requires_property_link && <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded-full">Requires property</span>}
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={t.active} onCheckedChange={(v) => toggleActive(t.id, v)} />
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeType(t.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs bg-info/10 text-info border border-info/20 rounded-lg px-3 py-2">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <span>All complaint fees are organised by structure: <strong>Fixed</strong>, <strong>Rent Band</strong>, or <strong>Percentage</strong>. Splits (IGF / Admin / Platform) must sum to exactly 100% per row.</span>
      </div>

      <Tabs defaultValue="fixed" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="fixed">Fixed ({fixedTypes.length})</TabsTrigger>
          <TabsTrigger value="rent_band">Rent Band ({bandTypes.length})</TabsTrigger>
          <TabsTrigger value="percentage">Percentage ({pctTypes.length})</TabsTrigger>
        </TabsList>

        {/* FIXED */}
        <TabsContent value="fixed" className="space-y-3 mt-4">
          {fixedTypes.map((t) => {
            const row = fixedMap[t.id] || { id: "", complaint_type_id: t.id, fee_amount: 0, igf_pct: 70, admin_pct: 20, platform_pct: 10 };
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                {renderHeader(t)}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Fee Amount (GHS)</Label>
                    <Input type="number" step="0.01" value={row.fee_amount} onChange={(e) => setFixedMap((m) => ({ ...m, [t.id]: { ...row, fee_amount: Number(e.target.value) } }))} />
                  </div>
                  <SplitInputs row={row} onChange={(patch) => setFixedMap((m) => ({ ...m, [t.id]: { ...row, ...patch } }))} />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => saveFixed(t.id)} disabled={savingId === t.id}>
                    {savingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save
                  </Button>
                </div>
              </div>
            );
          })}
          {creatingFor === "fixed" ? (
            <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Key (slug)</Label><Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="e.g. court_filing" /></div>
                <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Court Filing Fee" /></div>
              </div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCreatingFor(null)}>Cancel</Button><Button size="sm" onClick={createType}>Create</Button></div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreatingFor("fixed")} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Fixed Fee Type</Button>
          )}
        </TabsContent>

        {/* RENT BAND */}
        <TabsContent value="rent_band" className="space-y-3 mt-4">
          {bandTypes.map((t) => {
            const bands = bandsMap[t.id] || [];
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                {renderHeader(t)}
                <div className="space-y-3">
                  {bands.length === 0 && <div className="text-xs text-muted-foreground italic">No bands configured. Add one below.</div>}
                  {bands.map((band) => (
                    <div key={band.id} className="border border-border rounded-lg p-3 bg-muted/20 space-y-3">
                      <div className="grid sm:grid-cols-4 gap-2">
                        <div className="space-y-1 sm:col-span-2"><Label className="text-xs">Band Label</Label><Input value={band.band_label} onChange={(e) => setBandsMap((m) => ({ ...m, [t.id]: bands.map((b) => b.id === band.id ? { ...b, band_label: e.target.value } : b) }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Rent Min (GHS)</Label><Input type="number" value={band.rent_min} onChange={(e) => setBandsMap((m) => ({ ...m, [t.id]: bands.map((b) => b.id === band.id ? { ...b, rent_min: Number(e.target.value) } : b) }))} /></div>
                        <div className="space-y-1"><Label className="text-xs">Rent Max (blank = no cap)</Label><Input type="number" value={band.rent_max ?? ""} onChange={(e) => setBandsMap((m) => ({ ...m, [t.id]: bands.map((b) => b.id === band.id ? { ...b, rent_max: e.target.value === "" ? null : Number(e.target.value) } : b) }))} /></div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1"><Label className="text-xs">Fee Amount (GHS)</Label><Input type="number" step="0.01" value={band.fee_amount} onChange={(e) => setBandsMap((m) => ({ ...m, [t.id]: bands.map((b) => b.id === band.id ? { ...b, fee_amount: Number(e.target.value) } : b) }))} /></div>
                        <SplitInputs row={band} onChange={(patch) => setBandsMap((m) => ({ ...m, [t.id]: bands.map((b) => b.id === band.id ? { ...b, ...patch } : b) }))} />
                      </div>
                      <div className="flex justify-between">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeBand(band.id)}><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete band</Button>
                        <Button size="sm" onClick={() => saveBand(band)} disabled={savingId === band.id}>{savingId === band.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save band</Button>
                      </div>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={() => addBand(t.id)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Band</Button>
                </div>
              </div>
            );
          })}
          {creatingFor === "rent_band" ? (
            <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Key (slug)</Label><Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="e.g. counterclaim_v2" /></div>
                <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Counterclaim v2" /></div>
              </div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCreatingFor(null)}>Cancel</Button><Button size="sm" onClick={createType}>Create</Button></div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreatingFor("rent_band")} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Rent-Band Type</Button>
          )}
        </TabsContent>

        {/* PERCENTAGE */}
        <TabsContent value="percentage" className="space-y-3 mt-4">
          {pctTypes.map((t) => {
            const row = percentMap[t.id] || { id: "", complaint_type_id: t.id, base_source: "monthly_rent" as const, threshold_amount: 500, below_threshold_pct: 0, above_threshold_pct: 0, igf_pct: 70, admin_pct: 20, platform_pct: 10 };
            return (
              <div key={t.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                {renderHeader(t)}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Base Source</Label>
                    <Select value={row.base_source} onValueChange={(v: any) => setPercentMap((m) => ({ ...m, [t.id]: { ...row, base_source: v } }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly_rent">Monthly Rent (linked property)</SelectItem>
                        <SelectItem value="claim_amount">Claim Amount (entered by admin)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Threshold (GHS)</Label><Input type="number" step="0.01" value={row.threshold_amount} onChange={(e) => setPercentMap((m) => ({ ...m, [t.id]: { ...row, threshold_amount: Number(e.target.value) } }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">Below Threshold %</Label><Input type="number" step="0.01" value={row.below_threshold_pct} onChange={(e) => setPercentMap((m) => ({ ...m, [t.id]: { ...row, below_threshold_pct: Number(e.target.value) } }))} /></div>
                  <div className="space-y-1"><Label className="text-xs">At/Above Threshold %</Label><Input type="number" step="0.01" value={row.above_threshold_pct} onChange={(e) => setPercentMap((m) => ({ ...m, [t.id]: { ...row, above_threshold_pct: Number(e.target.value) } }))} /></div>
                </div>
                <SplitInputs row={row} onChange={(patch) => setPercentMap((m) => ({ ...m, [t.id]: { ...row, ...patch } }))} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => savePct(t.id)} disabled={savingId === t.id}>{savingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />} Save</Button>
                </div>
              </div>
            );
          })}
          {creatingFor === "percentage" ? (
            <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs">Key (slug)</Label><Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="e.g. levy_pct" /></div>
                <div className="space-y-1"><Label className="text-xs">Label</Label><Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Levy (percentage)" /></div>
              </div>
              <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setCreatingFor(null)}>Cancel</Button><Button size="sm" onClick={createType}>Create</Button></div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreatingFor("percentage")} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add Percentage Type</Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ComplaintTypesManager;

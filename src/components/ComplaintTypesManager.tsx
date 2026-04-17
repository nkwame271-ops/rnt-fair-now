import { useEffect, useState } from "react";
import { Plus, Trash2, Save, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CT {
  id: string;
  key: string;
  label: string;
  fee_mode: string;
  fee_amount: number | null;
  fee_percentage: number | null;
  rent_band_config: any;
  active: boolean;
  display_order: number;
}

const ComplaintTypesManager = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<CT[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ key: "", label: "", fee_amount: 50 });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("complaint_types").select("*").order("display_order");
    setItems((data || []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateField = (id: string, patch: Partial<CT>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const save = async (item: CT) => {
    setSavingId(item.id);
    try {
      const { error } = await supabase.from("complaint_types").update({
        label: item.label,
        fee_mode: item.fee_mode,
        fee_amount: item.fee_amount,
        fee_percentage: item.fee_percentage,
        rent_band_config: item.rent_band_config,
        active: item.active,
        display_order: item.display_order,
        updated_by: user?.id,
      } as any).eq("id", item.id);
      if (error) throw error;
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this complaint type? Existing complaints already linked will keep their reference.")) return;
    const { error } = await supabase.from("complaint_types").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    load();
  };

  const create = async () => {
    if (!draft.key || !draft.label) { toast.error("Key and label are required"); return; }
    const { error } = await supabase.from("complaint_types").insert({
      key: draft.key.toLowerCase().replace(/\s+/g, "_"),
      label: draft.label,
      fee_mode: "fixed",
      fee_amount: draft.fee_amount,
      display_order: (items[items.length - 1]?.display_order ?? 0) + 10,
      updated_by: user?.id,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Created");
    setCreating(false);
    setDraft({ key: "", label: "", fee_amount: 50 });
    load();
  };

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 text-xs bg-info/10 text-info border border-info/20 rounded-lg px-3 py-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>These types appear in the regulator's "Set Type & Request Payment" dialog. Fee mode controls how the amount is computed when an admin selects this type.</span>
      </div>

      {items.map((item) => (
        <div key={item.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{item.key}</code>
              <Switch checked={item.active} onCheckedChange={(v) => updateField(item.id, { active: v })} />
              <span className="text-xs text-muted-foreground">{item.active ? "Active" : "Disabled"}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" onClick={() => save(item)} disabled={savingId === item.id}>
                {savingId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(item.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={item.label} onChange={(e) => updateField(item.id, { label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fee Mode</Label>
              <Select value={item.fee_mode} onValueChange={(v) => updateField(item.id, { fee_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="percentage">Percentage of Rent</SelectItem>
                  <SelectItem value="rent_band">Rent Band</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {item.fee_mode === "fixed" && (
              <div className="space-y-1">
                <Label className="text-xs">Fee Amount (GH₵)</Label>
                <Input type="number" step="0.01" value={item.fee_amount ?? 0} onChange={(e) => updateField(item.id, { fee_amount: Number(e.target.value) })} />
              </div>
            )}
            {item.fee_mode === "percentage" && (
              <div className="space-y-1">
                <Label className="text-xs">Percentage (%)</Label>
                <Input type="number" step="0.1" value={item.fee_percentage ?? 0} onChange={(e) => updateField(item.id, { fee_percentage: Number(e.target.value) })} />
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-xs">Display Order</Label>
              <Input type="number" value={item.display_order} onChange={(e) => updateField(item.id, { display_order: Number(e.target.value) })} />
            </div>
          </div>
          {item.fee_mode === "rent_band" && (
            <div className="space-y-1">
              <Label className="text-xs">Rent Band Config (JSON: [{`{ min, max, fee }`}])</Label>
              <textarea
                className="w-full font-mono text-xs rounded-md border border-input bg-background p-2"
                rows={3}
                value={JSON.stringify(item.rent_band_config || [], null, 2)}
                onChange={(e) => {
                  try { updateField(item.id, { rent_band_config: JSON.parse(e.target.value) }); } catch {}
                }}
              />
            </div>
          )}
        </div>
      ))}

      {creating ? (
        <div className="bg-card border border-primary/30 rounded-xl p-4 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Key (slug)</Label>
              <Input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="e.g. noise_complaint" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Label</Label>
              <Input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="e.g. Noise Complaint" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Default Fee (GH₵)</Label>
              <Input type="number" value={draft.fee_amount} onChange={(e) => setDraft({ ...draft, fee_amount: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
            <Button size="sm" onClick={create}>Create</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Add Complaint Type
        </Button>
      )}
    </div>
  );
};

export default ComplaintTypesManager;

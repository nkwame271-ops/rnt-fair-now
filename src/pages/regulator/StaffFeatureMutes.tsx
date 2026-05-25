import { useEffect, useMemo, useState } from "react";
import { Search, UserCog, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Staff {
  user_id: string;
  admin_type: string;
  full_name?: string;
  email?: string;
}

interface Mute {
  id: string;
  staff_user_id: string;
  feature_key: string;
  sub_key: string | null;
  is_enabled: boolean;
}

interface FeatureFlag {
  feature_key: string;
  label: string;
  category: string;
}

const StaffFeatureMutes = () => {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [mutes, setMutes] = useState<Mute[]>([]);
  const [search, setSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [newFeature, setNewFeature] = useState("");
  const [newSubKey, setNewSubKey] = useState("");
  const [newEnabled, setNewEnabled] = useState(false);

  const load = async () => {
    const [{ data: a }, { data: f }, { data: m }] = await Promise.all([
      supabase.from("admin_staff").select("user_id, admin_type"),
      supabase.from("feature_flags").select("feature_key, label, category").order("category"),
      supabase.from("staff_feature_overrides" as any).select("*"),
    ]);
    // Fetch profile names for the staff
    const ids = (a || []).map((s: any) => s.user_id);
    let profiles: Record<string, { full_name?: string; email?: string }> = {};
    if (ids.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", ids);
      profiles = Object.fromEntries(
        (p || []).map((pr: any) => [pr.user_id, { full_name: pr.full_name, email: pr.email }])
      );
    }
    setStaff(
      (a || []).map((s: any) => ({ ...s, ...(profiles[s.user_id] || {}) }))
    );
    setFlags((f as FeatureFlag[]) || []);
    setMutes(((m as unknown) as Mute[]) || []);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredStaff = useMemo(() => {
    const q = search.toLowerCase();
    return staff.filter(
      (s) =>
        !q ||
        s.full_name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.admin_type.toLowerCase().includes(q)
    );
  }, [staff, search]);

  const mutesForStaff = (uid: string) => mutes.filter((m) => m.staff_user_id === uid);

  const addMute = async () => {
    if (!selectedStaff || !newFeature) {
      toast.error("Pick a feature");
      return;
    }
    const { error } = await supabase
      .from("staff_feature_overrides" as any)
      .insert({
        staff_user_id: selectedStaff,
        feature_key: newFeature,
        sub_key: newSubKey || null,
        is_enabled: newEnabled,
      } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Saved");
    setNewSubKey("");
    load();
  };

  const removeMute = async (id: string) => {
    await supabase.from("staff_feature_overrides" as any).delete().eq("id", id);
    load();
  };

  const toggleMute = async (id: string, v: boolean) => {
    await supabase.from("staff_feature_overrides" as any).update({ is_enabled: v } as any).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserCog className="h-6 w-6 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold">Staff Feature Mutes</h1>
          <p className="text-sm text-muted-foreground">
            Super Admin — mute features, menus, cards, or dashboards per staff member.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search staff…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredStaff.map((s) => (
              <button
                key={s.user_id}
                onClick={() => setSelectedStaff(s.user_id)}
                className={`w-full text-left p-2 rounded-lg border text-sm ${
                  selectedStaff === s.user_id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="font-medium">{s.full_name || s.email || s.user_id}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {s.admin_type.replaceAll("_", " ")}
                </div>
              </button>
            ))}
            {filteredStaff.length === 0 && (
              <p className="text-sm text-muted-foreground">No staff matched.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedStaff ? "Mutes & Sub-feature controls" : "Pick a staff member"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedStaff && (
              <>
                <div className="space-y-1 max-h-[35vh] overflow-y-auto">
                  {mutesForStaff(selectedStaff).map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2 rounded border text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate">{m.feature_key}</div>
                        {m.sub_key && (
                          <Badge variant="outline" className="text-[10px] mt-1">
                            {m.sub_key}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={m.is_enabled}
                          onCheckedChange={(v) => toggleMute(m.id, v)}
                        />
                        <Button size="icon" variant="ghost" onClick={() => removeMute(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {mutesForStaff(selectedStaff).length === 0 && (
                    <p className="text-xs text-muted-foreground">No mutes set.</p>
                  )}
                </div>

                <div className="border-t pt-3 space-y-2">
                  <Label>Feature</Label>
                  <Select value={newFeature} onValueChange={setNewFeature}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pick a feature…" />
                    </SelectTrigger>
                    <SelectContent>
                      {flags.map((f) => (
                        <SelectItem key={f.feature_key} value={f.feature_key}>
                          [{f.category}] {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Label>Sub-key (optional — for a menu / card / dashboard inside the feature)</Label>
                  <Input
                    value={newSubKey}
                    onChange={(e) => setNewSubKey(e.target.value)}
                    placeholder="e.g. emergency_view_live_location"
                  />
                  <div className="flex items-center justify-between p-2 rounded bg-muted/40">
                    <Label>Enable for this staff</Label>
                    <Switch checked={newEnabled} onCheckedChange={setNewEnabled} />
                  </div>
                  <Button onClick={addMute} className="w-full">
                    <Plus className="h-4 w-4 mr-1" /> Add Rule
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StaffFeatureMutes;

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Shield, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FeatureFlag {
  feature_key: string;
  label: string;
  category: string;
  is_enabled: boolean;
}

interface Override {
  id: string;
  feature_key: string;
  target_type: "role" | "user" | "dashboard" | "admin_category" | "institution";
  target_value: string;
  is_enabled: boolean;
}

const TARGET_TYPES = [
  { value: "role", label: "Role" },
  { value: "user", label: "User (UUID)" },
  { value: "dashboard", label: "Dashboard" },
  { value: "admin_category", label: "Admin Category" },
  { value: "institution", label: "Institution" },
] as const;

const AccessControlConsole = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [search, setSearch] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // New override form
  const [tType, setTType] = useState<Override["target_type"]>("role");
  const [tValue, setTValue] = useState("");
  const [tEnabled, setTEnabled] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: ff }, { data: ov }] = await Promise.all([
      supabase.from("feature_flags").select("feature_key, label, category, is_enabled").order("category"),
      supabase.from("feature_flag_overrides" as any).select("*"),
    ]);
    setFlags((ff as FeatureFlag[]) || []);
    setOverrides(((ov as unknown) as Override[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return flags.filter(
      (f) => !q || f.feature_key.toLowerCase().includes(q) || f.label.toLowerCase().includes(q)
    );
  }, [flags, search]);

  const byCategory = useMemo(() => {
    const grouped: Record<string, FeatureFlag[]> = {};
    filtered.forEach((f) => {
      (grouped[f.category] = grouped[f.category] || []).push(f);
    });
    return grouped;
  }, [filtered]);

  const overridesFor = (key: string) => overrides.filter((o) => o.feature_key === key);

  const addOverride = async () => {
    if (!selectedKey || !tValue.trim()) {
      toast.error("Pick a target value");
      return;
    }
    const { error } = await supabase
      .from("feature_flag_overrides" as any)
      .insert({
        feature_key: selectedKey,
        target_type: tType,
        target_value: tValue.trim(),
        is_enabled: tEnabled,
      } as any);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Override added");
    setTValue("");
    load();
  };

  const removeOverride = async (id: string) => {
    const { error } = await supabase.from("feature_flag_overrides" as any).delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  };

  const toggleOverride = async (id: string, value: boolean) => {
    await supabase.from("feature_flag_overrides" as any).update({ is_enabled: value } as any).eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Access Control</h1>
          <p className="text-sm text-muted-foreground">
            Default-off. Enable per role, user, dashboard, admin category, or institution.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search features…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {Object.entries(byCategory).map(([cat, list]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="capitalize text-base">{cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {list.map((f) => {
              const count = overridesFor(f.feature_key).length;
              return (
                <div
                  key={f.feature_key}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{f.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.feature_key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.is_enabled ? "default" : "secondary"}>
                      {f.is_enabled ? "Default ON" : "Default OFF"}
                    </Badge>
                    {count > 0 && <Badge variant="outline">{count} overrides</Badge>}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedKey(f.feature_key);
                        setDrawerOpen(true);
                      }}
                    >
                      Manage Access
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Access — {selectedKey}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overrides">
            <TabsList>
              <TabsTrigger value="overrides">Existing</TabsTrigger>
              <TabsTrigger value="new">Add Override</TabsTrigger>
            </TabsList>

            <TabsContent value="overrides" className="space-y-2 max-h-[50vh] overflow-y-auto">
              {selectedKey &&
                overridesFor(selectedKey).map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-2 rounded border text-sm"
                  >
                    <div>
                      <Badge variant="outline" className="mr-2 capitalize">
                        {o.target_type}
                      </Badge>
                      <span className="font-mono text-xs">{o.target_value}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={o.is_enabled}
                        onCheckedChange={(v) => toggleOverride(o.id, v)}
                      />
                      <Button size="icon" variant="ghost" onClick={() => removeOverride(o.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              {selectedKey && overridesFor(selectedKey).length === 0 && (
                <p className="text-sm text-muted-foreground">No overrides yet.</p>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-3">
              <div>
                <Label>Target type</Label>
                <Select value={tType} onValueChange={(v) => setTType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Target value</Label>
                <Input
                  value={tValue}
                  onChange={(e) => setTValue(e.target.value)}
                  placeholder={
                    tType === "role"
                      ? "tenant | landlord | student | admin"
                      : tType === "user"
                      ? "User UUID"
                      : tType === "dashboard"
                      ? "tenant-dashboard / regulator-dashboard …"
                      : tType === "admin_category"
                      ? "main_admin | super_admin | nugs …"
                      : "Institution name"
                  }
                />
              </div>
              <div className="flex items-center justify-between p-2 rounded bg-muted/40">
                <Label>Enable for this target</Label>
                <Switch checked={tEnabled} onCheckedChange={setTEnabled} />
              </div>
              <Button onClick={addOverride} className="w-full">
                <Plus className="h-4 w-4 mr-1" /> Add Override
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AccessControlConsole;

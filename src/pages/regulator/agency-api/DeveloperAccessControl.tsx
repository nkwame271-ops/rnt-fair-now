import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

const KEYS = [
  { key: "developer_signups_paused", field: "paused", label: "Pause new developer signups", desc: "Blocks /developers/signup and disables the homepage CTA. Existing developers keep working." },
  { key: "developer_auto_sandbox", field: "enabled", label: "Auto-issue sandbox keys on first login", desc: "When off, even sandbox keys require admin approval. Default: on." },
  { key: "developer_require_dsa_reaccept", field: "required", label: "Require DSA re-acceptance", desc: "Force all developer orgs to re-accept the Data Sharing Agreement on next login." },
];

export default function DeveloperAccessControl() {
  const qc = useQueryClient();

  const { data: cfg = {}, isLoading } = useQuery({
    queryKey: ["developer-access-config"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config")
        .select("config_key, config_value")
        .in("config_key", KEYS.map((k) => k.key));
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { map[r.config_key] = r.config_value; });
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ key, field, value }: { key: string; field: string; value: boolean }) => {
      const { error } = await supabase.from("platform_config")
        .upsert({ config_key: key, config_value: { [field]: value } }, { onConflict: "config_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["developer-access-config"] });
      qc.invalidateQueries({ queryKey: ["developer-signups-paused"] });
      toast.success("Updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-5 w-5 animate-spin" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Settings2 className="h-4 w-4" />Developer portal — access control</CardTitle>
        <CardDescription>Master switches for the public developer signup flow. Admin-only.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {KEYS.map((k) => {
          const value = !!cfg[k.key]?.[k.field];
          return (
            <div key={k.key} className="flex items-center justify-between p-3 border rounded-lg gap-3">
              <div className="min-w-0">
                <p className="font-medium text-sm">{k.label}</p>
                <p className="text-xs text-muted-foreground">{k.desc}</p>
              </div>
              <Switch checked={value} onCheckedChange={(v) => toggle.mutate({ key: k.key, field: k.field, value: v })} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

import { useState } from "react";
import { Settings, Power, Loader2, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllFeatureFlags, invalidateFeatureFlags } from "@/hooks/useFeatureFlag";
import LogoLoader from "@/components/LogoLoader";

const EngineRoom = () => {
  const { user } = useAuth();
  const { flags, loading, refetch } = useAllFeatureFlags();
  const [toggling, setToggling] = useState<string | null>(null);

  const handleToggle = async (featureKey: string, currentValue: boolean) => {
    setToggling(featureKey);
    const { error } = await supabase
      .from("feature_flags")
      .update({
        is_enabled: !currentValue,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      } as any)
      .eq("feature_key", featureKey);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(`Feature ${!currentValue ? "enabled" : "disabled"}`);
      invalidateFeatureFlags();
      refetch();
    }
    setToggling(null);
  };

  if (loading) return <LogoLoader message="Loading feature controls..." />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Engine Room
        </h1>
        <p className="text-muted-foreground mt-1">
          Enable or disable platform features. Disabled features show a "Coming Soon" message to users.
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <span>Features awaiting approval from the Ministry of Works and Housing can be disabled here without modifying any code. Changes take effect immediately across the platform.</span>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
        {flags.map((flag) => (
          <div
            key={flag.feature_key}
            className="flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Power className={`h-5 w-5 mt-0.5 ${flag.is_enabled ? "text-success" : "text-muted-foreground"}`} />
              <div>
                <h3 className="font-semibold text-card-foreground">{flag.label}</h3>
                {flag.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
                )}
                <span className={`text-xs font-medium mt-1 inline-block px-2 py-0.5 rounded-full ${
                  flag.is_enabled
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {flag.is_enabled ? "Active" : "Disabled"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toggling === flag.feature_key && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <Switch
                checked={flag.is_enabled}
                onCheckedChange={() => handleToggle(flag.feature_key, flag.is_enabled)}
                disabled={toggling === flag.feature_key}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EngineRoom;

import { useState } from "react";
import { Settings, Power, Loader2, Info, DollarSign, Users, Building2, CreditCard } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllFeatureFlags, invalidateFeatureFlags } from "@/hooks/useFeatureFlag";
import LogoLoader from "@/components/LogoLoader";

const EngineRoom = () => {
  const { user } = useAuth();
  const { flags, loading, refetch } = useAllFeatureFlags();
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, number>>({});

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

  const handleFeeToggle = async (featureKey: string, currentFeeEnabled: boolean) => {
    setToggling(featureKey + "_fee");
    const { error } = await supabase
      .from("feature_flags")
      .update({
        fee_enabled: !currentFeeEnabled,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      } as any)
      .eq("feature_key", featureKey);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(`Payment ${!currentFeeEnabled ? "activated" : "deactivated"}`);
      invalidateFeatureFlags();
      refetch();
    }
    setToggling(null);
  };

  const handleFeeAmountSave = async (featureKey: string) => {
    const newAmount = editingFees[featureKey];
    if (newAmount === undefined || newAmount < 0) return;
    setToggling(featureKey + "_amount");
    const { error } = await supabase
      .from("feature_flags")
      .update({
        fee_amount: newAmount,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      } as any)
      .eq("feature_key", featureKey);

    if (error) {
      toast.error("Failed to update fee: " + error.message);
    } else {
      toast.success(`Fee updated to GH₵ ${newAmount}`);
      invalidateFeatureFlags();
      refetch();
      setEditingFees((prev) => { const n = { ...prev }; delete n[featureKey]; return n; });
    }
    setToggling(null);
  };

  if (loading) return <LogoLoader message="Loading feature controls..." />;

  const tenantFlags = flags.filter((f) => f.category === "tenant");
  const landlordFlags = flags.filter((f) => f.category === "landlord");
  const generalFlags = flags.filter((f) => f.category === "general");
  const feeFlags = flags.filter((f) => f.category === "fee");

  const renderFeatureRow = (flag: any) => (
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
  );

  const renderFeeRow = (flag: any) => {
    const currentEditValue = editingFees[flag.feature_key];
    const isEditing = currentEditValue !== undefined;
    return (
      <div
        key={flag.feature_key}
        className="flex flex-col sm:flex-row sm:items-center justify-between p-5 hover:bg-muted/30 transition-colors gap-4"
      >
        <div className="flex items-start gap-3 flex-1">
          <DollarSign className={`h-5 w-5 mt-0.5 ${flag.fee_enabled ? "text-success" : "text-muted-foreground"}`} />
          <div>
            <h3 className="font-semibold text-card-foreground">{flag.label}</h3>
            {flag.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{flag.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                flag.fee_enabled
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground"
              }`}>
                {flag.fee_enabled ? "Payment Active" : "Payment Off (Free)"}
              </span>
              <span className="text-xs text-muted-foreground">
                Current: GH₵ {(flag.fee_amount ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min="0"
              step="0.5"
              className="w-24 h-9 text-sm"
              value={isEditing ? currentEditValue : (flag.fee_amount ?? 0)}
              onChange={(e) => setEditingFees((prev) => ({ ...prev, [flag.feature_key]: parseFloat(e.target.value) || 0 }))}
            />
            {isEditing && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleFeeAmountSave(flag.feature_key)}
                disabled={toggling === flag.feature_key + "_amount"}
              >
                {toggling === flag.feature_key + "_amount" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {toggling === flag.feature_key + "_fee" && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            <Switch
              checked={flag.fee_enabled}
              onCheckedChange={() => handleFeeToggle(flag.feature_key, flag.fee_enabled)}
              disabled={toggling === flag.feature_key + "_fee"}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Engine Room
        </h1>
        <p className="text-muted-foreground mt-1">
          Enable or disable platform features and manage fees. Changes take effect immediately.
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <span>Features awaiting approval from the Ministry of Works and Housing can be disabled here without modifying any code. Fees can be adjusted or turned off entirely — when payment is off, the feature becomes free.</span>
      </div>

      {/* Tenant Features */}
      {tenantFlags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-primary" /> Tenant Features
          </h2>
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {tenantFlags.map(renderFeatureRow)}
          </div>
        </div>
      )}

      {/* Landlord Features */}
      {landlordFlags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <Building2 className="h-5 w-5 text-primary" /> Landlord Features
          </h2>
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {landlordFlags.map(renderFeatureRow)}
          </div>
        </div>
      )}

      {/* General Features */}
      {generalFlags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <Settings className="h-5 w-5 text-primary" /> General Features
          </h2>
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {generalFlags.map(renderFeatureRow)}
          </div>
        </div>
      )}

      {/* Platform Fees */}
      {feeFlags.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <CreditCard className="h-5 w-5 text-primary" /> Platform Fees
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Adjust fee amounts or switch off payments entirely. When a payment is turned off, the action becomes free.
          </p>
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {feeFlags.map(renderFeeRow)}
          </div>
        </div>
      )}
    </div>
  );
};

export default EngineRoom;

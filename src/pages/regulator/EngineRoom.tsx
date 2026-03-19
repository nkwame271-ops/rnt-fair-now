import { useState, useEffect } from "react";
import { Settings, Power, Loader2, Info, DollarSign, Users, Building2, CreditCard, Shield, UserCog, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllFeatureFlags, invalidateFeatureFlags } from "@/hooks/useFeatureFlag";
import { useAdminProfile, FEATURE_ROUTE_MAP } from "@/hooks/useAdminProfile";
import LogoLoader from "@/components/LogoLoader";

interface StaffMember {
  user_id: string;
  admin_type: string;
  office_name: string | null;
  allowed_features: string[];
  muted_features: string[];
  full_name?: string;
}

const EngineRoom = () => {
  const { user } = useAuth();
  const { flags, loading, refetch } = useAllFeatureFlags();
  const { profile, loading: profileLoading } = useAdminProfile();
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, number>>({});
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [mutingStaff, setMutingStaff] = useState<string | null>(null);

  // Fetch sub admins for main admin view
  useEffect(() => {
    if (!profile?.isMainAdmin) return;
    const fetchStaff = async () => {
      setStaffLoading(true);
      const { data: staff } = await supabase
        .from("admin_staff")
        .select("user_id, admin_type, office_name, allowed_features, muted_features")
        .eq("admin_type", "sub_admin");

      if (staff && staff.length > 0) {
        const userIds = staff.map((s: any) => s.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));
        setStaffMembers(staff.map((s: any) => ({
          ...s,
          full_name: nameMap.get(s.user_id) || "Unknown",
        })));
      }
      setStaffLoading(false);
    };
    fetchStaff();
  }, [profile?.isMainAdmin]);

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

  const handleMuteFeature = async (staffUserId: string, featureKey: string, currentlyMuted: boolean) => {
    setMutingStaff(staffUserId + "_" + featureKey);
    const member = staffMembers.find(s => s.user_id === staffUserId);
    if (!member) return;

    const newMuted = currentlyMuted
      ? member.muted_features.filter(f => f !== featureKey)
      : [...member.muted_features, featureKey];

    const { error } = await supabase
      .from("admin_staff")
      .update({ muted_features: newMuted, updated_at: new Date().toISOString() } as any)
      .eq("user_id", staffUserId);

    if (error) {
      toast.error("Failed to update: " + error.message);
    } else {
      toast.success(`Feature ${currentlyMuted ? "unmuted" : "muted"} for staff`);
      setStaffMembers(prev => prev.map(s =>
        s.user_id === staffUserId ? { ...s, muted_features: newMuted } : s
      ));
    }
    setMutingStaff(null);
  };

  if (loading || profileLoading) return <LogoLoader message="Loading feature controls..." />;

  const isMainAdmin = profile?.isMainAdmin ?? false;
  const isSubAdmin = profile && !profile.isMainAdmin;

  // Sub admins see only their allowed (non-muted) features — read only
  const visibleFlags = isSubAdmin
    ? flags.filter(f => {
        const featureKey = f.feature_key;
        return profile!.allowedFeatures.includes(featureKey) && !profile!.mutedFeatures.includes(featureKey);
      })
    : flags;

  const tenantFlags = visibleFlags.filter((f) => f.category === "tenant");
  const landlordFlags = visibleFlags.filter((f) => f.category === "landlord");
  const generalFlags = visibleFlags.filter((f) => f.category === "general");
  const feeFlags = visibleFlags.filter((f) => f.category === "fee");

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
      {isMainAdmin && (
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
      )}
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
        {isMainAdmin && (
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
        )}
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
          {isMainAdmin
            ? "Enable or disable platform features, manage fees, and control staff access. Changes take effect immediately."
            : "View the features and settings available to your account."}
        </p>
      </div>

      {isSubAdmin && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg border border-border">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <span>You are viewing as a Sub Admin. Only features assigned to your account are shown. Contact a Main Admin to request changes.</span>
        </div>
      )}

      {isMainAdmin && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
          <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
          <span>Features awaiting approval from the Ministry of Works and Housing can be disabled here without modifying any code. Fees can be adjusted or turned off entirely — when payment is off, the feature becomes free.</span>
        </div>
      )}

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
          {isMainAdmin && (
            <p className="text-sm text-muted-foreground mb-3">
              Adjust fee amounts or switch off payments entirely. When a payment is turned off, the action becomes free.
            </p>
          )}
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {feeFlags.map(renderFeeRow)}
          </div>
        </div>
      )}

      {/* Staff Feature Access — Main Admin only */}
      {isMainAdmin && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <UserCog className="h-5 w-5 text-primary" /> Staff Feature Access
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Mute or unmute specific features for each Sub Admin. Muted features are hidden from that staff member's portal.
          </p>

          {staffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
              No Sub Admins have been invited yet.
            </div>
          ) : (
            <div className="space-y-4">
              {staffMembers.map(member => (
                <div key={member.user_id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-card-foreground">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground">{member.office_name || "No office assigned"}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">Sub Admin</Badge>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {member.allowed_features.map(featureKey => {
                      const isMuted = member.muted_features.includes(featureKey);
                      const isMuting = mutingStaff === member.user_id + "_" + featureKey;
                      return (
                        <div
                          key={featureKey}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                            isMuted ? "border-destructive/20 bg-destructive/5" : "border-border bg-muted/20"
                          }`}
                        >
                          <span className={`text-sm capitalize ${isMuted ? "text-muted-foreground line-through" : "text-card-foreground"}`}>
                            {featureKey.replace(/_/g, " ")}
                          </span>
                          <button
                            onClick={() => handleMuteFeature(member.user_id, featureKey, isMuted)}
                            disabled={isMuting}
                            className="p-1 rounded hover:bg-muted/50 transition-colors"
                            title={isMuted ? "Unmute feature" : "Mute feature"}
                          >
                            {isMuting ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : isMuted ? (
                              <EyeOff className="h-4 w-4 text-destructive" />
                            ) : (
                              <Eye className="h-4 w-4 text-success" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EngineRoom;

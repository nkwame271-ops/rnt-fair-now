import { useState, useEffect } from "react";
import { Settings, Power, Loader2, Info, DollarSign, Users, Building2, CreditCard, Shield, UserCog, Eye, EyeOff, Save, Cog, ToggleLeft, Plus, Trash2, X, UserX, Search, Archive } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAllFeatureFlags, invalidateFeatureFlags } from "@/hooks/useFeatureFlag";
import { useAdminProfile, FEATURE_ROUTE_MAP } from "@/hooks/useAdminProfile";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";
import LogoLoader from "@/components/LogoLoader";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

interface StaffMember {
  user_id: string;
  admin_type: string;
  office_name: string | null;
  allowed_features: string[];
  muted_features: string[];
  full_name?: string;
}

interface SplitConfig {
  id: string;
  payment_type: string;
  recipient: string;
  amount_type: string;
  amount: number;
  description: string;
  sort_order: number;
  is_platform_fee: boolean;
}

interface SecondarySplit {
  id: string;
  parent_recipient: string;
  sub_recipient: string;
  percentage: number;
  description: string;
}

interface RentBand {
  id: string;
  min_rent: number;
  max_rent: number | null;
  fee_amount: number;
  label: string | null;
}

interface BandAllocation {
  id: string;
  rent_band_id: string;
  payment_type: string;
  recipient: string;
  amount: number;
  description: string | null;
  sort_order: number;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  tenant_registration: "Tenant Registration",
  landlord_registration: "Landlord Registration",
  rent_card: "Rent Card",
  agreement_sale: "Agreement Sale",
  complaint_fee: "Complaint Fee",
  listing_fee: "Listing Fee",
  viewing_fee: "Viewing Fee",
  add_tenant_fee: "Add Tenant Fee",
  termination_fee: "Termination Fee",
  archive_search_fee: "Archive Search Fee",
  rent_tax: "Tax Revenue",
};

const RECIPIENT_LABELS: Record<string, string> = {
  platform: "Platform",
  rent_control: "IGF (Rent Control)",
  admin: "Admin",
  gra: "GRA",
  landlord: "Landlord",
};

const BAND_BASED_FEE_KEYS = new Set(["agreement_sale_fee", "add_tenant_fee"]);

const EngineRoom = () => {
  const { user } = useAuth();
  const { flags, loading, refetch } = useAllFeatureFlags();
  const { profile, loading: profileLoading } = useAdminProfile();
  const [toggling, setToggling] = useState<string | null>(null);
  const [editingFees, setEditingFees] = useState<Record<string, number>>({});
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [mutingStaff, setMutingStaff] = useState<string | null>(null);

  // Split engine state
  const [splitConfigs, setSplitConfigs] = useState<SplitConfig[]>([]);
  const [secondarySplits, setSecondarySplits] = useState<SecondarySplit[]>([]);
  const [splitLoading, setSplitLoading] = useState(false);
  const [editingSplits, setEditingSplits] = useState<Record<string, number>>({});
  const [editingSecondary, setEditingSecondary] = useState<Record<string, number>>({});
  const [savingSplit, setSavingSplit] = useState<string | null>(null);

  // Rent bands state
  const [rentBands, setRentBands] = useState<RentBand[]>([]);
  const [rentBandsLoading, setRentBandsLoading] = useState(false);
  const [editingBands, setEditingBands] = useState<Record<string, Partial<RentBand>>>({});
  const [savingBand, setSavingBand] = useState<string | null>(null);

  // Band allocations state
  const [bandAllocations, setBandAllocations] = useState<BandAllocation[]>([]);
  const [editingAllocations, setEditingAllocations] = useState<Record<string, number>>({});
  const [savingAllocation, setSavingAllocation] = useState<string | null>(null);
  const [expandedBand, setExpandedBand] = useState<string | null>(null);

  // Account Management state
  const [accountSearch, setAccountSearch] = useState("");
  const [accountType, setAccountType] = useState<"landlord" | "tenant" | "admin">("landlord");
  const [accountResult, setAccountResult] = useState<any>(null);
  const [accountSearching, setAccountSearching] = useState(false);
  const [accountAction, setAccountAction] = useState<{ action: string; targetId: string; accountType: string } | null>(null);

  // Adding features to staff
  const [addingFeature, setAddingFeature] = useState<string | null>(null);
  const [newFeatureKey, setNewFeatureKey] = useState("");

  // Fetch all admins for main admin view
  useEffect(() => {
    if (!profile?.isMainAdmin) return;
    const fetchStaff = async () => {
      setStaffLoading(true);
      const { data: staff } = await supabase
        .from("admin_staff")
        .select("user_id, admin_type, office_name, allowed_features, muted_features");

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

  // Fetch split configurations
  useEffect(() => {
    if (!profile?.isMainAdmin) return;
    const fetchSplits = async () => {
      setSplitLoading(true);
      const [{ data: splits }, { data: secondary }] = await Promise.all([
        supabase.from("split_configurations").select("*").order("payment_type").order("sort_order"),
        supabase.from("secondary_split_configurations").select("*").order("parent_recipient").order("sub_recipient"),
      ]);
      setSplitConfigs((splits as any[]) || []);
      setSecondarySplits((secondary as any[]) || []);
      setSplitLoading(false);
    };
    fetchSplits();
  }, [profile?.isMainAdmin]);

  // Fetch rent bands
  useEffect(() => {
    if (!profile?.isMainAdmin) return;
    const fetchBands = async () => {
      setRentBandsLoading(true);
      const [{ data }, { data: allocs }] = await Promise.all([
        supabase.from("rent_bands").select("*").order("min_rent"),
        supabase.from("rent_band_allocations").select("*").order("sort_order"),
      ]);
      setRentBands((data as any[]) || []);
      setBandAllocations((allocs as any[]) || []);
      setRentBandsLoading(false);
    };
    fetchBands();
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

  const handleAddFeatureToStaff = async (staffUserId: string, featureKey: string) => {
    const member = staffMembers.find(s => s.user_id === staffUserId);
    if (!member || member.allowed_features.includes(featureKey)) return;
    const newAllowed = [...member.allowed_features, featureKey];
    const { error } = await supabase
      .from("admin_staff")
      .update({ allowed_features: newAllowed, updated_at: new Date().toISOString() } as any)
      .eq("user_id", staffUserId);
    if (error) { toast.error("Failed to add feature"); }
    else {
      toast.success("Feature added");
      setStaffMembers(prev => prev.map(s => s.user_id === staffUserId ? { ...s, allowed_features: newAllowed } : s));
    }
    setAddingFeature(null);
    setNewFeatureKey("");
  };

  const handleRemoveFeatureFromStaff = async (staffUserId: string, featureKey: string) => {
    const member = staffMembers.find(s => s.user_id === staffUserId);
    if (!member) return;
    const newAllowed = member.allowed_features.filter(f => f !== featureKey);
    const newMuted = member.muted_features.filter(f => f !== featureKey);
    const { error } = await supabase
      .from("admin_staff")
      .update({ allowed_features: newAllowed, muted_features: newMuted, updated_at: new Date().toISOString() } as any)
      .eq("user_id", staffUserId);
    if (error) { toast.error("Failed to remove feature"); }
    else {
      toast.success("Feature removed");
      setStaffMembers(prev => prev.map(s => s.user_id === staffUserId ? { ...s, allowed_features: newAllowed, muted_features: newMuted } : s));
    }
  };

  const handleSaveSplitAmount = async (splitId: string, newAmount: number) => {
    setSavingSplit(splitId);
    const { error } = await supabase
      .from("split_configurations")
      .update({ amount: newAmount, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
      .eq("id", splitId);
    if (error) {
      toast.error("Failed to update split");
    } else {
      toast.success("Split amount updated");
      setSplitConfigs(prev => prev.map(s => s.id === splitId ? { ...s, amount: newAmount } : s));
      setEditingSplits(prev => { const n = { ...prev }; delete n[splitId]; return n; });
    }
    setSavingSplit(null);
  };

  const handleSaveSecondaryPercentage = async (splitId: string, newPct: number) => {
    setSavingSplit(splitId);
    const { error } = await supabase
      .from("secondary_split_configurations")
      .update({ percentage: newPct, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
      .eq("id", splitId);
    if (error) {
      toast.error("Failed to update");
    } else {
      toast.success("Percentage updated");
      setSecondarySplits(prev => prev.map(s => s.id === splitId ? { ...s, percentage: newPct } : s));
      setEditingSecondary(prev => { const n = { ...prev }; delete n[splitId]; return n; });
    }
    setSavingSplit(null);
  };

  const handleSaveBand = async (bandId: string) => {
    const edits = editingBands[bandId];
    if (!edits) return;
    setSavingBand(bandId);
    const { error } = await supabase
      .from("rent_bands")
      .update({ ...edits, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
      .eq("id", bandId);
    if (error) {
      toast.error("Failed to update rent band");
    } else {
      toast.success("Rent band updated");
      setRentBands(prev => prev.map(b => b.id === bandId ? { ...b, ...edits } : b));
      setEditingBands(prev => { const n = { ...prev }; delete n[bandId]; return n; });
    }
    setSavingBand(null);
  };

  const handleAddBand = async () => {
    const lastBand = rentBands[rentBands.length - 1];
    const newMin = lastBand ? (lastBand.max_rent ? lastBand.max_rent + 0.01 : 5000.01) : 0;
    const { data, error } = await supabase
      .from("rent_bands")
      .insert({ min_rent: newMin, max_rent: null, fee_amount: 50, label: `New Band`, updated_by: user?.id } as any)
      .select()
      .single();
    if (error) {
      toast.error("Failed to add band");
    } else if (data) {
      setRentBands(prev => [...prev, data as any]);
      toast.success("Rent band added");
    }
  };

  const handleDeleteBand = async (bandId: string) => {
    const { error } = await supabase.from("rent_bands").delete().eq("id", bandId);
    if (error) {
      toast.error("Failed to delete band");
    } else {
      setRentBands(prev => prev.filter(b => b.id !== bandId));
      toast.success("Rent band removed");
    }
  };

  const handleSaveAllocation = async (allocId: string, newAmount: number) => {
    setSavingAllocation(allocId);
    const { error } = await supabase
      .from("rent_band_allocations")
      .update({ amount: newAmount, updated_at: new Date().toISOString(), updated_by: user?.id } as any)
      .eq("id", allocId);
    if (error) {
      toast.error("Failed to update allocation");
    } else {
      toast.success("Allocation updated");
      setBandAllocations(prev => prev.map(a => a.id === allocId ? { ...a, amount: newAmount } : a));
      setEditingAllocations(prev => { const n = { ...prev }; delete n[allocId]; return n; });
    }
    setSavingAllocation(null);
  };

  // Account Management handlers
  const handleAccountSearch = async () => {
    if (!accountSearch.trim()) return;
    setAccountSearching(true);
    setAccountResult(null);

    if (accountType === "admin") {
      const { data: staffRecords } = await supabase.from("admin_staff").select("user_id, admin_type, office_name");
      if (staffRecords && staffRecords.length > 0) {
        const userIds = staffRecords.map((s: any) => s.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
        const match = (profiles || []).find((p: any) =>
          p.full_name?.toLowerCase().includes(accountSearch.trim().toLowerCase()) ||
          p.email?.toLowerCase().includes(accountSearch.trim().toLowerCase())
        );
        if (match) {
          const staff = staffRecords.find((s: any) => s.user_id === match.user_id) as any;
          setAccountResult({ userId: match.user_id, idCode: staff?.admin_type || "admin", name: match.full_name || "Unknown", email: match.email || "", accountStatus: "active", type: "admin", adminType: staff?.admin_type });
        } else { toast.error("No admin found"); }
      }
      setAccountSearching(false);
      return;
    }

    const table = accountType === "landlord" ? "landlords" : "tenants";
    const idField = accountType === "landlord" ? "landlord_id" : "tenant_id";
    const { data: records } = await supabase.from(table).select(`user_id, ${idField}, account_status`).ilike(idField, `%${accountSearch.trim()}%`).limit(1);

    if (records && records.length > 0) {
      const rec = records[0] as any;
      const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("user_id", rec.user_id).single();
      setAccountResult({ userId: rec.user_id, idCode: rec[idField], name: prof?.full_name || "Unknown", email: prof?.email || "", accountStatus: rec.account_status || "active", type: accountType });
    } else {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").ilike("full_name", `%${accountSearch.trim()}%`).limit(5);
      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          const { data: rec } = await supabase.from(table).select(`user_id, ${idField}, account_status`).eq("user_id", p.user_id).maybeSingle();
          if (rec) {
            setAccountResult({ userId: (rec as any).user_id, idCode: (rec as any)[idField], name: p.full_name, email: p.email || "", accountStatus: (rec as any).account_status || "active", type: accountType });
            break;
          }
        }
      }
      if (!accountResult) toast.error(`No ${accountType} found`);
    }
    setAccountSearching(false);
  };

  const handleAccountAction = async (password: string, reason: string) => {
    if (!accountAction) return;
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action: accountAction.action, target_id: accountAction.targetId, reason, password, extra: { account_type: accountAction.accountType } },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    toast.success("Account action completed");
    setAccountResult(null);
    setAccountSearch("");
  };


  const isMainAdmin = profile?.isMainAdmin ?? false;
  const isSubAdmin = profile && !profile.isMainAdmin;
  const { isVisible } = useModuleVisibility("engine_room");

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

  // Office payout mode flag
  const payoutModeFlag = flags.find(f => f.feature_key === "office_payout_mode");

  // Group splits by payment type
  const splitsByType = splitConfigs.reduce((acc, s) => {
    if (!acc[s.payment_type]) acc[s.payment_type] = [];
    acc[s.payment_type].push(s);
    return acc;
  }, {} as Record<string, SplitConfig[]>);

  // Group secondary splits
  const secondaryByParent = secondarySplits.reduce((acc, s) => {
    if (!acc[s.parent_recipient]) acc[s.parent_recipient] = [];
    acc[s.parent_recipient].push(s);
    return acc;
  }, {} as Record<string, SecondarySplit[]>);

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
            {BAND_BASED_FEE_KEYS.has(flag.feature_key) ? (
              <span className="text-xs text-muted-foreground italic mr-2">Amount set via Rent Bands</span>
            ) : (
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
            )}
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
            ? "Enable or disable platform features, manage fees, configure splits, and control staff access."
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

      {/* Office Payout Mode Toggle */}
      {isMainAdmin && payoutModeFlag && (
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <ToggleLeft className={`h-5 w-5 mt-0.5 ${payoutModeFlag.is_enabled ? "text-success" : "text-warning"}`} />
              <div>
                <h3 className="font-semibold text-card-foreground">Office Payout Mode</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {payoutModeFlag.is_enabled
                    ? "Auto Release — Office funds are released automatically after allocation."
                    : "Manual Approval — Office funds stay in escrow until a request is submitted and approved."}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    payoutModeFlag.is_enabled
                      ? "bg-success/10 text-success"
                      : "bg-warning/10 text-warning"
                  }`}>
                    {payoutModeFlag.is_enabled ? "Auto Release" : "Manual Approval"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {toggling === "office_payout_mode" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={payoutModeFlag.is_enabled}
                onCheckedChange={() => handleToggle("office_payout_mode", payoutModeFlag.is_enabled)}
                disabled={toggling === "office_payout_mode"}
              />
            </div>
          </div>
        </div>
      )}

      {/* Split Engine Configuration */}
      {isMainAdmin && isVisible("engine_room", "split_engine") && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <Cog className="h-5 w-5 text-primary" /> Split Engine
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Configure how each payment type is split among recipients. Changes apply to new transactions only.
          </p>

          {splitLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4">
              {Object.entries(splitsByType).map(([paymentType, splits]) => {
                const isPercentage = splits.some(s => s.amount_type === "percentage");
                const total = splits.reduce((s, r) => s + r.amount, 0);
                return (
                  <div key={paymentType} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-card-foreground">{PAYMENT_TYPE_LABELS[paymentType] || paymentType}</p>
                        <p className="text-xs text-muted-foreground">
                          {isPercentage ? `Total: ${total.toFixed(0)}%` : `Total: GH₵ ${total.toFixed(2)}`}
                        </p>
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {splits.map(split => {
                        const editKey = split.id;
                        const isEditing = editingSplits[editKey] !== undefined;
                        const splitIsPercentage = split.amount_type === "percentage";
                        return (
                          <div key={split.id} className="flex items-center justify-between px-4 py-3">
                            <div>
                              <span className="text-sm text-card-foreground">{split.description || RECIPIENT_LABELS[split.recipient] || split.recipient}</span>
                              {split.is_platform_fee && (
                                <Badge variant="outline" className="ml-2 text-[10px]">Fixed Fee</Badge>
                              )}
                              <span className="text-xs text-muted-foreground ml-2">→ {RECIPIENT_LABELS[split.recipient] || split.recipient}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {!splitIsPercentage && <span className="text-xs text-muted-foreground">GH₵</span>}
                              <Input
                                type="number"
                                min="0"
                                step={splitIsPercentage ? "1" : "0.5"}
                                max={splitIsPercentage ? "100" : undefined}
                                className="w-20 h-8 text-sm"
                                value={isEditing ? editingSplits[editKey] : split.amount}
                                onChange={e => setEditingSplits(prev => ({ ...prev, [editKey]: parseFloat(e.target.value) || 0 }))}
                              />
                              {splitIsPercentage && <span className="text-xs text-muted-foreground">%</span>}
                              {isEditing && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2"
                                  onClick={() => handleSaveSplitAmount(split.id, editingSplits[editKey])}
                                  disabled={savingSplit === split.id}
                                >
                                  {savingSplit === split.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Secondary Splits */}
              {Object.keys(secondaryByParent).length > 0 && (
                <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  <div className="p-4 border-b border-border">
                    <p className="font-semibold text-card-foreground">Secondary Splits (IGF & Admin Sub-Allocation)</p>
                    <p className="text-xs text-muted-foreground">How IGF and Admin shares are further distributed to Office, HQ, and Platform</p>
                  </div>
                  {Object.entries(secondaryByParent).map(([parent, subs]) => (
                    <div key={parent}>
                      <div className="px-4 py-2 bg-muted/30 border-b border-border">
                        <span className="text-sm font-medium text-card-foreground">{RECIPIENT_LABELS[parent] || parent}</span>
                      </div>
                      <div className="divide-y divide-border">
                        {subs.map(sub => {
                          const editKey = sub.id;
                          const isEditing = editingSecondary[editKey] !== undefined;
                          return (
                            <div key={sub.id} className="flex items-center justify-between px-4 py-3">
                              <span className="text-sm text-card-foreground capitalize">{sub.sub_recipient} — {sub.description || ""}</span>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="1"
                                  className="w-20 h-8 text-sm"
                                  value={isEditing ? editingSecondary[editKey] : sub.percentage}
                                  onChange={e => setEditingSecondary(prev => ({ ...prev, [editKey]: parseFloat(e.target.value) || 0 }))}
                                />
                                <span className="text-xs text-muted-foreground">%</span>
                                {isEditing && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2"
                                    onClick={() => handleSaveSecondaryPercentage(sub.id, editingSecondary[editKey])}
                                    disabled={savingSplit === sub.id}
                                  >
                                    {savingSplit === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  </Button>
                                )}
                              </div>
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
      )}

      {/* Rent Bands Configuration */}
      {isMainAdmin && isVisible("engine_room", "rent_bands") && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <DollarSign className="h-5 w-5 text-primary" /> Rent Bands
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Configure rent ranges and their corresponding tenancy registration fees. The system applies the correct fee based on the declared monthly rent.
          </p>

          {rentBandsLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <p className="font-semibold text-card-foreground">Rent Range → Fee</p>
                <Button size="sm" variant="outline" onClick={handleAddBand}>
                  <Plus className="h-3 w-3 mr-1" /> Add Band
                </Button>
              </div>
              <div className="divide-y divide-border">
                {rentBands.map(band => {
                  const edits = editingBands[band.id] || {};
                  const hasEdits = Object.keys(edits).length > 0;
                  return (
                    <div key={band.id} className="border-b border-border last:border-b-0">
                      <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Min:</span>
                          <Input type="number" min="0" step="0.01" className="w-24 h-8 text-sm" value={edits.min_rent ?? band.min_rent} onChange={e => setEditingBands(prev => ({ ...prev, [band.id]: { ...prev[band.id], min_rent: parseFloat(e.target.value) || 0 } }))} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Max:</span>
                          <Input type="number" min="0" step="0.01" className="w-24 h-8 text-sm" placeholder="∞" value={edits.max_rent !== undefined ? (edits.max_rent ?? "") : (band.max_rent ?? "")} onChange={e => { const val = e.target.value === "" ? null : parseFloat(e.target.value); setEditingBands(prev => ({ ...prev, [band.id]: { ...prev[band.id], max_rent: val } })); }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Fee: GH₵</span>
                          <Input type="number" min="0" step="1" className="w-20 h-8 text-sm" value={edits.fee_amount ?? band.fee_amount} onChange={e => setEditingBands(prev => ({ ...prev, [band.id]: { ...prev[band.id], fee_amount: parseFloat(e.target.value) || 0 } }))} />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">Label:</span>
                          <Input className="w-40 h-8 text-sm" value={edits.label !== undefined ? (edits.label ?? "") : (band.label ?? "")} onChange={e => setEditingBands(prev => ({ ...prev, [band.id]: { ...prev[band.id], label: e.target.value } }))} />
                        </div>
                        <div className="flex items-center gap-1 ml-auto">
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setExpandedBand(expandedBand === band.id ? null : band.id)}>
                            {expandedBand === band.id ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                            Splits
                          </Button>
                          {hasEdits && (
                            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => handleSaveBand(band.id)} disabled={savingBand === band.id}>
                              {savingBand === band.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => handleDeleteBand(band.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {/* Per-band allocation editor */}
                      {expandedBand === band.id && (() => {
                        const bandAllocs = bandAllocations.filter(a => a.rent_band_id === band.id);
                        const allocsByType = bandAllocs.reduce((acc, a) => {
                          if (!acc[a.payment_type]) acc[a.payment_type] = [];
                          acc[a.payment_type].push(a);
                          return acc;
                        }, {} as Record<string, BandAllocation[]>);
                        const types = Object.keys(allocsByType).length > 0 ? Object.keys(allocsByType) : ["agreement_sale", "add_tenant_fee"];
                        return (
                          <div className="bg-muted/30 px-4 py-3 space-y-3">
                            <p className="text-xs font-medium text-muted-foreground">Allocation splits for this band (must sum to GH₵ {band.fee_amount})</p>
                            {types.map(pt => {
                              const allocs = allocsByType[pt] || [];
                              const allocTotal = allocs.reduce((s, a) => s + (editingAllocations[a.id] ?? a.amount), 0);
                              const mismatch = Math.abs(allocTotal - band.fee_amount) > 0.02;
                              return (
                                <div key={pt} className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-card-foreground">{PAYMENT_TYPE_LABELS[pt] || pt}</span>
                                    <span className={`text-xs ${mismatch ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                      Total: GH₵ {allocTotal.toFixed(2)} {mismatch ? "⚠️ mismatch" : "✓"}
                                    </span>
                                  </div>
                                  {allocs.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic">No allocations configured for this type.</p>
                                  ) : allocs.map(alloc => {
                                    const isEditing = editingAllocations[alloc.id] !== undefined;
                                    return (
                                      <div key={alloc.id} className="flex items-center justify-between gap-2 pl-3">
                                        <span className="text-xs text-card-foreground">{alloc.description || RECIPIENT_LABELS[alloc.recipient] || alloc.recipient} → {RECIPIENT_LABELS[alloc.recipient] || alloc.recipient}</span>
                                        <div className="flex items-center gap-1">
                                          <span className="text-xs text-muted-foreground">GH₵</span>
                                          <Input type="number" min="0" step="0.5" className="w-20 h-7 text-xs" value={isEditing ? editingAllocations[alloc.id] : alloc.amount} onChange={e => setEditingAllocations(prev => ({ ...prev, [alloc.id]: parseFloat(e.target.value) || 0 }))} />
                                          {isEditing && (
                                            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleSaveAllocation(alloc.id, editingAllocations[alloc.id])} disabled={savingAllocation === alloc.id}>
                                              {savingAllocation === alloc.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
                {rentBands.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">No rent bands configured.</div>
                )}
              </div>
            </div>
          )}
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
            {generalFlags.filter(f => f.feature_key !== "office_payout_mode").map(renderFeatureRow)}
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


      {/* Account Management — Main Admin Only */}
      {isMainAdmin && isVisible("engine_room", "account_management") && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <UserX className="h-5 w-5 text-destructive" /> Account Management
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Search for and manage landlord, tenant, or admin accounts. Actions include deactivation, archival, and permanent deletion.
          </p>
          <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Account Type</span>
                <select className="h-10 rounded-md border border-border bg-background px-3 text-sm" value={accountType} onChange={e => setAccountType(e.target.value as any)}>
                  <option value="landlord">Landlord</option>
                  <option value="tenant">Tenant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex-1 space-y-1 min-w-[200px]">
                <span className="text-xs font-medium text-muted-foreground">Search</span>
                <Input placeholder={`Search by ${accountType === "admin" ? "name or email" : "ID code or name"}...`} value={accountSearch} onChange={e => setAccountSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAccountSearch()} />
              </div>
              <Button onClick={handleAccountSearch} disabled={accountSearching} variant="outline">
                {accountSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
              </Button>
            </div>

            {accountResult && (
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-card-foreground">{accountResult.name}</p>
                    <p className="text-xs text-muted-foreground">{accountResult.idCode} • {accountResult.email}</p>
                  </div>
                  <Badge variant="outline" className={accountResult.accountStatus === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>{accountResult.accountStatus}</Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {accountResult.accountStatus === "active" && (
                    <Button size="sm" variant="outline" onClick={() => setAccountAction({ action: "deactivate_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                      <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setAccountAction({ action: "archive_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setAccountAction({ action: "delete_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Permanently
                  </Button>
                </div>
              </div>
            )}
          </div>

          <AdminPasswordConfirm
            open={!!accountAction}
            onOpenChange={() => setAccountAction(null)}
            title={`${accountAction?.action?.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()) || "Account Action"}`}
            description={`This will ${accountAction?.action?.replace(/_/g, " ")} the selected ${accountAction?.accountType} account.`}
            actionLabel="Confirm"
            onConfirm={handleAccountAction}
          />
        </div>
      )}

      {/* Staff Feature Access — Main Admin only */}
      {isMainAdmin && isVisible("engine_room", "staff_permissions") && (
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-3">
            <UserCog className="h-5 w-5 text-primary" /> Staff Feature Access
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Manage feature access for all admins. Add or remove features, and mute/unmute visibility per staff member.
          </p>

          {staffLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : staffMembers.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-6 text-center text-muted-foreground text-sm">
              No admins have been invited yet.
            </div>
          ) : (
            <div className="space-y-4">
              {staffMembers.map(member => {
                const isAddingThis = addingFeature === member.user_id;
                const availableToAdd = Object.keys(FEATURE_ROUTE_MAP).filter(k => !member.allowed_features.includes(k));
                return (
                  <div key={member.user_id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-card-foreground">{member.full_name}</p>
                        <p className="text-xs text-muted-foreground">{member.office_name || "No office assigned"}</p>
                      </div>
                      <Badge variant={member.admin_type === "main_admin" ? "default" : "outline"} className="text-xs">
                        {member.admin_type === "main_admin" ? "Main Admin" : "Sub Admin"}
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                              <div className="flex items-center gap-1">
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
                                <button
                                  onClick={() => handleRemoveFeatureFromStaff(member.user_id, featureKey)}
                                  className="p-1 rounded hover:bg-destructive/10 transition-colors"
                                  title="Remove feature"
                                >
                                  <X className="h-3.5 w-3.5 text-destructive" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Add feature control */}
                      {isAddingThis ? (
                        <div className="flex gap-2 items-center">
                          <select
                            className="flex-1 h-9 rounded-md border border-border bg-background px-3 text-sm"
                            value={newFeatureKey}
                            onChange={(e) => setNewFeatureKey(e.target.value)}
                          >
                            <option value="">Select feature...</option>
                            {availableToAdd.map(k => (
                              <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
                            ))}
                          </select>
                          <Button size="sm" variant="outline" disabled={!newFeatureKey} onClick={() => handleAddFeatureToStaff(member.user_id, newFeatureKey)}>
                            Add
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setAddingFeature(null); setNewFeatureKey(""); }}>
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setAddingFeature(member.user_id)} className="w-full">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Add Feature
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EngineRoom;

import { useState, useEffect } from "react";
import { Shield, Eye, Save, Tag, Users, Calendar, Loader2, Plus, Trash2, Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { invalidateVisibilityCache } from "@/hooks/useModuleVisibility";
import { invalidateLabelCache } from "@/hooks/useFeatureLabel";
import PageTransition from "@/components/PageTransition";
import LogoLoader from "@/components/LogoLoader";

// Module → section definitions
const MODULE_SECTIONS: { module: string; label: string; sections: { key: string; label: string; level: string }[] }[] = [
  {
    module: "escrow", label: "Escrow & Revenue", sections: [
      { key: "total_revenue", label: "Total Revenue Card", level: "section" },
      { key: "revenue_by_type", label: "Revenue by Type", level: "section" },
      { key: "payment_pipeline", label: "Payment Pipeline Checklist", level: "section" },
      { key: "office_breakdown", label: "Office Level Breakdown", level: "section" },
      { key: "revenue_destination", label: "Revenue Breakdown by Destination", level: "section" },
      { key: "auto_release", label: "Auto Release Stats", level: "section" },
      { key: "manual_release", label: "Manual Release Stats", level: "section" },
      { key: "receipts", label: "Receipt Register", level: "section" },
    ],
  },
  {
    module: "rent_cards", label: "Rent Cards & Procurement", sections: [
      { key: "inventory_adjustment", label: "Inventory Adjustment", level: "button" },
      { key: "stock_correction", label: "Stock Correction", level: "button" },
      { key: "batch_revoke", label: "Batch Revoke", level: "button" },
      { key: "serial_reset", label: "Serial Reset", level: "button" },
      { key: "quota_reset", label: "Quota Reset", level: "button" },
      { key: "stock_cleanup", label: "Stock Cleanup Tools", level: "button" },
      { key: "procurement_tab", label: "Procurement Tab", level: "section" },
      { key: "admin_actions_tab", label: "Admin Actions Tab", level: "section" },
    ],
  },
  {
    module: "engine_room", label: "Engine Room", sections: [
      { key: "split_engine", label: "Split Engine Configuration", level: "section" },
      { key: "rent_bands", label: "Rent Bands Configuration", level: "section" },
      { key: "account_management", label: "Account Management", level: "section" },
      { key: "staff_permissions", label: "Staff Permissions", level: "section" },
    ],
  },
  {
    module: "analytics", label: "Analytics", sections: [
      { key: "full_dashboard", label: "Full Analytics Dashboard", level: "feature" },
    ],
  },
];

// Features that can be renamed across portals
const RENAMEABLE_FEATURES: { key: string; portal: string; defaultLabel: string }[] = [
  // Admin portal
  { key: "dashboard", portal: "admin", defaultLabel: "Overview" },
  { key: "tenants", portal: "admin", defaultLabel: "Tenants" },
  { key: "landlords", portal: "admin", defaultLabel: "Landlords" },
  { key: "properties", portal: "admin", defaultLabel: "Properties" },
  { key: "complaints", portal: "admin", defaultLabel: "Complaints" },
  { key: "agreements", portal: "admin", defaultLabel: "Agreements" },
  { key: "escrow", portal: "admin", defaultLabel: "Escrow & Revenue" },
  { key: "rent_cards", portal: "admin", defaultLabel: "Rent Cards" },
  { key: "analytics", portal: "admin", defaultLabel: "Analytics" },
  { key: "engine_room", portal: "admin", defaultLabel: "Engine Room" },
  { key: "kyc", portal: "admin", defaultLabel: "KYC Verification" },
  { key: "rent_assessments", portal: "admin", defaultLabel: "Rent Assessments" },
  { key: "rent_reviews", portal: "admin", defaultLabel: "Rent Reviews" },
  { key: "terminations", portal: "admin", defaultLabel: "Terminations" },
  { key: "sms_broadcast", portal: "admin", defaultLabel: "SMS Broadcast" },
  // Landlord portal
  { key: "register_property", portal: "landlord", defaultLabel: "Register Property" },
  { key: "manage_rent_cards", portal: "landlord", defaultLabel: "Manage Rent Cards" },
  { key: "existing_tenancy", portal: "landlord", defaultLabel: "Existing Tenancy" },
  { key: "add_tenant", portal: "landlord", defaultLabel: "Add Tenant" },
  { key: "agreements", portal: "landlord", defaultLabel: "Agreements" },
  { key: "ejection", portal: "landlord", defaultLabel: "Ejection Application" },
  // Tenant portal
  { key: "marketplace", portal: "tenant", defaultLabel: "Marketplace" },
  { key: "rent_checker", portal: "tenant", defaultLabel: "Rent Checker" },
  { key: "file_complaint", portal: "tenant", defaultLabel: "File Complaint" },
  { key: "legal_assistant", portal: "tenant", defaultLabel: "Legal Assistant" },
  { key: "payments", portal: "tenant", defaultLabel: "Payments" },
];

interface VisRule {
  id?: string;
  module_key: string;
  section_key: string;
  visibility: string;
  allowed_admin_ids: string[];
  label_override: string | null;
  level: string;
}

interface LabelOverride {
  id?: string;
  feature_key: string;
  portal: string;
  original_label: string;
  custom_label: string;
}

interface StaffRow {
  user_id: string;
  admin_type: string;
  office_name: string | null;
  full_name?: string;
  email?: string;
}

const SuperAdminDashboard = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading } = useAdminProfile();

  // Visibility config
  const [visRules, setVisRules] = useState<VisRule[]>([]);
  const [visLoading, setVisLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Labels
  const [labels, setLabels] = useState<LabelOverride[]>([]);
  const [labelEdits, setLabelEdits] = useState<Record<string, string>>({});
  const [labelSaving, setLabelSaving] = useState<string | null>(null);

  // Staff
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  // Platform config
  const [operationalDate, setOperationalDate] = useState("2025-04-07");
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: vis }, { data: lbls }, { data: staffData }, { data: config }] = await Promise.all([
        supabase.from("module_visibility_config").select("*"),
        supabase.from("feature_label_overrides").select("*"),
        supabase.from("admin_staff").select("user_id, admin_type, office_name"),
        supabase.from("platform_config").select("*").eq("config_key", "operational_start_date").maybeSingle(),
      ]);

      setVisRules((vis || []).map((v: any) => ({
        id: v.id,
        module_key: v.module_key,
        section_key: v.section_key,
        visibility: v.visibility,
        allowed_admin_ids: v.allowed_admin_ids || [],
        label_override: v.label_override,
        level: v.level,
      })));
      setVisLoading(false);

      setLabels((lbls || []).map((l: any) => ({
        id: l.id,
        feature_key: l.feature_key,
        portal: l.portal,
        original_label: l.original_label,
        custom_label: l.custom_label,
      })));

      // Fetch staff profiles
      if (staffData && staffData.length > 0) {
        const userIds = staffData.map((s: any) => s.user_id);
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
        const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, { name: p.full_name, email: p.email }]));
        setStaff(staffData.map((s: any) => ({
          ...s,
          full_name: nameMap.get(s.user_id)?.name || "Unknown",
          email: nameMap.get(s.user_id)?.email || "",
        })));
      }
      setStaffLoading(false);

      if (config) {
        const val = (config as any).config_value;
        setOperationalDate(typeof val === "string" ? val.replace(/"/g, "") : "2025-04-07");
      }
    };
    fetchAll();
  }, []);

  const getVisibility = (moduleKey: string, sectionKey: string): string => {
    const rule = visRules.find(r => r.module_key === moduleKey && r.section_key === sectionKey);
    return rule?.visibility || "all";
  };

  const handleVisibilityChange = async (moduleKey: string, sectionKey: string, level: string, newVis: string) => {
    const key = `${moduleKey}.${sectionKey}`;
    setSaving(key);

    const existing = visRules.find(r => r.module_key === moduleKey && r.section_key === sectionKey);

    if (existing?.id) {
      const { error } = await supabase
        .from("module_visibility_config")
        .update({ visibility: newVis, updated_by: user?.id, updated_at: new Date().toISOString() } as any)
        .eq("id", existing.id);
      if (error) toast.error("Failed to update");
      else {
        toast.success("Visibility updated");
        setVisRules(prev => prev.map(r => r.id === existing.id ? { ...r, visibility: newVis } : r));
        invalidateVisibilityCache();
      }
    } else {
      const { data, error } = await supabase
        .from("module_visibility_config")
        .insert({
          module_key: moduleKey,
          section_key: sectionKey,
          visibility: newVis,
          level,
          updated_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) toast.error("Failed to create rule");
      else if (data) {
        toast.success("Visibility rule created");
        setVisRules(prev => [...prev, { ...(data as any), allowed_admin_ids: [] }]);
        invalidateVisibilityCache();
      }
    }
    setSaving(null);
  };

  const handleLabelSave = async (featureKey: string, portal: string, originalLabel: string) => {
    const customLabel = labelEdits[`${featureKey}_${portal}`];
    if (!customLabel?.trim()) return;
    setLabelSaving(`${featureKey}_${portal}`);

    const existing = labels.find(l => l.feature_key === featureKey && l.portal === portal);

    if (existing?.id) {
      const { error } = await supabase
        .from("feature_label_overrides")
        .update({ custom_label: customLabel.trim(), updated_by: user?.id, updated_at: new Date().toISOString() } as any)
        .eq("id", existing.id);
      if (error) toast.error("Failed to update label");
      else {
        toast.success("Label updated");
        setLabels(prev => prev.map(l => l.id === existing.id ? { ...l, custom_label: customLabel.trim() } : l));
        invalidateLabelCache();
      }
    } else {
      const { data, error } = await supabase
        .from("feature_label_overrides")
        .insert({
          feature_key: featureKey,
          portal,
          original_label: originalLabel,
          custom_label: customLabel.trim(),
          updated_by: user?.id,
        } as any)
        .select()
        .single();
      if (error) toast.error("Failed to save label");
      else if (data) {
        toast.success("Label saved");
        setLabels(prev => [...prev, data as any]);
        invalidateLabelCache();
      }
    }
    setLabelEdits(prev => { const n = { ...prev }; delete n[`${featureKey}_${portal}`]; return n; });
    setLabelSaving(null);
  };

  const handleDeleteLabel = async (id: string) => {
    const { error } = await supabase.from("feature_label_overrides").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else {
      toast.success("Label reset to default");
      setLabels(prev => prev.filter(l => l.id !== id));
      invalidateLabelCache();
    }
  };

  const handlePromoteToSuperAdmin = async (userId: string) => {
    const { error } = await supabase
      .from("admin_staff")
      .update({ admin_type: "super_admin", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) toast.error("Failed to promote");
    else {
      toast.success("Promoted to Super Admin");
      setStaff(prev => prev.map(s => s.user_id === userId ? { ...s, admin_type: "super_admin" } : s));
    }
  };

  const handleDemoteFromSuperAdmin = async (userId: string) => {
    const { error } = await supabase
      .from("admin_staff")
      .update({ admin_type: "main_admin", updated_at: new Date().toISOString() } as any)
      .eq("user_id", userId);
    if (error) toast.error("Failed to demote");
    else {
      toast.success("Demoted to Main Admin");
      setStaff(prev => prev.map(s => s.user_id === userId ? { ...s, admin_type: "main_admin" } : s));
    }
  };

  const handleSaveOperationalDate = async () => {
    setConfigSaving(true);
    const { error } = await supabase
      .from("platform_config")
      .update({
        config_value: JSON.stringify(operationalDate),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("config_key", "operational_start_date");
    if (error) toast.error("Failed to save");
    else toast.success("Operational start date updated");
    setConfigSaving(false);
  };

  if (profileLoading) return <LogoLoader message="Loading..." />;

  if (!profile?.isSuperAdmin) {
    return (
      <PageTransition>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Shield className="h-12 w-12 text-destructive mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
          <p className="text-muted-foreground mt-2">This dashboard is restricted to Super Administrators only.</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-destructive" /> Super Admin Control Panel
          </h1>
          <p className="text-muted-foreground mt-1">
            Full platform control — manage visibility, labels, staff roles, and data baseline.
          </p>
        </div>

        <Tabs defaultValue="visibility">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="visibility"><Eye className="h-3.5 w-3.5 mr-1" /> Module Visibility</TabsTrigger>
            <TabsTrigger value="labels"><Tag className="h-3.5 w-3.5 mr-1" /> Feature Renaming</TabsTrigger>
            <TabsTrigger value="staff"><Users className="h-3.5 w-3.5 mr-1" /> Staff & Admins</TabsTrigger>
            <TabsTrigger value="data"><Calendar className="h-3.5 w-3.5 mr-1" /> Ledger & Data</TabsTrigger>
          </TabsList>

          {/* TAB 1: Module Visibility */}
          <TabsContent value="visibility">
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                  <Info className="h-4 w-4 text-primary" /> How Visibility Works
                </div>
                <p className="text-xs text-muted-foreground">
                  Set each section to <strong>All Admins</strong> (everyone sees it), <strong>Super Admin Only</strong> (only you), or <strong>Selected Admins</strong> (specific people). Sections without a rule default to visible for all.
                </p>
              </div>

              {visLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                MODULE_SECTIONS.map(mod => (
                  <div key={mod.module} className="bg-card rounded-xl p-5 border border-border space-y-3">
                    <h3 className="font-semibold text-foreground text-base">{mod.label}</h3>
                    <div className="space-y-2">
                      {mod.sections.map(sec => {
                        const vis = getVisibility(mod.module, sec.key);
                        const isSaving = saving === `${mod.module}.${sec.key}`;
                        return (
                          <div key={sec.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{sec.level}</Badge>
                              <span className="text-sm text-foreground">{sec.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                              <Select
                                value={vis}
                                onValueChange={(v) => handleVisibilityChange(mod.module, sec.key, sec.level, v)}
                              >
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="all">All Admins</SelectItem>
                                  <SelectItem value="super_admin_only">Super Admin Only</SelectItem>
                                  <SelectItem value="selected_admins">Selected Admins</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Feature Renaming */}
          <TabsContent value="labels">
            <div className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">
                  Rename any feature label across admin, landlord, or tenant portals. Changes only affect the displayed name — routing and logic stay the same.
                </p>
              </div>

              {["admin", "landlord", "tenant"].map(portal => {
                const features = RENAMEABLE_FEATURES.filter(f => f.portal === portal);
                if (features.length === 0) return null;
                return (
                  <div key={portal} className="bg-card rounded-xl p-5 border border-border space-y-3">
                    <h3 className="font-semibold text-foreground capitalize">{portal} Portal</h3>
                    <div className="space-y-2">
                      {features.map(feat => {
                        const existing = labels.find(l => l.feature_key === feat.key && l.portal === portal);
                        const editKey = `${feat.key}_${portal}`;
                        const isEditing = editKey in labelEdits;
                        const isSaving = labelSaving === editKey;

                        return (
                          <div key={editKey} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30 border border-border/50">
                            <span className="text-sm text-muted-foreground w-40 flex-shrink-0">{feat.defaultLabel}</span>
                            {existing && !isEditing ? (
                              <>
                                <Badge variant="secondary" className="text-xs">{existing.custom_label}</Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => setLabelEdits(prev => ({ ...prev, [editKey]: existing.custom_label }))}
                                >
                                  <Tag className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2 text-destructive"
                                  onClick={() => handleDeleteLabel(existing.id!)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <>
                                <Input
                                  className="h-8 text-sm flex-1"
                                  placeholder={`Rename "${feat.defaultLabel}"`}
                                  value={labelEdits[editKey] || ""}
                                  onChange={(e) => setLabelEdits(prev => ({ ...prev, [editKey]: e.target.value }))}
                                />
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={isSaving || !labelEdits[editKey]?.trim()}
                                  onClick={() => handleLabelSave(feat.key, portal, feat.defaultLabel)}
                                >
                                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                </Button>
                                {!existing && isEditing && (
                                  <Button variant="ghost" size="sm" className="h-8" onClick={() => setLabelEdits(prev => { const n = { ...prev }; delete n[editKey]; return n; })}>
                                    ✕
                                  </Button>
                                )}
                              </>
                            )}
                            {!existing && !isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 ml-auto"
                                onClick={() => setLabelEdits(prev => ({ ...prev, [editKey]: "" }))}
                              >
                                <Plus className="h-3 w-3 mr-1" /> Rename
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 3: Staff Management */}
          <TabsContent value="staff">
            <div className="space-y-4">
              {staffLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="bg-card rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Name</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                        <th className="text-left py-3 px-4 font-medium text-muted-foreground">Office</th>
                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map(s => (
                        <tr key={s.user_id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-4">
                            <div className="font-medium text-foreground">{s.full_name}</div>
                            <div className="text-xs text-muted-foreground">{s.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={s.admin_type === "super_admin" ? "destructive" : s.admin_type === "main_admin" ? "default" : "secondary"}>
                              {s.admin_type === "super_admin" ? "SUPER ADMIN" : s.admin_type === "main_admin" ? "ADMIN" : "STAFF"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{s.office_name || "—"}</td>
                          <td className="py-3 px-4 text-right">
                            {s.user_id !== user?.id && (
                              <>
                                {s.admin_type === "main_admin" && (
                                  <Button size="sm" variant="outline" className="text-xs" onClick={() => handlePromoteToSuperAdmin(s.user_id)}>
                                    Promote to Super Admin
                                  </Button>
                                )}
                                {s.admin_type === "super_admin" && (
                                  <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => handleDemoteFromSuperAdmin(s.user_id)}>
                                    Demote to Admin
                                  </Button>
                                )}
                              </>
                            )}
                            {s.user_id === user?.id && (
                              <span className="text-xs text-muted-foreground italic">You</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: Ledger & Data Controls */}
          <TabsContent value="data">
            <div className="space-y-6">
              <div className="bg-card rounded-xl p-6 border border-border space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" /> Operational Start Date
                </h3>
                <p className="text-sm text-muted-foreground">
                  All revenue reports, escrow calculations, reconciliation, and dashboard summaries will only include data from this date onward.
                  Data before this date is preserved but excluded from operational views.
                </p>
                <div className="flex items-end gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Start Date</Label>
                    <Input
                      type="date"
                      value={operationalDate}
                      onChange={(e) => setOperationalDate(e.target.value)}
                      className="w-48"
                    />
                  </div>
                  <Button onClick={handleSaveOperationalDate} disabled={configSaving}>
                    {configSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Save
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 border border-border">
                  <strong>Current baseline:</strong> {operationalDate} — All entries before this date are excluded from reports.
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border space-y-4">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" /> Payment Processor Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-foreground">1.95%</div>
                    <div className="text-xs text-muted-foreground mt-1">Processing Fee per Transaction</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-4 border border-border">
                    <div className="text-2xl font-bold text-foreground">GH₵ 1.00</div>
                    <div className="text-xs text-muted-foreground mt-1">Transfer Fee per Payout</div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  These charges are deducted by the payment processor before settlement. They are reflected in escrow views and downloadable reports.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default SuperAdminDashboard;

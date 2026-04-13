import { useState, useEffect, useCallback } from "react";
import { Shield, Eye, Save, Tag, Users, Calendar, Loader2, Plus, Trash2, Info, Activity, Lock, Ban, UserPlus, Pencil, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile, FEATURE_ROUTE_MAP } from "@/hooks/useAdminProfile";
import { invalidateVisibilityCache } from "@/hooks/useModuleVisibility";
import { invalidateLabelCache } from "@/hooks/useFeatureLabel";
import PageTransition from "@/components/PageTransition";
import LogoLoader from "@/components/LogoLoader";
import { ActivityLogsTab } from "@/components/ActivityLogsTab";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";


// Module → section definitions
const MODULE_SECTIONS: { module: string; label: string; sections: { key: string; label: string; level: string; group?: string }[] }[] = [
  {
    module: "escrow", label: "Escrow & Revenue", sections: [
      { key: "total_revenue", label: "Total Revenue Card", level: "section" },
      { key: "revenue_by_type", label: "Revenue by Type", level: "section" },
      // Revenue by Type sub-cards
      { key: "revenue_type_rent_card", label: "↳ Rent Card Sales", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_registrations", label: "↳ Registrations", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_termination", label: "↳ Quit Notices / Ejection", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_agreement", label: "↳ Tenancy Agreement", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_rent_tax", label: "↳ Rent Tax", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_complaint", label: "↳ Complaint Fee", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_listing", label: "↳ Listing Fee", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_viewing", label: "↳ Viewing Fee", level: "card", group: "Revenue by Type" },
      { key: "revenue_type_archive", label: "↳ Archive Search", level: "card", group: "Revenue by Type" },
      { key: "payment_pipeline", label: "Payment Pipeline Checklist", level: "section" },
      { key: "office_breakdown", label: "Office Level Breakdown", level: "section" },
      { key: "revenue_destination", label: "Revenue Breakdown by Destination", level: "section" },
      // Allocation Ledger sub-cards
      { key: "allocation_igf", label: "↳ IGF (Rent Control)", level: "card", group: "Allocation Ledger" },
      { key: "allocation_admin", label: "↳ Admin", level: "card", group: "Allocation Ledger" },
      { key: "allocation_platform", label: "↳ Platform", level: "card", group: "Allocation Ledger" },
      { key: "allocation_gra", label: "↳ GRA", level: "card", group: "Allocation Ledger" },
      { key: "allocation_landlord", label: "↳ Landlord (Held)", level: "card", group: "Allocation Ledger" },
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

// All feature keys with human-readable labels for checklist
const ALL_FEATURE_KEYS: { key: string; label: string }[] = Object.entries(FEATURE_ROUTE_MAP)
  .filter(([key]) => key !== "super_admin") // super_admin is not assignable
  .map(([key]) => {
    const labelMap: Record<string, string> = {
      dashboard: "Overview / Dashboard",
      tenants: "Tenants",
      landlords: "Landlords",
      properties: "Properties",
      complaints: "Complaints",
      applications: "Applications",
      agreements: "Agreements",
      agreement_templates: "Agreement Templates",
      rent_assessments: "Rent Assessments",
      terminations: "Terminations",
      rent_cards: "Rent Cards",
      escrow: "Escrow & Revenue",
      analytics: "Analytics",
      kyc: "KYC Verification",
      engine_room: "Engine Room",
      invite_staff: "Invite Staff",
      feedback: "Beta Feedback",
      support_chats: "Support Chats",
      sms_broadcast: "SMS Broadcast",
      api_keys: "Agency APIs",
      office_wallet: "Office Wallet",
      payout_settings: "Payout Settings",
      rent_reviews: "Rent Reviews",
      payment_errors: "Payment Errors",
    };
    return { key, label: labelMap[key] || key };
  });

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
  office_id: string | null;
  allowed_features: string[] | null;
  muted_features: string[] | null;
  full_name?: string;
  email?: string;
  last_login?: string | null;
  is_frozen?: boolean;
}

// Sort priority: super_admin first, then main_admin, then sub_admin
const staffSortOrder = (type: string) => type === "super_admin" ? 0 : type === "main_admin" ? 1 : 2;

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

  // Staff management
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<{ open: boolean; title: string; desc: string; label: string; onConfirm: (pw: string, reason: string) => Promise<void> }>({ open: false, title: "", desc: "", label: "", onConfirm: async () => {} });
  const [resetPwDialog, setResetPwDialog] = useState<{ open: boolean; userId: string; name: string }>({ open: false, userId: "", name: "" });
  const [newPassword, setNewPassword] = useState("");
  const [createStaffDialog, setCreateStaffDialog] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: "", full_name: "", password: "", phone: "", admin_type: "sub_admin", office_id: "", office_name: "" });
  const [createLoading, setCreateLoading] = useState(false);
  const [editFeaturesDialog, setEditFeaturesDialog] = useState<{ open: boolean; staff: StaffRow | null }>({ open: false, staff: null });
  const [editFeatures, setEditFeatures] = useState<string[]>([]);
  const [editMuted, setEditMuted] = useState<string[]>([]);
  const [editOffice, setEditOffice] = useState({ office_id: "", office_name: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);

  // Regulators tab
  const [expandedRegulator, setExpandedRegulator] = useState<string | null>(null);

  // Platform config
  const [operationalDate, setOperationalDate] = useState("2025-04-07");
  const [configSaving, setConfigSaving] = useState(false);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    const [{ data: staffData }, { data: officeData }] = await Promise.all([
      supabase.from("admin_staff").select("user_id, admin_type, office_name, office_id, allowed_features, muted_features"),
      supabase.from("offices").select("id, name"),
    ]);
    setOffices((officeData || []).map((o: any) => ({ id: o.id, name: o.name })));

    if (staffData && staffData.length > 0) {
      const userIds = staffData.map((s: any) => s.user_id);
      const [{ data: profiles }, { data: loginLogs }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds),
        supabase.from("admin_activity_log").select("user_id, created_at").eq("event_type", "login").in("user_id", userIds).order("created_at", { ascending: false }),
      ]);
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, { name: p.full_name, email: p.email }]));
      const loginMap = new Map<string, string>();
      (loginLogs || []).forEach((l: any) => { if (!loginMap.has(l.user_id)) loginMap.set(l.user_id, l.created_at); });

      const sorted = staffData.map((s: any) => ({
        ...s,
        full_name: nameMap.get(s.user_id)?.name || "Unknown",
        email: nameMap.get(s.user_id)?.email || "",
        last_login: loginMap.get(s.user_id) || null,
        muted_features: s.muted_features || [],
      })).sort((a: any, b: any) => staffSortOrder(a.admin_type) - staffSortOrder(b.admin_type));

      setStaff(sorted);
    }
    setStaffLoading(false);
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      const [{ data: vis }, { data: lbls }, { data: config }] = await Promise.all([
        supabase.from("module_visibility_config").select("*"),
        supabase.from("feature_label_overrides").select("*"),
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

      if (config) {
        const val = (config as any).config_value;
        setOperationalDate(typeof val === "string" ? val.replace(/"/g, "") : "2025-04-07");
      }

      await fetchStaff();
    };
    fetchAll();
  }, [fetchStaff]);

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
      setStaff(prev => prev.map(s => s.user_id === userId ? { ...s, admin_type: "super_admin" } : s).sort((a, b) => staffSortOrder(a.admin_type) - staffSortOrder(b.admin_type)));
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
      setStaff(prev => prev.map(s => s.user_id === userId ? { ...s, admin_type: "main_admin" } : s).sort((a, b) => staffSortOrder(a.admin_type) - staffSortOrder(b.admin_type)));
    }
  };

  const handleAdminAction = async (action: string, targetId: string, password: string, reason: string, extra?: any) => {
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action, target_id: targetId, password, reason, extra },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleFreezeStaff = (s: StaffRow) => {
    setConfirmAction({
      open: true,
      title: `Freeze ${s.full_name}'s Account`,
      desc: "This will prevent the user from logging in. You can unfreeze later.",
      label: "Freeze Account",
      onConfirm: async (pw, reason) => {
        await handleAdminAction("freeze_staff", s.user_id, pw, reason);
        toast.success("Account frozen");
        setStaff(prev => prev.map(x => x.user_id === s.user_id ? { ...x, is_frozen: true } : x));
      },
    });
  };

  const handleUnfreezeStaff = (s: StaffRow) => {
    setConfirmAction({
      open: true,
      title: `Unfreeze ${s.full_name}'s Account`,
      desc: "This will allow the user to log in again.",
      label: "Unfreeze Account",
      onConfirm: async (pw, reason) => {
        await handleAdminAction("unfreeze_staff", s.user_id, pw, reason);
        toast.success("Account unfrozen");
        setStaff(prev => prev.map(x => x.user_id === s.user_id ? { ...x, is_frozen: false } : x));
      },
    });
  };

  const handleDeleteStaff = (s: StaffRow) => {
    setConfirmAction({
      open: true,
      title: `Delete ${s.full_name}'s Account`,
      desc: "This will permanently remove this staff member. This action cannot be undone.",
      label: "Delete Account",
      onConfirm: async (pw, reason) => {
        await handleAdminAction("delete_account", s.user_id, pw, reason, { account_type: "admin" });
        toast.success("Account deleted");
        setStaff(prev => prev.filter(x => x.user_id !== s.user_id));
      },
    });
  };

  const handleCreateStaff = async () => {
    if (!newStaff.email || !newStaff.full_name || !newStaff.password || !newStaff.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreateLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          email: newStaff.email,
          fullName: newStaff.full_name,
          password: newStaff.password,
          adminType: newStaff.admin_type,
          officeId: newStaff.office_id || null,
          officeName: newStaff.office_name || null,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Staff member created successfully");
      setCreateStaffDialog(false);
      setNewStaff({ email: "", full_name: "", password: "", phone: "", admin_type: "sub_admin", office_id: "", office_name: "" });
      await fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Failed to create staff");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveStaffEdit = async () => {
    if (!editFeaturesDialog.staff) return;
    setEditSaving(true);
    try {
      const { error } = await supabase
        .from("admin_staff")
        .update({
          allowed_features: editFeatures.length > 0 ? editFeatures : null,
          muted_features: editMuted.length > 0 ? editMuted : null,
          office_id: editOffice.office_id || null,
          office_name: editOffice.office_name || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", editFeaturesDialog.staff.user_id);
      if (error) throw error;
      toast.success("Staff updated");
      setStaff(prev => prev.map(s =>
        s.user_id === editFeaturesDialog.staff!.user_id
          ? { ...s, allowed_features: editFeatures.length > 0 ? editFeatures : null, muted_features: editMuted.length > 0 ? editMuted : null, office_id: editOffice.office_id || null, office_name: editOffice.office_name || null }
          : s
      ));
      setEditFeaturesDialog({ open: false, staff: null });
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    } finally {
      setEditSaving(false);
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

  const openEditDialog = (s: StaffRow) => {
    setEditFeaturesDialog({ open: true, staff: s });
    setEditFeatures(s.allowed_features || []);
    setEditMuted(s.muted_features || []);
    setEditOffice({ office_id: s.office_id || "", office_name: s.office_name || "" });
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

  const regulators = staff.filter(s => s.admin_type === "main_admin" || s.admin_type === "super_admin");

  const renderStaffCard = (s: StaffRow, showActions = true) => {
    const isYou = s.user_id === user?.id;
    return (
      <div key={s.user_id} className={`bg-card rounded-xl border p-4 space-y-3 ${s.is_frozen ? "border-destructive/50 bg-destructive/5" : "border-border"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-foreground">{s.full_name}</span>
              {isYou && <Badge variant="outline" className="text-[10px]">You</Badge>}
              {s.is_frozen && <Badge variant="destructive" className="text-[10px]">FROZEN</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.email}</div>
          </div>
          <Badge className={s.admin_type === "super_admin" ? "bg-amber-500 text-white border-amber-600" : s.admin_type === "main_admin" ? "" : ""} variant={s.admin_type === "main_admin" ? "default" : s.admin_type === "sub_admin" ? "secondary" : "default"}>
            {s.admin_type === "super_admin" ? "SUPER ADMIN" : s.admin_type === "main_admin" ? "ADMIN" : "STAFF"}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>Office: <strong className="text-foreground">{s.office_name || "Headquarters"}</strong></span>
          <span>Last Login: <strong className="text-foreground">{s.last_login ? new Date(s.last_login).toLocaleString() : "Never"}</strong></span>
        </div>

        {s.allowed_features && s.allowed_features.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {s.allowed_features.slice(0, 5).map(f => (
              <Badge key={f} variant="outline" className="text-[10px]">{f}</Badge>
            ))}
            {s.allowed_features.length > 5 && (
              <Badge variant="outline" className="text-[10px]">+{s.allowed_features.length - 5} more</Badge>
            )}
          </div>
        )}

        {showActions && !isYou && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-border/50">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditDialog(s)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResetPwDialog({ open: true, userId: s.user_id, name: s.full_name || "" })}>
              <Lock className="h-3 w-3 mr-1" /> Reset Password
            </Button>
            {s.admin_type === "main_admin" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePromoteToSuperAdmin(s.user_id)}>
                Promote to Super Admin
              </Button>
            )}
            {s.admin_type === "super_admin" && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDemoteFromSuperAdmin(s.user_id)}>
                Demote to Admin
              </Button>
            )}
            {s.is_frozen ? (
              <Button size="sm" variant="outline" className="h-7 text-xs text-primary" onClick={() => handleUnfreezeStaff(s)}>
                <CheckCircle className="h-3 w-3 mr-1" /> Unfreeze
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="h-7 text-xs text-destructive/70" onClick={() => handleFreezeStaff(s)}>
                <Ban className="h-3 w-3 mr-1" /> Freeze
              </Button>
            )}
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDeleteStaff(s)}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="h-7 w-7 text-amber-500" /> Super Admin Control Panel
          </h1>
          <p className="text-muted-foreground mt-1">
            Full platform control — manage visibility, labels, staff roles, and data baseline.
          </p>
        </div>

        <Tabs defaultValue="visibility">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="visibility"><Eye className="h-3.5 w-3.5 mr-1" /> Module Visibility</TabsTrigger>
            <TabsTrigger value="labels"><Tag className="h-3.5 w-3.5 mr-1" /> Feature Renaming</TabsTrigger>
            <TabsTrigger value="regulators"><Shield className="h-3.5 w-3.5 mr-1" /> Regulators</TabsTrigger>
            <TabsTrigger value="staff"><Users className="h-3.5 w-3.5 mr-1" /> Staff & Admins</TabsTrigger>
            <TabsTrigger value="data"><Calendar className="h-3.5 w-3.5 mr-1" /> Ledger & Data</TabsTrigger>
            <TabsTrigger value="activity"><Activity className="h-3.5 w-3.5 mr-1" /> Activity Logs</TabsTrigger>
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
                        const rule = visRules.find(r => r.module_key === mod.module && r.section_key === sec.key);
                        const superAdmins = staff.filter(s => s.admin_type === "super_admin");
                        return (
                          <div key={sec.key} className="py-2 px-3 rounded-lg bg-muted/30 border border-border/50 space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                                  <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
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

                            {/* Show super admin emails when super_admin_only */}
                            {vis === "super_admin_only" && superAdmins.length > 0 && (
                              <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1.5">
                                <span className="font-medium text-amber-600">Super Admins:</span>{" "}
                                {superAdmins.map(sa => sa.email || sa.full_name).join(", ")}
                              </div>
                            )}

                            {/* Show admin multi-select picker when selected_admins */}
                            {vis === "selected_admins" && (
                              <div className="bg-background border border-border rounded-lg p-3 space-y-2">
                                <p className="text-xs font-medium text-muted-foreground">Select which admins can access this:</p>
                                <div className="max-h-48 overflow-y-auto space-y-1.5">
                                  {staff.filter(s => s.admin_type !== "super_admin").map(s => {
                                    const isChecked = rule?.allowed_admin_ids?.includes(s.user_id) || false;
                                    return (
                                      <label key={s.user_id} className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 cursor-pointer">
                                        <Checkbox
                                          checked={isChecked}
                                          onCheckedChange={async (checked) => {
                                            const newIds = checked
                                              ? [...(rule?.allowed_admin_ids || []), s.user_id]
                                              : (rule?.allowed_admin_ids || []).filter(id => id !== s.user_id);

                                            if (rule?.id) {
                                              await supabase
                                                .from("module_visibility_config")
                                                .update({ allowed_admin_ids: newIds, updated_by: user?.id, updated_at: new Date().toISOString() } as any)
                                                .eq("id", rule.id);
                                              setVisRules(prev => prev.map(r => r.id === rule.id ? { ...r, allowed_admin_ids: newIds } : r));
                                              invalidateVisibilityCache();
                                            }
                                          }}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <span className="text-sm text-foreground">{s.full_name}</span>
                                          {s.email && <span className="text-xs text-muted-foreground ml-1.5">({s.email})</span>}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] flex-shrink-0">{s.admin_type}</Badge>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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

          {/* TAB 3: Regulators */}
          <TabsContent value="regulators">
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">
                  All Admins and Super Admins on the platform. Click on a regulator to view and manage their feature access, muted features, and office assignment.
                </p>
              </div>

              {staffLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : regulators.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">No regulators found.</div>
              ) : (
                <div className="space-y-3">
                  {regulators.map(s => {
                    const isExpanded = expandedRegulator === s.user_id;
                    const isYou = s.user_id === user?.id;
                    return (
                      <div key={s.user_id} className="bg-card rounded-xl border border-border overflow-hidden">
                        <button
                          className="w-full p-4 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors text-left"
                          onClick={() => setExpandedRegulator(isExpanded ? null : s.user_id)}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-foreground">{s.full_name}</span>
                                {isYou && <Badge variant="outline" className="text-[10px]">You</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">{s.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className={s.admin_type === "super_admin" ? "bg-amber-500 text-white border-amber-600" : ""} variant={s.admin_type === "main_admin" ? "default" : "default"}>
                              {s.admin_type === "super_admin" ? "SUPER ADMIN" : "ADMIN"}
                            </Badge>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border p-4 space-y-4 bg-muted/10">
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-muted-foreground">Office:</span>{" "}
                                <strong className="text-foreground">{s.office_name || "Headquarters"}</strong>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Last Login:</span>{" "}
                                <strong className="text-foreground">{s.last_login ? new Date(s.last_login).toLocaleString() : "Never"}</strong>
                              </div>
                            </div>

                            <div>
                              <h4 className="text-sm font-semibold text-foreground mb-2">Feature Access</h4>
                              <div className="text-[10px] text-muted-foreground mb-2">
                                {(!s.allowed_features || s.allowed_features.length === 0)
                                  ? "✅ Unrestricted — has access to all features"
                                  : `Restricted to ${s.allowed_features.length} feature(s)`
                                }
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
                                {ALL_FEATURE_KEYS.map(feat => {
                                  const isAllowed = !s.allowed_features || s.allowed_features.length === 0 || s.allowed_features.includes(feat.key);
                                  const isMuted = s.muted_features?.includes(feat.key) || false;
                                  return (
                                    <div key={feat.key} className={`text-xs px-2 py-1.5 rounded border flex items-center gap-1.5 ${isAllowed && !isMuted ? "border-primary/30 bg-primary/5 text-foreground" : isMuted ? "border-destructive/30 bg-destructive/5 text-muted-foreground line-through" : "border-border bg-muted/20 text-muted-foreground"}`}>
                                      {isAllowed && !isMuted ? <CheckCircle className="h-3 w-3 text-primary shrink-0" /> : <Ban className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
                                      {feat.label}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {!isYou && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditDialog(s)}>
                                  <Pencil className="h-3 w-3 mr-1" /> Edit Features & Office
                                </Button>
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResetPwDialog({ open: true, userId: s.user_id, name: s.full_name || "" })}>
                                  <Lock className="h-3 w-3 mr-1" /> Reset Password
                                </Button>
                                {s.admin_type === "main_admin" && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePromoteToSuperAdmin(s.user_id)}>
                                    Promote to Super Admin
                                  </Button>
                                )}
                                {s.admin_type === "super_admin" && (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDemoteFromSuperAdmin(s.user_id)}>
                                    Demote to Admin
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: Staff Management */}
          <TabsContent value="staff">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">All Staff & Admins</h3>
                <Button size="sm" onClick={() => setCreateStaffDialog(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Create New Staff
                </Button>
              </div>

              {staffLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="space-y-3">
                  {staff.map(s => renderStaffCard(s))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 5: Ledger & Data Controls */}
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

          {/* TAB 6: Activity Logs */}
          <TabsContent value="activity">
            <ActivityLogsTab staff={staff} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Admin Password Confirm Dialog */}
      <AdminPasswordConfirm
        open={confirmAction.open}
        onOpenChange={(v) => { if (!v) setConfirmAction(prev => ({ ...prev, open: false })); }}
        title={confirmAction.title}
        description={confirmAction.desc}
        actionLabel={confirmAction.label}
        onConfirm={confirmAction.onConfirm}
      />

      {/* Reset Password Dialog */}
      <Dialog open={resetPwDialog.open} onOpenChange={(v) => { if (!v) { setResetPwDialog({ open: false, userId: "", name: "" }); setNewPassword(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" /> Reset Password — {resetPwDialog.name}
            </DialogTitle>
            <DialogDescription>Set a new password for this staff member.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-sm">New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 8 characters" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetPwDialog({ open: false, userId: "", name: "" }); setNewPassword(""); }}>Cancel</Button>
            <Button disabled={!newPassword || newPassword.length < 8} onClick={() => {
              setResetPwDialog(prev => ({ ...prev, open: false }));
              setConfirmAction({
                open: true,
                title: `Confirm Password Reset — ${resetPwDialog.name}`,
                desc: "Enter your admin password to confirm.",
                label: "Reset Password",
                onConfirm: async (pw, reason) => {
                  await handleAdminAction("reset_staff_password", resetPwDialog.userId, pw, reason, { new_password: newPassword });
                  toast.success("Password reset successfully");
                  setNewPassword("");
                },
              });
            }}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Staff Dialog */}
      <Dialog open={createStaffDialog} onOpenChange={setCreateStaffDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Create New Staff Member
            </DialogTitle>
            <DialogDescription>This will create a new admin account and send login credentials.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input value={newStaff.full_name} onChange={(e) => setNewStaff(prev => ({ ...prev, full_name: e.target.value }))} placeholder="John Doe" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone *</Label>
                <Input value={newStaff.phone} onChange={(e) => setNewStaff(prev => ({ ...prev, phone: e.target.value }))} placeholder="0241234567" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={newStaff.email} onChange={(e) => setNewStaff(prev => ({ ...prev, email: e.target.value }))} placeholder="staff@rcd.gov.gh" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Password *</Label>
              <Input type="password" value={newStaff.password} onChange={(e) => setNewStaff(prev => ({ ...prev, password: e.target.value }))} placeholder="Min 8 characters" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={newStaff.admin_type} onValueChange={(v) => setNewStaff(prev => ({ ...prev, admin_type: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sub_admin">Staff</SelectItem>
                    <SelectItem value="main_admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Office</Label>
                <Select value={newStaff.office_id} onValueChange={(v) => {
                  const office = offices.find(o => o.id === v);
                  setNewStaff(prev => ({ ...prev, office_id: v, office_name: office?.name || "" }));
                }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select office" /></SelectTrigger>
                  <SelectContent>
                    {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateStaffDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateStaff} disabled={createLoading || !newStaff.email || !newStaff.full_name || !newStaff.password || !newStaff.phone}>
              {createLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
              Create Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog — Checklist UI */}
      <Dialog open={editFeaturesDialog.open} onOpenChange={(v) => { if (!v) setEditFeaturesDialog({ open: false, staff: null }); }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit — {editFeaturesDialog.staff?.full_name}
            </DialogTitle>
            <DialogDescription>Update office assignment and feature permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1">
            <div className="space-y-1">
              <Label className="text-xs">Office</Label>
              <Select value={editOffice.office_id} onValueChange={(v) => {
                const office = offices.find(o => o.id === v);
                setEditOffice({ office_id: v, office_name: office?.name || "" });
              }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select office" /></SelectTrigger>
                <SelectContent>
                  {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Allowed Features</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditFeatures(ALL_FEATURE_KEYS.map(f => f.key))}>
                    Select All
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setEditFeatures([])}>
                    Clear All
                  </Button>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Empty = unrestricted access to all features.</p>
              <div className="border border-border rounded-lg p-3 max-h-52 overflow-y-auto space-y-1.5">
                {ALL_FEATURE_KEYS.map(feat => {
                  const isChecked = editFeatures.includes(feat.key);
                  return (
                    <div key={feat.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`feat-${feat.key}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) setEditFeatures(prev => [...prev, feat.key]);
                          else setEditFeatures(prev => prev.filter(f => f !== feat.key));
                        }}
                      />
                      <label htmlFor={`feat-${feat.key}`} className="text-xs text-foreground cursor-pointer flex-1">{feat.label}</label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Muted Features</Label>
              <p className="text-[10px] text-muted-foreground">Muted features are hidden even if allowed. Use to temporarily hide a feature.</p>
              <div className="border border-border rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
                {ALL_FEATURE_KEYS.map(feat => {
                  const isMuted = editMuted.includes(feat.key);
                  return (
                    <div key={feat.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-foreground">{feat.label}</span>
                      <Switch
                        checked={isMuted}
                        onCheckedChange={(checked) => {
                          if (checked) setEditMuted(prev => [...prev, feat.key]);
                          else setEditMuted(prev => prev.filter(f => f !== feat.key));
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditFeaturesDialog({ open: false, staff: null })}>Cancel</Button>
            <Button onClick={handleSaveStaffEdit} disabled={editSaving}>
              {editSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
};

export default SuperAdminDashboard;

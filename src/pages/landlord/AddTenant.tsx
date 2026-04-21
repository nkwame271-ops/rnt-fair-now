import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, CheckCircle2, FileText, ArrowLeft, Loader2, AlertTriangle, CreditCard, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TemplateConfig, CustomFieldDef } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/lib/notificationService";
import { useFeeConfig } from "@/hooks/useFeatureFlag";

type Step = "select-units" | "tenant-details" | "review" | "done";

interface UnitInfo {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  status: string;
}

interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  region: string;
  property_category?: string;
  units: UnitInfo[];
}

interface UnitDraft {
  unitId: string;
  tenantSearch: string;
  foundTenant: { name: string; tenantIdCode: string; userId: string } | null;
  searching: boolean;
  rent: string;
  advanceMonths: string;
  leaseDurationMonths: string;
  startDate: string;
  rentCardId1: string;
  rentCardId2: string;
  customFieldValues: Record<string, string>;
  registrationCode?: string;
  submitError?: string;
  submitted?: boolean;
}

const newDraft = (unit: UnitInfo): UnitDraft => ({
  unitId: unit.id,
  tenantSearch: "",
  foundTenant: null,
  searching: false,
  rent: unit.monthly_rent ? unit.monthly_rent.toString() : "",
  advanceMonths: "6",
  leaseDurationMonths: "12",
  startDate: new Date().toISOString().split("T")[0],
  rentCardId1: "",
  rentCardId2: "",
  customFieldValues: {},
});

const AddTenant = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const feeConfig = useFeeConfig("add_tenant_fee");
  const [rentBands, setRentBands] = useState<{ min_rent: number; max_rent: number | null; fee_amount: number }[]>([]);
  const [step, setStep] = useState<Step>("select-units");
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [landlordName, setLandlordName] = useState("");
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [availableRentCards, setAvailableRentCards] = useState<{ id: string; serial_number: string }[]>([]);
  const [batchResult, setBatchResult] = useState<{ created: { code: string; unit: string }[]; failed: { unit: string; error: string }[] } | null>(null);

  // Bulk-apply helper inputs
  const [bulkRent, setBulkRent] = useState("");
  const [bulkStartDate, setBulkStartDate] = useState("");

  const property = properties.find(p => p.id === selectedPropertyId);
  const vacantUnits = property?.units.filter(u => u.status === "vacant") ?? [];
  const selectedUnits = useMemo(() => {
    if (!property) return [] as UnitInfo[];
    return drafts
      .map(d => property.units.find(u => u.id === d.unitId))
      .filter((u): u is UnitInfo => !!u);
  }, [drafts, property]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [propsRes, profileRes, configRes, rentCardsRes, bandsRes] = await Promise.all([
        supabase.from("properties").select("id, property_name, address, region, property_category, units(id, unit_name, unit_type, monthly_rent, status)").eq("landlord_user_id", user.id).eq("assessment_status", "approved").in("property_status", ["approved", "live", "occupied"]),
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("agreement_template_config").select("*").limit(1).single(),
        supabase.from("rent_cards").select("id, serial_number").eq("landlord_user_id", user.id).eq("status", "valid"),
        supabase.from("rent_bands").select("min_rent, max_rent, fee_amount").eq("band_type", "add_tenant").order("min_rent"),
      ]);
      setProperties((propsRes.data || []) as PropertyWithUnits[]);
      setLandlordName(profileRes.data?.full_name || "");
      if (configRes.data) {
        setTemplateConfig(configRes.data as TemplateConfig);
        const cf = (configRes.data as any).custom_fields || [];
        setCustomFields(cf);
      }
      setAvailableRentCards((rentCardsRes.data || []) as { id: string; serial_number: string }[]);
      setRentBands((bandsRes.data || []) as { min_rent: number; max_rent: number | null; fee_amount: number }[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Restore form after Paystack redirect and auto-submit
  const [autoSubmitPending, setAutoSubmitPending] = useState(false);
  useEffect(() => {
    const ref = searchParams.get("reference") || searchParams.get("trxref") || sessionStorage.getItem("pendingPaymentReference");
    if (ref) {
      sessionStorage.removeItem("pendingPaymentReference");
      supabase.functions.invoke("verify-payment", { body: { reference: ref } })
        .then(({ data }) => {
          if (data?.verified) toast.success("Payment verified!");
          else toast.info("Payment is being processed.");
        })
        .catch(() => toast.info("Payment is being processed."));
    }

    if (searchParams.get("status") === "fee_paid" || ref) {
      const saved = sessionStorage.getItem("addTenantFormData");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setSelectedPropertyId(data.selectedPropertyId || "");
          setDrafts(data.drafts || []);
          setStep("review");
          setAutoSubmitPending(true);
          sessionStorage.removeItem("addTenantFormData");
          toast.success("Fee paid! Submitting your tenancies...");
        } catch { /* ignore */ }
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    if (autoSubmitPending && drafts.length > 0 && !loading) {
      setAutoSubmitPending(false);
      setTimeout(() => handleSubmitBatch(), 600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitPending, drafts, loading]);

  const resolveTaxRate = () => {
    const taxRates = (templateConfig as any)?.tax_rates;
    if (taxRates && property) {
      const category = property.property_category || "residential";
      if (category === "commercial" && taxRates.commercial != null) return taxRates.commercial / 100;
      if (taxRates.residential != null) return taxRates.residential / 100;
    }
    return (templateConfig?.tax_rate ?? 8) / 100;
  };
  const taxRate = resolveTaxRate();
  const maxAdvance = templateConfig?.max_advance_months ?? 6;
  const maxLease = templateConfig?.max_lease_duration ?? 24;
  const minLease = templateConfig?.min_lease_duration ?? 1;

  // Rent card pool — exclude cards used by other drafts
  const usedCardIds = useMemo(() => {
    const s = new Set<string>();
    drafts.forEach(d => {
      if (d.rentCardId1) s.add(d.rentCardId1);
      if (d.rentCardId2) s.add(d.rentCardId2);
    });
    return s;
  }, [drafts]);

  const cardsAvailableFor = (draft: UnitDraft, slot: 1 | 2) => {
    return availableRentCards.filter(rc => {
      if (rc.id === (slot === 1 ? draft.rentCardId1 : draft.rentCardId2)) return true;
      return !usedCardIds.has(rc.id);
    });
  };

  const bandFeeFor = (rent: number) => {
    if (!feeConfig.enabled || rentBands.length === 0) return feeConfig.amount;
    const band = rentBands.find(b => rent >= b.min_rent && (b.max_rent === null || rent <= b.max_rent));
    return band ? band.fee_amount : feeConfig.amount;
  };
  const totalFee = useMemo(() => drafts.reduce((s, d) => s + bandFeeFor(parseFloat(d.rent) || 0), 0), [drafts, feeConfig, rentBands]);

  const computeEndDate = (start: string, months: string) => {
    if (!start || !months) return "";
    const d = new Date(start);
    d.setMonth(d.getMonth() + parseInt(months));
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  const generateRegistrationCode = () => `RC-GR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

  const toggleUnitSelected = (unit: UnitInfo) => {
    setDrafts(prev => {
      const exists = prev.find(d => d.unitId === unit.id);
      if (exists) return prev.filter(d => d.unitId !== unit.id);
      return [...prev, newDraft(unit)];
    });
  };

  const updateDraft = (unitId: string, patch: Partial<UnitDraft>) => {
    setDrafts(prev => prev.map(d => d.unitId === unitId ? { ...d, ...patch } : d));
  };

  const applyBulkToAll = () => {
    setDrafts(prev => prev.map(d => ({
      ...d,
      ...(bulkRent ? { rent: bulkRent } : {}),
      ...(bulkStartDate ? { startDate: bulkStartDate } : {}),
    })));
    toast.success("Applied to all units");
  };

  const handleSearchTenant = async (draft: UnitDraft) => {
    if (!draft.tenantSearch.trim()) return;
    updateDraft(draft.unitId, { searching: true, foundTenant: null });
    try {
      const q = draft.tenantSearch.trim();
      const { data: tenants } = await supabase
        .from("tenants")
        .select("user_id, tenant_id")
        .ilike("tenant_id", `%${q}%`);

      if (tenants && tenants.length > 0) {
        const t = tenants[0];
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", t.user_id).single();
        updateDraft(draft.unitId, { foundTenant: { name: profile?.full_name || "Unknown", tenantIdCode: t.tenant_id, userId: t.user_id } });
        toast.success(`Found: ${profile?.full_name}`);
      } else {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .ilike("full_name", `%${q}%`);
        if (profiles && profiles.length > 0) {
          const p = profiles[0];
          const { data: tenant } = await supabase.from("tenants").select("tenant_id").eq("user_id", p.user_id).single();
          if (tenant) {
            updateDraft(draft.unitId, { foundTenant: { name: p.full_name, tenantIdCode: tenant.tenant_id, userId: p.user_id } });
            toast.success(`Found: ${p.full_name} (${tenant.tenant_id})`);
          } else {
            toast.error("User found but not registered as tenant");
          }
        } else {
          toast.error("No tenant found");
        }
      }
    } catch {
      toast.error("Search failed");
    } finally {
      updateDraft(draft.unitId, { searching: false });
    }
  };

  // Per-draft validation
  const validateDraft = (d: UnitDraft): string | null => {
    if (!d.foundTenant) return "Select a tenant";
    const r = parseFloat(d.rent) || 0;
    if (r <= 0) return "Enter monthly rent";
    if (parseInt(d.advanceMonths) > 6) return "Advance exceeds 6-month legal limit";
    if (!d.rentCardId1 || !d.rentCardId2) return "Select both rent cards";
    if (d.rentCardId1 === d.rentCardId2) return "Rent cards must be different";
    for (const f of customFields) {
      if (f.required && !d.customFieldValues[f.label]?.trim()) return `Missing: ${f.label}`;
    }
    return null;
  };

  const allValid = drafts.length > 0 && drafts.every(d => !validateDraft(d));
  const cardsNeeded = drafts.length * 2;
  const enoughCards = availableRentCards.length >= cardsNeeded;

  const handlePayFee = async () => {
    if (!user) return;
    sessionStorage.setItem("addTenantFormData", JSON.stringify({ selectedPropertyId, drafts }));
    try {
      // Send per-unit items so the server compounds fees strictly per unit (each unit's own band)
      const items = drafts.map(d => ({ monthlyRent: parseFloat(d.rent) || 0, unitId: d.unitId }));
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: {
          type: "add_tenant_fee",
          items,
          unitIds: drafts.map(d => d.unitId),
        },
      });
      if (error) throw error;
      if (data?.skipped) {
        sessionStorage.removeItem("addTenantFormData");
        toast.success(data.message || "Fee waived");
        handleSubmitBatch();
        return;
      }
      if (data?.authorization_url) {
        if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      sessionStorage.removeItem("addTenantFormData");
      toast.error(err.message || "Payment failed");
    }
  };

  const submitOneDraft = async (draft: UnitDraft, unit: UnitInfo): Promise<{ code: string }> => {
    if (!user || !property || !draft.foundTenant) throw new Error("Missing data");
    const monthlyRent = parseFloat(draft.rent) || 0;
    const tax = monthlyRent * taxRate;
    const toLandlord = monthlyRent * (1 - taxRate);
    const months = parseInt(draft.advanceMonths);
    const endDate = computeEndDate(draft.startDate, draft.leaseDurationMonths);

    let regCode = generateRegistrationCode();
    let tenancy: any = null;
    let attempts = 0;
    while (attempts < 5) {
      const { data, error } = await supabase.from("tenancies").insert({
        tenant_user_id: draft.foundTenant.userId,
        landlord_user_id: user.id,
        unit_id: unit.id,
        tenant_id_code: draft.foundTenant.tenantIdCode,
        registration_code: regCode,
        agreed_rent: monthlyRent,
        advance_months: months,
        start_date: draft.startDate,
        end_date: endDate,
        move_in_date: draft.startDate,
        status: "pending",
        landlord_accepted: true,
        tenant_accepted: false,
        custom_field_values: draft.customFieldValues,
        rent_card_id: draft.rentCardId1,
        landlord_signed_at: new Date().toISOString(),
      } as any).select().single();
      if (error) {
        if (error.message?.includes("tenancies_registration_code_unique") && attempts < 4) {
          regCode = generateRegistrationCode();
          attempts++;
          continue;
        }
        throw error;
      }
      tenancy = data;
      break;
    }
    if (!tenancy) throw new Error("Failed to create tenancy");

    await supabase.from("tenancy_signatures").insert({
      tenancy_id: tenancy.id,
      signer_user_id: user.id,
      signer_role: "landlord",
      signature_method: "auto",
      device_info: { userAgent: navigator.userAgent, platform: navigator.platform },
      signed_at: new Date().toISOString(),
      signature_hash: btoa(`${tenancy.id}:${user.id}:landlord:${Date.now()}`),
    } as any);

    const cardActivationData = {
      status: "active",
      tenancy_id: tenancy.id,
      activated_at: new Date().toISOString(),
      tenant_user_id: draft.foundTenant.userId,
      property_id: property.id,
      unit_id: unit.id,
      start_date: draft.startDate,
      expiry_date: endDate,
      current_rent: monthlyRent,
      previous_rent: 0,
      max_advance: maxAdvance,
      advance_paid: months,
      last_payment_status: "pending",
    };
    await Promise.all([
      supabase.from("rent_cards").update({ ...cardActivationData, card_role: "landlord_copy" } as any).eq("id", draft.rentCardId1),
      supabase.from("rent_cards").update({ ...cardActivationData, card_role: "tenant_copy" } as any).eq("id", draft.rentCardId2),
    ]);
    await supabase.from("tenancies").update({ rent_card_id_2: draft.rentCardId2 } as any).eq("id", tenancy.id);

    const totalMonths = parseInt(draft.leaseDurationMonths);
    const payments = [];
    for (let i = 0; i < totalMonths; i++) {
      const d = new Date(draft.startDate);
      d.setMonth(d.getMonth() + i);
      payments.push({
        tenancy_id: tenancy.id,
        month_label: d.toLocaleString("en-US", { month: "long", year: "numeric" }),
        due_date: d.toISOString().split("T")[0],
        monthly_rent: monthlyRent,
        tax_amount: tax,
        amount_to_landlord: toLandlord,
        status: "pending",
      });
    }
    const { error: pErr } = await supabase.from("rent_payments").insert(payments);
    if (pErr) throw pErr;

    await supabase.from("units").update({ status: "occupied" }).eq("id", unit.id);

    await supabase.from("property_events").insert({
      property_id: property.id,
      event_type: "status_change",
      old_value: { status: "live" },
      new_value: { status: "occupied" },
      performed_by: user.id,
      reason: `Tenancy created for unit ${unit.unit_name}`,
    } as any);

    // Notifications
    const propName = property?.property_name || property?.address || "Property";
    const [{ data: tenantProfile }, { data: landlordProfile }] = await Promise.all([
      supabase.from("profiles").select("phone, email, full_name").eq("user_id", draft.foundTenant.userId).maybeSingle(),
      supabase.from("profiles").select("phone, email, full_name").eq("user_id", user.id).maybeSingle(),
    ]);
    sendNotification("tenancy_registered", {
      phone: tenantProfile?.phone || undefined,
      email: tenantProfile?.email || undefined,
      user_id: draft.foundTenant.userId,
      data: { name: tenantProfile?.full_name || "", tenancy_id: regCode, property: propName },
    });
    sendNotification("tenancy_registered", {
      phone: landlordProfile?.phone || undefined,
      email: landlordProfile?.email || undefined,
      user_id: user.id,
      data: { name: landlordProfile?.full_name || "", tenancy_id: regCode, property: propName },
    });

    return { code: regCode };
  };

  const handleSubmitBatch = async () => {
    if (!user || !property) return;
    if (drafts.length === 0) return;
    setSubmitting(true);
    const created: { code: string; unit: string }[] = [];
    const failed: { unit: string; error: string }[] = [];

    // Verify fee paid (only if needed)
    if (feeConfig.enabled && totalFee > 0) {
      const { data: paidTx } = await supabase
        .from("escrow_transactions")
        .select("id")
        .eq("user_id", user.id)
        .eq("payment_type", "add_tenant_fee")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);
      if (!paidTx || paidTx.length === 0) {
        toast.error("Payment required. Please pay first.");
        setSubmitting(false);
        return;
      }
    }

    for (const draft of drafts) {
      if (draft.submitted) continue;
      const unit = property.units.find(u => u.id === draft.unitId);
      if (!unit) {
        failed.push({ unit: "Unknown", error: "Unit not found" });
        continue;
      }
      try {
        const { code } = await submitOneDraft(draft, unit);
        created.push({ code, unit: unit.unit_name });
        updateDraft(draft.unitId, { submitted: true, registrationCode: code, submitError: undefined });
      } catch (err: any) {
        failed.push({ unit: unit.unit_name, error: err.message || "Failed" });
        updateDraft(draft.unitId, { submitError: err.message || "Failed" });
      }
    }

    // Update property status if fully occupied
    try {
      const { data: u } = await supabase.from("units").select("status").eq("property_id", property.id);
      const allOccupied = (u || []).every(x => x.status === "occupied");
      if (allOccupied) {
        await supabase.from("properties").update({ property_status: "occupied" } as any).eq("id", property.id);
      }
    } catch { /* ignore */ }

    // Office attribution (single fee transaction covers batch)
    try {
      const { data: escrowData } = await supabase
        .from("escrow_transactions")
        .select("id, office_id")
        .eq("user_id", user.id)
        .eq("payment_type", "add_tenant_fee")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: propOffice } = await supabase
        .from("properties").select("office_id").eq("id", property.id).maybeSingle();
      const resolvedOfficeId = propOffice?.office_id || escrowData?.office_id;
      if (escrowData?.id && resolvedOfficeId) {
        await supabase.functions.invoke("finalize-office-attribution", {
          body: { escrow_transaction_id: escrowData.id, office_id: resolvedOfficeId },
        });
      }
    } catch (e: any) {
      console.warn("Office attribution deferred:", e.message);
    }

    setBatchResult({ created, failed });
    setStep("done");
    setSubmitting(false);
    if (failed.length === 0) toast.success(`${created.length} tenancies created!`);
    else toast.warning(`${created.length} of ${drafts.length} created. ${failed.length} failed.`);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/landlord/my-properties" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add New Tenants</h1>
          <p className="text-muted-foreground mt-1">Register one or many tenancies under a property in a single flow</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {["Select Units", "Tenant Details", "Review & Pay"].map((s, i) => {
          const steps: Step[] = ["select-units", "tenant-details", "review"];
          const currentIdx = steps.indexOf(step === "done" ? "review" : step);
          const isActive = i <= currentIdx;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`h-0.5 w-6 ${isActive ? "bg-primary" : "bg-muted"}`} />}
              <span className={`px-2.5 py-1 rounded-full ${isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i + 1}. {s}
              </span>
            </div>
          );
        })}
      </div>

      {/* Step 1: Select property + multi-unit checkboxes */}
      {step === "select-units" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Units</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered yet. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.</p>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Property</Label>
                <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setDrafts([]); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.property_name || "Unnamed"} — {p.address}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {property && (
                <div className="space-y-3">
                  <Label>Vacant Units (select one or more)</Label>
                  {vacantUnits.length === 0 ? (
                    <p className="text-sm text-warning">No vacant units in this property.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {vacantUnits.map((u) => {
                        const checked = drafts.some(d => d.unitId === u.id);
                        return (
                          <label key={u.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                            <Checkbox checked={checked} onCheckedChange={() => toggleUnitSelected(u)} className="mt-0.5" />
                            <div className="flex-1">
                              <div className="text-sm font-semibold text-card-foreground">{u.unit_name}</div>
                              <div className="text-xs text-muted-foreground">{u.unit_type} · GH₵ {u.monthly_rent.toLocaleString()}/mo</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {drafts.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm flex items-center justify-between">
                  <span className="text-muted-foreground">{drafts.length} unit(s) selected · {cardsNeeded} rent card(s) required</span>
                  <span className={`font-semibold ${enoughCards ? "text-success" : "text-destructive"}`}>{availableRentCards.length} available</span>
                </div>
              )}

              {drafts.length > 0 && !enoughCards && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">Not Enough Rent Cards</p>
                    <p className="text-xs text-muted-foreground mt-1">You need {cardsNeeded} cards (2 per unit). You have {availableRentCards.length}.</p>
                    <Link to="/landlord/manage-rent-cards"><Button size="sm" variant="outline" className="mt-2">Buy Rent Cards</Button></Link>
                  </div>
                </div>
              )}

              <Button disabled={drafts.length === 0 || !enoughCards} onClick={() => setStep("tenant-details")}>
                Next: Tenant Details ({drafts.length})
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Step 2: Per-unit tenant + terms + cards */}
      {step === "tenant-details" && property && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Bulk-apply helper */}
          <div className="bg-card rounded-xl p-4 border border-border space-y-3">
            <p className="text-sm font-semibold text-card-foreground">Bulk apply to all units (optional)</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Input type="number" placeholder="Rent (GH₵)" value={bulkRent} onChange={(e) => setBulkRent(e.target.value)} />
              <Input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} />
              <Button variant="outline" onClick={applyBulkToAll} disabled={!bulkRent && !bulkStartDate}>Apply to all</Button>
            </div>
          </div>

          {selectedUnits.map((unit) => {
            const draft = drafts.find(d => d.unitId === unit.id)!;
            const err = validateDraft(draft);
            const expanded = expandedUnits.has(unit.id) || drafts.length === 1;
            const endDate = computeEndDate(draft.startDate, draft.leaseDurationMonths);
            const monthlyRent = parseFloat(draft.rent) || 0;
            return (
              <div key={unit.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (drafts.length === 1) return;
                    setExpandedUnits(prev => {
                      const n = new Set(prev);
                      if (n.has(unit.id)) n.delete(unit.id); else n.add(unit.id);
                      return n;
                    });
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {err ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    )}
                    <div className="text-left">
                      <div className="font-semibold text-card-foreground text-sm">{unit.unit_name}</div>
                      <div className="text-xs text-muted-foreground">{err || `${draft.foundTenant?.name || "—"} · GH₵ ${monthlyRent.toLocaleString()}/mo`}</div>
                    </div>
                  </div>
                  {drafts.length > 1 && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </button>

                {expanded && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    {/* Tenant search */}
                    <div className="space-y-2">
                      <Label>Tenant ID or Name</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. TN-2026-0001 or Kwame Mensah"
                          value={draft.tenantSearch}
                          onChange={(e) => updateDraft(unit.id, { tenantSearch: e.target.value, foundTenant: null })}
                        />
                        <Button variant="outline" onClick={() => handleSearchTenant(draft)} disabled={!draft.tenantSearch.trim() || draft.searching}>
                          <Search className="h-4 w-4 mr-1" />{draft.searching ? "..." : "Search"}
                        </Button>
                      </div>
                      {draft.foundTenant && (
                        <div className="bg-success/5 border border-success/20 rounded p-2 text-xs flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="font-semibold">{draft.foundTenant.name}</span>
                          <span className="text-muted-foreground">({draft.foundTenant.tenantIdCode})</span>
                        </div>
                      )}
                    </div>

                    {/* Terms */}
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Monthly Rent (GH₵)</Label>
                        <Input type="number" value={draft.rent} onChange={(e) => updateDraft(unit.id, { rent: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Advance (months)</Label>
                        <Select value={draft.advanceMonths} onValueChange={(v) => updateDraft(unit.id, { advanceMonths: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxAdvance }, (_, i) => i + 1).map((m) => (
                              <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Lease Duration</Label>
                        <Select value={draft.leaseDurationMonths} onValueChange={(v) => updateDraft(unit.id, { leaseDurationMonths: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: maxLease }, (_, i) => i + 1).filter(m => m >= minLease).map((m) => (
                              <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Start Date</Label>
                        <Input type="date" value={draft.startDate} onChange={(e) => updateDraft(unit.id, { startDate: e.target.value })} />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">End Date</Label>
                        <Input type="date" value={endDate} readOnly className="bg-muted" />
                      </div>
                    </div>

                    {/* Custom fields */}
                    {customFields.length > 0 && (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {customFields.map((f) => (
                          <div key={f.label} className="space-y-1">
                            <Label className="text-xs">{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                            <Input
                              type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                              value={draft.customFieldValues[f.label] || ""}
                              onChange={(e) => updateDraft(unit.id, { customFieldValues: { ...draft.customFieldValues, [f.label]: e.target.value } })}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rent cards */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div className="space-y-1">
                        <Label className="text-xs">Landlord Copy</Label>
                        <Select value={draft.rentCardId1} onValueChange={(v) => updateDraft(unit.id, { rentCardId1: v })}>
                          <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                          <SelectContent>
                            {cardsAvailableFor(draft, 1).map(rc => (
                              <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tenant Copy</Label>
                        <Select value={draft.rentCardId2} onValueChange={(v) => updateDraft(unit.id, { rentCardId2: v })}>
                          <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                          <SelectContent>
                            {cardsAvailableFor(draft, 2).map(rc => (
                              <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {parseInt(draft.advanceMonths) > 6 && (
                      <div className="bg-destructive/10 border border-destructive/20 rounded p-2 text-destructive text-xs font-semibold">
                        ⚠ Advance exceeds 6-month legal limit (Act 220)
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("select-units")}>Back</Button>
            <Button disabled={!allValid} onClick={() => setStep("review")}>Next: Review</Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Review */}
      {step === "review" && property && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Review {drafts.length} Tenanc{drafts.length === 1 ? "y" : "ies"}
            </h2>
            <div className="text-sm text-muted-foreground">Property: <span className="font-semibold text-card-foreground">{property.property_name || property.address}</span></div>
            <div className="space-y-3">
              {drafts.map((d) => {
                const unit = property.units.find(u => u.id === d.unitId)!;
                const fee = bandFeeFor(parseFloat(d.rent) || 0);
                return (
                  <div key={d.unitId} className="border border-border rounded-lg p-3 text-sm grid sm:grid-cols-5 gap-2">
                    <div><div className="text-xs text-muted-foreground">Unit</div><div className="font-semibold">{unit.unit_name}</div></div>
                    <div><div className="text-xs text-muted-foreground">Tenant</div><div className="font-semibold">{d.foundTenant?.name}</div></div>
                    <div><div className="text-xs text-muted-foreground">Rent / Adv</div><div className="font-semibold">GH₵ {(parseFloat(d.rent)||0).toLocaleString()} / {d.advanceMonths}m</div></div>
                    <div><div className="text-xs text-muted-foreground">Cards</div><div className="text-xs font-semibold">{availableRentCards.find(c => c.id === d.rentCardId1)?.serial_number} + {availableRentCards.find(c => c.id === d.rentCardId2)?.serial_number}</div></div>
                    <div><div className="text-xs text-muted-foreground">Fee</div><div className="font-semibold">GH₵ {fee.toFixed(2)}</div></div>
                  </div>
                );
              })}
            </div>
            {feeConfig.enabled && totalFee > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 flex justify-between font-bold border-t border-border pt-3">
                <span>Total Registration Fee</span>
                <span>GH₵ {totalFee.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setStep("tenant-details")}>Back</Button>
            {feeConfig.enabled && totalFee > 0 ? (
              <Button onClick={handlePayFee} disabled={submitting}>
                <CreditCard className="h-4 w-4 mr-1" /> {submitting ? "Processing..." : `Pay GH₵ ${totalFee.toFixed(2)} & Submit`}
              </Button>
            ) : (
              <Button onClick={handleSubmitBatch} disabled={submitting}>
                <UserPlus className="h-4 w-4 mr-1" /> {submitting ? "Creating..." : `Create ${drafts.length} Tenanc${drafts.length === 1 ? "y" : "ies"}`}
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && batchResult && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-8 shadow-elevated border border-success/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground">
            {batchResult.failed.length === 0 ? "All Tenancies Created!" : `${batchResult.created.length} of ${drafts.length} Created`}
          </h2>
          {batchResult.created.length > 0 && (
            <div className="text-left max-w-md mx-auto space-y-1">
              <p className="text-sm font-semibold text-success">Successful:</p>
              {batchResult.created.map(c => (
                <div key={c.code} className="text-xs text-muted-foreground">✓ {c.unit} → <span className="font-mono text-primary">{c.code}</span></div>
              ))}
            </div>
          )}
          {batchResult.failed.length > 0 && (
            <div className="text-left max-w-md mx-auto space-y-1">
              <p className="text-sm font-semibold text-destructive">Failed:</p>
              {batchResult.failed.map((f, i) => (
                <div key={i} className="text-xs text-destructive">✗ {f.unit}: {f.error}</div>
              ))}
              <Button size="sm" variant="outline" className="mt-2" onClick={() => { setBatchResult(null); setStep("review"); }}>Retry Failed</Button>
            </div>
          )}
          <div className="flex justify-center gap-3 pt-2">
            <Link to="/landlord/agreements"><Button variant="outline">View Agreements</Button></Link>
            <Link to="/landlord/my-properties"><Button>Back to Properties</Button></Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AddTenant;

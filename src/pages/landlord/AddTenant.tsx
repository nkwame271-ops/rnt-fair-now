import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateConfig, CustomFieldDef } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/lib/notificationService";
import { useFeeConfig } from "@/hooks/useFeatureFlag";
import { SelectUnitsStep } from "./add-tenant/SelectUnitsStep";
import { TenantDetailsStep } from "./add-tenant/TenantDetailsStep";
import { ReviewStep } from "./add-tenant/ReviewStep";

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

  const selectedUnitIds = useMemo(() => new Set(drafts.map(d => d.unitId)), [drafts]);
  const toggleUnitExpand = (unitId: string) =>
    setExpandedUnits(prev => {
      const n = new Set(prev);
      if (n.has(unitId)) n.delete(unitId); else n.add(unitId);
      return n;
    });

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

      {step === "select-units" && (
        <SelectUnitsStep
          properties={properties}
          selectedPropertyId={selectedPropertyId}
          onSelectProperty={(v) => { setSelectedPropertyId(v); setDrafts([]); }}
          property={property}
          vacantUnits={vacantUnits}
          selectedUnitIds={selectedUnitIds}
          onToggleUnit={toggleUnitSelected}
          draftsCount={drafts.length}
          cardsNeeded={cardsNeeded}
          availableCardsCount={availableRentCards.length}
          enoughCards={enoughCards}
          onNext={() => setStep("tenant-details")}
        />
      )}

      {step === "tenant-details" && property && (
        <TenantDetailsStep
          selectedUnits={selectedUnits}
          drafts={drafts}
          expandedUnits={expandedUnits}
          onToggleExpand={toggleUnitExpand}
          customFields={customFields}
          maxAdvance={maxAdvance}
          maxLease={maxLease}
          minLease={minLease}
          bulkRent={bulkRent}
          bulkStartDate={bulkStartDate}
          setBulkRent={setBulkRent}
          setBulkStartDate={setBulkStartDate}
          onApplyBulk={applyBulkToAll}
          updateDraft={updateDraft}
          onSearchTenant={handleSearchTenant}
          validateDraft={validateDraft}
          computeEndDate={computeEndDate}
          cardsAvailableFor={cardsAvailableFor}
          allValid={allValid}
          onBack={() => setStep("select-units")}
          onNext={() => setStep("review")}
        />
      )}

      {step === "review" && property && (
        <ReviewStep
          property={property}
          drafts={drafts}
          availableRentCards={availableRentCards}
          feeEnabled={feeConfig.enabled}
          totalFee={totalFee}
          bandFeeFor={bandFeeFor}
          submitting={submitting}
          onBack={() => setStep("tenant-details")}
          onPay={handlePayFee}
          onSubmitFree={handleSubmitBatch}
        />
      )}

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

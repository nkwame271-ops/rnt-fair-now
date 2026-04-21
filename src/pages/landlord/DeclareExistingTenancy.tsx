import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { generateAgreementPdf } from "@/lib/generateAgreementPdf";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SelectUnitsStep } from "./declare-existing/SelectUnitsStep";
import { TenantDetailsStep } from "./declare-existing/TenantDetailsStep";
import { ReviewStep } from "./declare-existing/ReviewStep";

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
  area: string;
  ghana_post_gps: string | null;
  units: UnitInfo[];
}
interface UnitDraft {
  unitId: string;
  tenantName: string;
  tenantPhone: string;
  phoneSearching: boolean;
  phoneSearchDone: boolean;
  matchedTenant: { userId: string; fullName: string; tenantIdCode: string } | null;
  rent: string;
  advancePaid: string;
  existingStartDate: string;
  expiryDate: string;
  agreementChoice: "upload" | "buy";
  agreementFileName?: string; // session-restorable indicator only
  rentCardId1: string;
  rentCardId2: string;
  registrationCode?: string;
  submitted?: boolean;
  submitError?: string;
}

const SESSION_KEY = "declare_existing_tenancy_form";

const newDraft = (unit: UnitInfo): UnitDraft => ({
  unitId: unit.id,
  tenantName: "",
  tenantPhone: "",
  phoneSearching: false,
  phoneSearchDone: false,
  matchedTenant: null,
  rent: unit.monthly_rent ? unit.monthly_rent.toString() : "",
  advancePaid: "0",
  existingStartDate: "",
  expiryDate: "",
  agreementChoice: "upload",
  rentCardId1: "",
  rentCardId2: "",
});

const DeclareExistingTenancy = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState<Step>("select-units");
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [drafts, setDrafts] = useState<UnitDraft[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Per-unit file uploads (kept in component state, not session-restorable)
  const [agreementFiles, setAgreementFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [availableRentCards, setAvailableRentCards] = useState<{ id: string; serial_number: string }[]>([]);
  const [feeEnabled, setFeeEnabled] = useState(true);
  const [bands, setBands] = useState<{ min_rent: number; max_rent: number | null; register_fee: number; filing_fee: number; agreement_fee: number }[]>([]);
  const [batchResult, setBatchResult] = useState<{ created: { code: string; unit: string }[]; failed: { unit: string; error: string }[] } | null>(null);

  const property = properties.find(p => p.id === selectedPropertyId);

  // Load
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: propData }, { data: cardData }, { data: bandData }, { data: flagData }] = await Promise.all([
        supabase.from("properties").select("id, property_name, address, region, area, ghana_post_gps, units(id, unit_name, unit_type, monthly_rent, status)").eq("landlord_user_id", user.id),
        supabase.from("rent_cards").select("id, serial_number").eq("landlord_user_id", user.id).in("status", ["valid", "awaiting_serial"]).is("tenancy_id", null),
        supabase.from("rent_bands").select("min_rent, max_rent, fee_amount, register_fee, filing_fee, agreement_fee").eq("band_type", "existing_tenancy").order("min_rent"),
        supabase.from("feature_flags").select("fee_enabled").eq("feature_key", "agreement_sale_fee").single(),
      ]);
      setProperties((propData || []) as PropertyWithUnits[]);
      setAvailableRentCards((cardData || []).filter((c: any) => c.serial_number) as { id: string; serial_number: string }[]);
      setBands((bandData || []).map((b: any) => ({
        min_rent: Number(b.min_rent),
        max_rent: b.max_rent !== null ? Number(b.max_rent) : null,
        register_fee: Number(b.register_fee ?? 0),
        filing_fee: Number(b.filing_fee ?? 0),
        agreement_fee: Number(b.agreement_fee ?? 0),
      })));
      if (flagData) setFeeEnabled(flagData.fee_enabled);
      setLoading(false);

      // Auto-resume after payment
      if (sessionStorage.getItem("declare_auto_submit") === "true") {
        sessionStorage.removeItem("declare_auto_submit");
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          try {
            const data = JSON.parse(saved);
            setSelectedPropertyId(data.selectedPropertyId || "");
            setDrafts(data.drafts || []);
            setStep("review");
            setTimeout(() => handleSubmitBatch(true), 600);
          } catch { /* ignore */ }
          sessionStorage.removeItem(SESSION_KEY);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Restore form on payment redirect
  useEffect(() => {
    const status = searchParams.get("status");
    const ref = searchParams.get("reference") || searchParams.get("trxref") || sessionStorage.getItem("pendingPaymentReference");
    if (ref) {
      sessionStorage.removeItem("pendingPaymentReference");
      supabase.functions.invoke("verify-payment", { body: { reference: ref } })
        .then(({ data }) => {
          if (data?.verified) toast.success("Payment confirmed!");
        })
        .catch(() => { /* ignore */ });
    }
    if (status === "fee_paid" || ref) {
      sessionStorage.setItem("declare_auto_submit", "true");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  const findBand = (rent: number) => bands.find(b => rent >= b.min_rent && (b.max_rent === null || rent <= b.max_rent)) || null;

  const feeForDraft = (d: UnitDraft) => {
    const r = parseFloat(d.rent) || 0;
    const band = findBand(r);
    if (!band) return { register: 0, filing: 0, agreement: 0, total: 0 };
    const register = band.register_fee;
    const filing = band.filing_fee;
    const agreement = d.agreementChoice === "buy" ? band.agreement_fee : 0;
    return { register, filing, agreement, total: register + filing + agreement };
  };
  const totalFee = drafts.reduce((s, d) => s + feeForDraft(d).total, 0);

  const usedCardIds = (() => {
    const s = new Set<string>();
    drafts.forEach(d => { if (d.rentCardId1) s.add(d.rentCardId1); if (d.rentCardId2) s.add(d.rentCardId2); });
    return s;
  })();
  const cardsAvailableFor = (draft: UnitDraft, slot: 1 | 2) => availableRentCards.filter(rc => {
    if (rc.id === (slot === 1 ? draft.rentCardId1 : draft.rentCardId2)) return true;
    return !usedCardIds.has(rc.id);
  });
  const cardsNeeded = drafts.length * 2;
  const enoughCards = availableRentCards.length >= cardsNeeded;

  const toggleUnit = (unit: UnitInfo) => {
    setDrafts(prev => {
      const exists = prev.find(d => d.unitId === unit.id);
      if (exists) return prev.filter(d => d.unitId !== unit.id);
      return [...prev, newDraft(unit)];
    });
  };
  const updateDraft = (unitId: string, patch: Partial<UnitDraft>) => {
    setDrafts(prev => prev.map(d => d.unitId === unitId ? { ...d, ...patch } : d));
  };

  const handlePhoneSearch = async (draft: UnitDraft) => {
    if (!draft.tenantPhone.trim()) return;
    updateDraft(draft.unitId, { phoneSearching: true, matchedTenant: null, phoneSearchDone: false });
    try {
      const phone = draft.tenantPhone.trim().replace(/\s/g, "");
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone")
        .or(`phone.eq.${phone},phone.eq.0${phone.replace(/^233/, "")},phone.eq.233${phone.replace(/^0/, "")}`);
      if (profiles && profiles.length > 0) {
        const p = profiles[0];
        const { data: tenant } = await supabase.from("tenants").select("tenant_id").eq("user_id", p.user_id).single();
        if (tenant) {
          updateDraft(draft.unitId, { matchedTenant: { userId: p.user_id, fullName: p.full_name, tenantIdCode: tenant.tenant_id } });
          toast.success(`Tenant found: ${p.full_name}`);
        } else {
          updateDraft(draft.unitId, { matchedTenant: { userId: p.user_id, fullName: p.full_name, tenantIdCode: "" } });
          toast.info(`User found (${p.full_name}) — will be linked`);
        }
      } else {
        toast.info("No account found — SMS invitation will be sent");
      }
    } catch {
      toast.error("Search failed");
    } finally {
      updateDraft(draft.unitId, { phoneSearching: false, phoneSearchDone: true });
    }
  };

  const validateDraft = (d: UnitDraft): string | null => {
    if (!d.tenantName.trim()) return "Tenant name required";
    if (!d.tenantPhone.trim()) return "Tenant phone required";
    if (!d.phoneSearchDone) return "Click Check on phone";
    const r = parseFloat(d.rent) || 0;
    if (r <= 0) return "Enter monthly rent";
    if (!d.existingStartDate) return "Start date required";
    if (!d.expiryDate) return "Expiry date required";
    if (!d.rentCardId1 || !d.rentCardId2) return "Select both rent cards";
    if (d.rentCardId1 === d.rentCardId2) return "Rent cards must be different";
    return null;
  };
  const allValid = drafts.length > 0 && drafts.every(d => !validateDraft(d));

  const submitOneDraft = async (draft: UnitDraft, unit: UnitInfo): Promise<{ code: string }> => {
    if (!user || !property) throw new Error("Missing context");
    const monthlyRent = parseFloat(draft.rent) || 0;
    const advMonths = parseInt(draft.advancePaid) || 0;
    const maxLawfulAdvance = monthlyRent * 6;
    const registrationCode = `EX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

    // Upload agreement file if provided (private bucket — store path)
    let agreementUrl: string | null = null;
    const file = agreementFiles[draft.unitId];
    if (file) {
      const path = `existing-agreements/${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(path, file);
      if (!uploadErr) agreementUrl = path;
    }

    const tenantUserId = draft.matchedTenant?.userId || user.id;
    const tenantIdCode = draft.matchedTenant?.tenantIdCode || `PENDING-${Date.now()}`;

    const { error, data: tenancyData } = await supabase.from("tenancies").insert({
      tenant_user_id: tenantUserId,
      landlord_user_id: user.id,
      unit_id: unit.id,
      tenant_id_code: tenantIdCode,
      registration_code: registrationCode,
      agreed_rent: monthlyRent,
      advance_months: advMonths,
      start_date: draft.existingStartDate,
      end_date: draft.expiryDate,
      move_in_date: draft.existingStartDate,
      status: "existing_declared",
      tenancy_type: "existing_migration",
      existing_advance_paid: advMonths,
      existing_start_date: draft.existingStartDate,
      existing_agreement_url: agreementUrl,
      landlord_accepted: true,
      tenant_accepted: false,
      compliance_status: "under_review",
      tax_compliance_status: "pending",
      rent_card_id: draft.rentCardId1 || null,
      rent_card_id_2: draft.rentCardId2 || null,
    } as any).select().single();

    if (error) throw error;

    // Generate agreement PDF if "buy"
    if (draft.agreementChoice === "buy" && tenancyData) {
      try {
        const [{ data: tplConfig }, { data: landlordProfile }] = await Promise.all([
          supabase.from("agreement_template_config").select("*").limit(1).single(),
          supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).single(),
        ]);
        const doc = await generateAgreementPdf({
          tenancyId: tenancyData.id,
          registrationCode,
          landlordName: landlordProfile?.full_name || "Landlord",
          tenantName: draft.tenantName,
          tenantId: draft.matchedTenant?.tenantIdCode || "Pending",
          propertyName: property.property_name || property.address,
          propertyAddress: property.address,
          unitName: unit.unit_name,
          unitType: unit.unit_type,
          monthlyRent,
          advanceMonths: advMonths,
          startDate: draft.existingStartDate,
          endDate: draft.expiryDate,
          region: property.region,
          ghanaPostGps: property.ghana_post_gps || undefined,
          landlordPhone: landlordProfile?.phone || undefined,
          tenantPhone: draft.tenantPhone || undefined,
          isExistingTenancy: false,
          templateConfig: tplConfig ? {
            max_advance_months: tplConfig.max_advance_months,
            min_lease_duration: tplConfig.min_lease_duration,
            max_lease_duration: tplConfig.max_lease_duration,
            tax_rate: tplConfig.tax_rate,
            registration_deadline_days: tplConfig.registration_deadline_days,
            terms: tplConfig.terms,
          } : undefined,
          landlordSignature: { name: landlordProfile?.full_name || "Landlord", signedAt: new Date().toISOString(), method: "Digital (Auto)" },
        });
        const pdfBlob = doc.output("blob");
        const pdfPath = `generated-agreements/${user.id}/${Date.now()}_${registrationCode}.pdf`;
        const { error: upErr } = await supabase.storage.from("application-evidence").upload(pdfPath, pdfBlob, { contentType: "application/pdf" });
        if (!upErr) {
          await supabase.from("tenancies").update({
            agreement_pdf_url: pdfPath,
            landlord_signed_at: new Date().toISOString(),
          } as any).eq("id", tenancyData.id);
        }
      } catch (pdfErr) {
        console.error("PDF generation failed:", pdfErr);
      }
    }

    // Activate rent cards
    if (draft.rentCardId1 && tenancyData) {
      const cardActivationData = {
        status: "active",
        tenancy_id: tenancyData.id,
        activated_at: new Date().toISOString(),
        tenant_user_id: tenantUserId,
        property_id: property.id,
        unit_id: unit.id,
        start_date: draft.existingStartDate,
        expiry_date: draft.expiryDate,
        current_rent: monthlyRent,
        max_advance: maxLawfulAdvance,
        advance_paid: advMonths,
      };
      const updates = [
        supabase.from("rent_cards").update({ ...cardActivationData, card_role: "landlord_copy" } as any).eq("id", draft.rentCardId1),
      ];
      if (draft.rentCardId2) {
        updates.push(supabase.from("rent_cards").update({ ...cardActivationData, card_role: "tenant_copy" } as any).eq("id", draft.rentCardId2));
      }
      await Promise.all(updates);
    }

    await supabase.from("units").update({ status: "occupied" }).eq("id", unit.id);

    // SMS invitation if not matched
    if (!draft.matchedTenant?.userId) {
      const { data: pendingData } = await supabase.from("pending_tenants").insert({
        full_name: draft.tenantName,
        phone: draft.tenantPhone,
        created_by: user.id,
        tenancy_id: tenancyData?.id || null,
      } as any).select().single();
      try {
        await supabase.functions.invoke("send-sms", {
          body: { phone: draft.tenantPhone, message: `Hello ${draft.tenantName}, your landlord has declared an existing tenancy on RentControlGhana. Please register at https://www.rentcontrolghana.com to confirm. Ref: ${registrationCode}` },
        });
        if (pendingData) await supabase.from("pending_tenants").update({ sms_sent: true } as any).eq("id", pendingData.id);
      } catch { /* ignore */ }
    }

    return { code: registrationCode };
  };

  const handleSubmitBatch = async (skipPaymentCheck = false) => {
    if (!user || !property || drafts.length === 0) return;
    setSubmitting(true);
    const created: { code: string; unit: string }[] = [];
    const failed: { unit: string; error: string }[] = [];

    if (!skipPaymentCheck && feeEnabled && totalFee > 0) {
      const { data: paidTx } = await supabase
        .from("escrow_transactions")
        .select("id")
        .eq("user_id", user.id)
        .in("payment_type", ["agreement_sale", "existing_tenancy_bundle"])
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1);
      if (!paidTx || paidTx.length === 0) {
        toast.error("Payment required.");
        setSubmitting(false);
        return;
      }
    }

    for (const draft of drafts) {
      if (draft.submitted) continue;
      const unit = property.units.find(u => u.id === draft.unitId);
      if (!unit) { failed.push({ unit: "Unknown", error: "Unit not found" }); continue; }
      try {
        const { code } = await submitOneDraft(draft, unit);
        created.push({ code, unit: unit.unit_name });
        updateDraft(draft.unitId, { submitted: true, registrationCode: code, submitError: undefined });
      } catch (err: any) {
        failed.push({ unit: unit.unit_name, error: err.message || "Failed" });
        updateDraft(draft.unitId, { submitError: err.message || "Failed" });
      }
    }

    // Office attribution
    try {
      const { data: escrowData } = await supabase
        .from("escrow_transactions")
        .select("id, office_id")
        .eq("user_id", user.id)
        .in("payment_type", ["agreement_sale", "existing_tenancy_bundle"])
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data: propOffice } = await supabase.from("properties").select("office_id").eq("id", property.id).maybeSingle();
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
    if (failed.length === 0) toast.success(`${created.length} tenancies declared!`);
    else toast.warning(`${created.length} of ${drafts.length} declared. ${failed.length} failed.`);
  };

  const handlePayAndSubmit = async () => {
    if (!user || !property) return;
    if (!feeEnabled || totalFee <= 0) {
      handleSubmitBatch();
      return;
    }
    // Save drafts (without files)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ selectedPropertyId, drafts }));
    setSubmitting(true);
    try {
      const items = drafts.map(d => ({ monthlyRent: parseFloat(d.rent) || 0, agreementChoice: d.agreementChoice }));
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: {
          type: "existing_tenancy_bundle",
          propertyId: property.id,
          items,
          callbackPath: "/landlord/declare-existing-tenancy?status=fee_paid",
        },
      });
      if (error) throw error;
      if (data?.skipped) {
        sessionStorage.removeItem(SESSION_KEY);
        await handleSubmitBatch(true);
        return;
      }
      if (data?.authorization_url) {
        if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
        return;
      }
      throw new Error("Failed to initialize payment");
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      sessionStorage.removeItem(SESSION_KEY);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const selectedUnits = property
    ? drafts.map(d => property.units.find(u => u.id === d.unitId)).filter((u): u is UnitInfo => !!u)
    : [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/landlord/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Declare Existing Tenancies</h1>
          <p className="text-muted-foreground mt-1">Migrate one or many existing tenancies under a property</p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {["Select Units", "Tenant & Terms", "Review & Pay"].map((s, i) => {
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

      {/* Step 1 */}
      {step === "select-units" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Units</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.</p>
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
                  <Label>Units (select one or more — any status accepted for existing tenancies)</Label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {property.units.map((u) => {
                      const checked = drafts.some(d => d.unitId === u.id);
                      return (
                        <label key={u.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleUnit(u)} className="mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-card-foreground">{u.unit_name}</div>
                            <div className="text-xs text-muted-foreground">{u.unit_type} · GH₵ {u.monthly_rent.toLocaleString()}/mo · {u.status}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
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
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">Not Enough Rent Cards</p>
                    <Link to="/landlord/manage-rent-cards"><Button size="sm" variant="outline" className="mt-2">Buy Rent Cards</Button></Link>
                  </div>
                </div>
              )}
              <Button disabled={drafts.length === 0 || !enoughCards} onClick={() => setStep("tenant-details")}>Next: Tenant Details ({drafts.length})</Button>
            </>
          )}
        </motion.div>
      )}

      {/* Step 2 */}
      {step === "tenant-details" && property && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {selectedUnits.map((unit) => {
            const draft = drafts.find(d => d.unitId === unit.id)!;
            const err = validateDraft(draft);
            const isOpen = expanded.has(unit.id) || drafts.length === 1;
            const monthlyRent = parseFloat(draft.rent) || 0;
            const fee = feeForDraft(draft);
            return (
              <div key={unit.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (drafts.length === 1) return;
                    setExpanded(prev => { const n = new Set(prev); n.has(unit.id) ? n.delete(unit.id) : n.add(unit.id); return n; });
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {err ? <AlertCircle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
                    <div className="text-left">
                      <div className="font-semibold text-card-foreground text-sm">{unit.unit_name}</div>
                      <div className="text-xs text-muted-foreground">{err || `${draft.tenantName || "—"} · GH₵ ${monthlyRent.toLocaleString()}/mo · ${draft.agreementChoice === "buy" ? "Buy" : "Upload"}`}</div>
                    </div>
                  </div>
                  {drafts.length > 1 && (isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                </button>

                {isOpen && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Tenant Full Name</Label>
                        <Input value={draft.tenantName} onChange={(e) => updateDraft(unit.id, { tenantName: e.target.value })} placeholder="e.g. Kwame Asante" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tenant Phone</Label>
                        <div className="flex gap-2">
                          <Input value={draft.tenantPhone} onChange={(e) => updateDraft(unit.id, { tenantPhone: e.target.value, phoneSearchDone: false, matchedTenant: null })} placeholder="0241234567" />
                          <Button variant="outline" size="sm" onClick={() => handlePhoneSearch(draft)} disabled={!draft.tenantPhone.trim() || draft.phoneSearching}>
                            <Search className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {draft.phoneSearchDone && (
                      draft.matchedTenant ? (
                        <div className="bg-success/5 border border-success/20 rounded p-2 text-xs flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="font-semibold">{draft.matchedTenant.fullName}</span>
                          <span className="text-muted-foreground">{draft.matchedTenant.tenantIdCode || "(will be linked)"}</span>
                        </div>
                      ) : (
                        <div className="bg-warning/5 border border-warning/20 rounded p-2 text-xs flex items-center gap-2">
                          <Phone className="h-4 w-4 text-warning" />
                          <span>SMS invitation will be sent to {draft.tenantPhone}</span>
                        </div>
                      )
                    )}

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Monthly Rent (GH₵)</Label>
                        <Input type="number" value={draft.rent} onChange={(e) => updateDraft(unit.id, { rent: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Advance Already Paid (months)</Label>
                        <Input type="number" min="0" value={draft.advancePaid} onChange={(e) => updateDraft(unit.id, { advancePaid: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tenancy Start Date</Label>
                        <Input type="date" value={draft.existingStartDate} onChange={(e) => updateDraft(unit.id, { existingStartDate: e.target.value })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Expected Expiry Date</Label>
                        <Input type="date" value={draft.expiryDate} onChange={(e) => updateDraft(unit.id, { expiryDate: e.target.value })} />
                      </div>
                    </div>

                    {/* Agreement choice */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <Label className="text-xs">Agreement Type</Label>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <button type="button" onClick={() => updateDraft(unit.id, { agreementChoice: "upload" })}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${draft.agreementChoice === "upload" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                          <div className="flex items-center gap-2 mb-1"><Upload className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Upload Agreement</span></div>
                          <p className="text-xs text-muted-foreground">I have my own document</p>
                        </button>
                        <button type="button" onClick={() => updateDraft(unit.id, { agreementChoice: "buy" })}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${draft.agreementChoice === "buy" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                          <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Buy Agreement</span></div>
                          <p className="text-xs text-muted-foreground">Platform generates one</p>
                        </button>
                      </div>
                      {draft.agreementChoice === "upload" && (
                        <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setAgreementFiles(prev => ({ ...prev, [unit.id]: f }));
                          updateDraft(unit.id, { agreementFileName: f?.name });
                        }} />
                      )}
                    </div>

                    {/* Rent cards */}
                    <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                      <div className="space-y-1">
                        <Label className="text-xs">Landlord Copy</Label>
                        <Select value={draft.rentCardId1} onValueChange={(v) => updateDraft(unit.id, { rentCardId1: v })}>
                          <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                          <SelectContent>
                            {cardsAvailableFor(draft, 1).map(rc => <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Tenant Copy</Label>
                        <Select value={draft.rentCardId2} onValueChange={(v) => updateDraft(unit.id, { rentCardId2: v })}>
                          <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                          <SelectContent>
                            {cardsAvailableFor(draft, 2).map(rc => <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {feeEnabled && fee.total > 0 && (
                      <div className="bg-muted/30 rounded p-2 text-xs flex justify-between">
                        <span>Fee for this unit</span>
                        <span className="font-semibold">GH₵ {fee.total.toFixed(2)}</span>
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

      {/* Step 3 */}
      {step === "review" && property && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Review {drafts.length} Existing Tenanc{drafts.length === 1 ? "y" : "ies"}</h2>
            <div className="text-sm text-muted-foreground">Property: <span className="font-semibold text-card-foreground">{property.property_name || property.address}</span></div>
            <div className="space-y-3">
              {drafts.map((d) => {
                const unit = property.units.find(u => u.id === d.unitId)!;
                const fee = feeForDraft(d);
                return (
                  <div key={d.unitId} className="border border-border rounded-lg p-3 text-sm grid sm:grid-cols-5 gap-2">
                    <div><div className="text-xs text-muted-foreground">Unit</div><div className="font-semibold">{unit.unit_name}</div></div>
                    <div><div className="text-xs text-muted-foreground">Tenant</div><div className="font-semibold">{d.tenantName}</div></div>
                    <div><div className="text-xs text-muted-foreground">Rent</div><div className="font-semibold">GH₵ {(parseFloat(d.rent)||0).toLocaleString()}</div></div>
                    <div><div className="text-xs text-muted-foreground">Agreement</div><div className="font-semibold capitalize">{d.agreementChoice}</div></div>
                    <div><div className="text-xs text-muted-foreground">Fee</div><div className="font-semibold">GH₵ {fee.total.toFixed(2)}</div></div>
                  </div>
                );
              })}
            </div>
            {feeEnabled && totalFee > 0 && (
              <div className="bg-muted/30 rounded-lg p-3 flex justify-between font-bold border-t border-border pt-3">
                <span>Total</span>
                <span>GH₵ {totalFee.toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setStep("tenant-details")}>Back</Button>
            <Button onClick={handlePayAndSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {submitting ? "Processing..." : feeEnabled && totalFee > 0 ? `Pay GH₵ ${totalFee.toFixed(2)} & Submit` : `Declare ${drafts.length} Tenanc${drafts.length === 1 ? "y" : "ies"}`}
            </Button>
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
            {batchResult.failed.length === 0 ? "All Tenancies Declared!" : `${batchResult.created.length} of ${drafts.length} Declared`}
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
            <Link to="/landlord/dashboard"><Button>Back to Dashboard</Button></Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default DeclareExistingTenancy;

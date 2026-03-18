import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, CheckCircle2, FileText, Download, ArrowLeft, Loader2, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateAgreementPdf, TemplateConfig, CustomFieldDef } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendSms } from "@/lib/smsService";
import { useFeeConfig } from "@/hooks/useFeatureFlag";

type Step = "select-unit" | "find-tenant" | "set-terms" | "review" | "done";

interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  region: string;
  units: { id: string; unit_name: string; unit_type: string; monthly_rent: number; status: string }[];
}

const AddTenant = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const feeConfig = useFeeConfig("add_tenant_fee");
  const [step, setStep] = useState<Step>("select-unit");
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [foundTenant, setFoundTenant] = useState<{ name: string; id: string; userId: string; tenantIdCode: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [rent, setRent] = useState("");
  const [advanceMonths, setAdvanceMonths] = useState("6");
  const [leaseDurationMonths, setLeaseDurationMonths] = useState("12");
  const [startDate, setStartDate] = useState("2026-03-01");
  const [submitting, setSubmitting] = useState(false);
  const [landlordName, setLandlordName] = useState("");
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [availableRentCards, setAvailableRentCards] = useState<{ id: string; serial_number: string }[]>([]);
  const [selectedRentCardId, setSelectedRentCardId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");

  const property = properties.find(p => p.id === selectedPropertyId);
  const unit = property?.units.find(u => u.id === selectedUnitId);
  const vacantUnits = property?.units.filter(u => u.status === "vacant") ?? [];

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [propsRes, profileRes, configRes, rentCardsRes] = await Promise.all([
        supabase.from("properties").select("id, property_name, address, region, property_category, units(id, unit_name, unit_type, monthly_rent, status)").eq("landlord_user_id", user.id),
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("agreement_template_config").select("*").limit(1).single(),
        supabase.from("rent_cards").select("id, serial_number").eq("landlord_user_id", user.id).eq("status", "valid"),
      ]);
      setProperties((propsRes.data || []) as PropertyWithUnits[]);
      setLandlordName(profileRes.data?.full_name || "");
      if (configRes.data) {
        setTemplateConfig(configRes.data as TemplateConfig);
        const cf = (configRes.data as any).custom_fields || [];
        setCustomFields(cf);
      }
      setAvailableRentCards((rentCardsRes.data || []) as { id: string; serial_number: string }[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const [autoSubmitPending, setAutoSubmitPending] = useState(false);

  // Check if fee was paid via callback — restore form and auto-submit
  useEffect(() => {
    if (searchParams.get("status") === "fee_paid") {
      const saved = sessionStorage.getItem("addTenantFormData");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          setSelectedPropertyId(data.selectedPropertyId || "");
          setSelectedUnitId(data.selectedUnitId || "");
          setFoundTenant(data.foundTenant || null);
          setRent(data.rent || "");
          setAdvanceMonths(data.advanceMonths || "6");
          setLeaseDurationMonths(data.leaseDurationMonths || "12");
          setStartDate(data.startDate || "2026-03-01");
          setCustomFieldValues(data.customFieldValues || {});
          setSelectedRentCardId(data.selectedRentCardId || "");
          setStep("review");
          setAutoSubmitPending(true);
          sessionStorage.removeItem("addTenantFormData");
          toast.success("Fee paid! Submitting your tenancy...");
        } catch { /* ignore parse errors */ }
      }
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // Auto-submit after restoring form data from fee payment return
  useEffect(() => {
    if (autoSubmitPending && foundTenant && selectedUnitId && selectedRentCardId && !loading) {
      setAutoSubmitPending(false);
      // Small delay to let state settle
      setTimeout(() => handleSubmit(), 500);
    }
  }, [autoSubmitPending, foundTenant, selectedUnitId, selectedRentCardId, loading]);

  const handlePayFee = async () => {
    if (!user) return;
    // Save form data to sessionStorage before redirect
    sessionStorage.setItem("addTenantFormData", JSON.stringify({
      selectedPropertyId, selectedUnitId, foundTenant, rent, advanceMonths,
      leaseDurationMonths, startDate, customFieldValues, selectedRentCardId,
    }));
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "add_tenant_fee" },
      });
      if (error) throw error;
      if (data?.skipped) {
        sessionStorage.removeItem("addTenantFormData");
        toast.success(data.message || "Fee waived");
        // Proceed directly to submit
        handleSubmit();
        return;
      }
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      sessionStorage.removeItem("addTenantFormData");
      toast.error(err.message || "Payment failed");
    }
  };

  const handleSearch = async () => {
    setSearching(true);
    setFoundTenant(null);
    try {
      // Search by tenant_id code
      const { data: tenants } = await supabase
        .from("tenants")
        .select("user_id, tenant_id")
        .ilike("tenant_id", `%${tenantSearch.trim()}%`);

      if (tenants && tenants.length > 0) {
        const t = tenants[0];
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", t.user_id).single();
        setFoundTenant({ name: profile?.full_name || "Unknown", id: t.tenant_id, userId: t.user_id, tenantIdCode: t.tenant_id });
        toast.success(`Tenant found: ${profile?.full_name}`);
      } else {
        // Try searching by name
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .ilike("full_name", `%${tenantSearch.trim()}%`);

        if (profiles && profiles.length > 0) {
          const p = profiles[0];
          const { data: tenant } = await supabase.from("tenants").select("tenant_id").eq("user_id", p.user_id).single();
          if (tenant) {
            setFoundTenant({ name: p.full_name, id: tenant.tenant_id, userId: p.user_id, tenantIdCode: tenant.tenant_id });
            toast.success(`Tenant found: ${p.full_name} (${tenant.tenant_id})`);
          } else {
            toast.error("User found but not registered as a tenant.");
          }
        } else {
          toast.error("No tenant found with that ID or name.");
        }
      }
    } catch (err) {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const endDate = (() => {
    if (!startDate || !leaseDurationMonths) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + parseInt(leaseDurationMonths));
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const generateRegistrationCode = () => `RC-GR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
  // Resolve tax rate by property category from tax_rates JSONB, fallback to flat tax_rate
  const resolveTaxRate = () => {
    const taxRates = (templateConfig as any)?.tax_rates;
    if (taxRates && property) {
      const category = (property as any).property_category || "residential";
      if (category === "commercial" && taxRates.commercial != null) return taxRates.commercial / 100;
      if (taxRates.residential != null) return taxRates.residential / 100;
    }
    return (templateConfig?.tax_rate ?? 8) / 100;
  };
  const taxRate = resolveTaxRate();
  const monthlyRent = parseFloat(rent) || 0;
  const tax = monthlyRent * taxRate;
  const toLandlord = monthlyRent * (1 - taxRate);
  const maxAdvance = templateConfig?.max_advance_months ?? 6;

  const handleDownloadPdf = () => {
    if (!property || !unit || !foundTenant) return;
    const doc = generateAgreementPdf({
      registrationCode,
      landlordName,
      tenantName: foundTenant.name,
      tenantId: foundTenant.id,
      propertyName: property.property_name || "Property",
      propertyAddress: property.address,
      unitName: unit.unit_name,
      unitType: unit.unit_type,
      monthlyRent,
      advanceMonths: parseInt(advanceMonths),
      startDate,
      endDate,
      region: property.region,
      templateConfig: templateConfig || undefined,
      customFields: customFields.length > 0 ? customFields : undefined,
      customFieldValues: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
    });
    doc.save(`Tenancy_Agreement_${foundTenant.id}.pdf`);
    toast.success("Agreement PDF downloaded!");
  };

  const handleSubmit = async () => {
    if (!user || !foundTenant || !property || !unit || !selectedRentCardId) return;
    setSubmitting(true);
    try {
      const months = parseInt(advanceMonths);
      const moveIn = startDate;

      // Generate registration code with retry on collision
      let regCode = generateRegistrationCode();
      let tenancy: any = null;
      let attempts = 0;
      while (attempts < 5) {
        const { data, error } = await supabase.from("tenancies").insert({
          tenant_user_id: foundTenant.userId,
          landlord_user_id: user.id,
          unit_id: unit.id,
          tenant_id_code: foundTenant.tenantIdCode,
          registration_code: regCode,
          agreed_rent: monthlyRent,
          advance_months: months,
          start_date: startDate,
          end_date: endDate,
          move_in_date: moveIn,
          status: "pending",
          landlord_accepted: true,
          tenant_accepted: false,
          custom_field_values: customFieldValues,
          rent_card_id: selectedRentCardId,
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

      if (!tenancy) throw new Error("Failed to create tenancy after multiple attempts");
      setRegistrationCode(regCode);

      // Activate the rent card
      await supabase.from("rent_cards").update({
        status: "active",
        tenancy_id: tenancy.id,
        activated_at: new Date().toISOString(),
      }).eq("id", selectedRentCardId);

      // Generate rent payment schedule — batch insert
      const totalMonths = parseInt(leaseDurationMonths);
      const payments = [];
      for (let i = 0; i < totalMonths; i++) {
        const d = new Date(startDate);
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
      const { error: paymentsError } = await supabase.from("rent_payments").insert(payments);
      if (paymentsError) throw paymentsError;

      // Mark unit as occupied
      await supabase.from("units").update({ status: "occupied" }).eq("id", unit.id);

      // Send SMS to both tenant and landlord about the agreement
      const { data: tenantProfile } = await supabase.from("profiles").select("phone").eq("user_id", foundTenant.userId).maybeSingle();
      const { data: landlordProfile } = await supabase.from("profiles").select("phone").eq("user_id", user.id).maybeSingle();
      const propName = property?.property_name || property?.address || "Property";
      if (tenantProfile?.phone) {
        sendSms(tenantProfile.phone, "agreement_signed", { code: regCode, action: "created", property: propName });
      }
      if (landlordProfile?.phone) {
        sendSms(landlordProfile.phone, "agreement_signed", { code: regCode, action: "created", property: propName });
      }

      setStep("done");
      toast.success("Tenancy agreement created and sent to tenant!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create tenancy");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/landlord/my-properties" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Add New Tenant</h1>
          <p className="text-muted-foreground mt-1">Assign a tenant to a vacant unit and generate a tenancy agreement</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {["Select Unit", "Find Tenant", "Set Terms", "Review & Generate"].map((s, i) => {
          const steps: Step[] = ["select-unit", "find-tenant", "set-terms", "review"];
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
      {step === "select-unit" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Unit</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered yet. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.</p>
          ) : (
            <>
              <div className="space-y-3">
                <Label>Property</Label>
                <Select value={selectedPropertyId} onValueChange={(v) => { setSelectedPropertyId(v); setSelectedUnitId(""); }}>
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
                  <Label>Vacant Unit</Label>
                  {vacantUnits.length === 0 ? (
                    <p className="text-sm text-warning">No vacant units in this property.</p>
                  ) : (
                    <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                      <SelectTrigger><SelectValue placeholder="Choose a vacant unit" /></SelectTrigger>
                      <SelectContent>
                        {vacantUnits.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.unit_name} — {u.unit_type} (GH₵ {u.monthly_rent.toLocaleString()}/mo)</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
              {availableRentCards.length === 0 && (
                <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-card-foreground">No Rent Cards Available</p>
                    <p className="text-xs text-muted-foreground mt-1">You need at least one rent card to create a tenancy. Each tenancy requires a rent card.</p>
                    <Link to="/landlord/rent-cards">
                      <Button size="sm" variant="outline" className="mt-2">Buy Rent Cards</Button>
                    </Link>
                  </div>
                </div>
              )}
              {availableRentCards.length > 0 && (
                <div className="space-y-3">
                  <Label>Assign Rent Card</Label>
                  <Select value={selectedRentCardId} onValueChange={setSelectedRentCardId}>
                    <SelectTrigger><SelectValue placeholder="Select a rent card" /></SelectTrigger>
                    <SelectContent>
                      {availableRentCards.map((rc) => (
                        <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{availableRentCards.length} card(s) available</p>
                </div>
              )}
              <Button disabled={!selectedUnitId || !selectedRentCardId} onClick={() => { setRent(unit?.monthly_rent.toString() || ""); setStep("find-tenant"); }}>
                Next: Find Tenant
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Step 2 */}
      {step === "find-tenant" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Find Tenant</h2>
          <p className="text-sm text-muted-foreground">Search by Tenant ID or name. The tenant must have registered on the platform.</p>
          <div className="space-y-3">
            <Label>Tenant ID or Name</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. TN-2026-0001 or Kwame Mensah" value={tenantSearch} onChange={(e) => { setTenantSearch(e.target.value); setFoundTenant(null); }} />
              <Button variant="outline" onClick={handleSearch} disabled={!tenantSearch.trim() || searching}>
                <Search className="h-4 w-4 mr-1" />
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>
          {foundTenant && (
            <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <div>
                <div className="font-semibold text-card-foreground">{foundTenant.name}</div>
                <div className="text-sm text-muted-foreground">ID: {foundTenant.id}</div>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("select-unit")}>Back</Button>
            <Button disabled={!foundTenant} onClick={() => setStep("set-terms")}>Next: Set Terms</Button>
          </div>
        </motion.div>
      )}

      {/* Step 3 */}
      {step === "set-terms" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Set Tenancy Terms</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Rent (GH₵)</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advance Rent Period</Label>
              <Select value={advanceMonths} onValueChange={setAdvanceMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: maxAdvance }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Maximum {maxAdvance} months advance rent (Act 220)</p>
            </div>
            <div className="space-y-2">
              <Label>Lease Duration</Label>
              <Select value={leaseDurationMonths} onValueChange={setLeaseDurationMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: templateConfig?.max_lease_duration ?? 24 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}{m === 12 ? " (1 year)" : m === 24 ? " (2 years)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Total agreement length (min {templateConfig?.min_lease_duration ?? 1}, max {templateConfig?.max_lease_duration ?? 24} months)</p>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} readOnly className="bg-muted" />
            </div>
          </div>
          {/* Custom fields from regulator */}
          {customFields.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-card-foreground border-t border-border pt-4">Additional Information (required by Rent Control)</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {customFields.map((field) => (
                  <div key={field.label} className="space-y-2">
                    <Label>{field.label}{field.required && <span className="text-destructive ml-1">*</span>}</Label>
                    <Input
                      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                      value={customFieldValues[field.label] || ""}
                      onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field.label]: e.target.value }))}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
          {monthlyRent > 0 && (
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly Rent</span><span className="font-semibold">GH₵ {monthlyRent.toLocaleString()}</span></div>
              <div className="flex justify-between text-primary"><span>{(taxRate * 100).toFixed(0)}% Govt. Tax (via Rent Control)</span><span className="font-semibold">GH₵ {tax.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">To Landlord ({((1 - taxRate) * 100).toFixed(0)}%)</span><span className="font-semibold">GH₵ {toLandlord.toLocaleString()}</span></div>
              <div className="flex justify-between border-t border-border pt-2 mt-2 font-bold text-primary">
                <span>Maximum Lawful Advance (6 months)</span>
                <span>GH₵ {(monthlyRent * 6).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected Advance ({advanceMonths} months)</span>
                <span className="font-semibold">GH₵ {(monthlyRent * parseInt(advanceMonths)).toLocaleString()}</span>
              </div>
              {parseInt(advanceMonths) > 6 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-2 text-destructive text-xs font-semibold">
                  ⚠ Advance exceeds 6-month legal limit under Act 220. This will be blocked.
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("find-tenant")}>Back</Button>
            <Button disabled={!rent || monthlyRent <= 0 || parseInt(advanceMonths) > 6 || customFields.some(f => f.required && !customFieldValues[f.label]?.trim())} onClick={() => setStep("review")}>Next: Review</Button>
          </div>
        </motion.div>
      )}

      {/* Step 4 */}
      {step === "review" && property && unit && foundTenant && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Agreement Summary
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Registration Code", registrationCode],
                ["Landlord", landlordName],
                ["Tenant", `${foundTenant.name} (${foundTenant.id})`],
                ["Property", property.property_name || "Property"],
                ["Address", property.address],
                ["Unit", `${unit.unit_name} (${unit.unit_type})`],
                ["Monthly Rent", `GH₵ ${monthlyRent.toLocaleString()}`],
                ["Advance Rent", `${advanceMonths} month(s)`],
                ["Lease Duration", `${leaseDurationMonths} month(s)`],
                ["Period", `${new Date(startDate).toLocaleDateString("en-GB")} — ${new Date(endDate).toLocaleDateString("en-GB")}`],
                [`${(taxRate * 100).toFixed(0)}% Tax/mo`, `GH₵ ${tax.toLocaleString()}`],
                ["To Landlord/mo", `GH₵ ${toLandlord.toLocaleString()}`],
                ...customFields.map(f => [f.label, customFieldValues[f.label] || "—"]),
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="font-semibold text-card-foreground">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={() => setStep("set-terms")}>Back</Button>
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            {feeConfig.enabled && feeConfig.amount > 0 ? (
              <Button onClick={handlePayFee} disabled={submitting}>
                <CreditCard className="h-4 w-4 mr-1" /> {submitting ? "Processing..." : `Pay GH₵ ${feeConfig.amount.toFixed(2)} & Submit`}
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={submitting}>
                <UserPlus className="h-4 w-4 mr-1" /> {submitting ? "Creating..." : "Generate & Send to Tenant"}
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && foundTenant && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-8 shadow-elevated border border-success/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground">Agreement Created!</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            The tenancy agreement has been created for <strong>{foundTenant.name}</strong> ({foundTenant.id}). The tenant will see this in their Agreements page and must accept it before paying rent.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            <Link to="/landlord/my-properties"><Button>Back to Properties</Button></Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AddTenant;

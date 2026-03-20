import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Search, CheckCircle2, Upload, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Step = "select-unit" | "find-tenant" | "details" | "review" | "done";

interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  region: string;
  ghana_post_gps: string | null;
  units: { id: string; unit_name: string; unit_type: string; monthly_rent: number; status: string }[];
}

const DeclareExistingTenancy = () => {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("select-unit");
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [tenantSearch, setTenantSearch] = useState("");
  const [foundTenant, setFoundTenant] = useState<{ name: string; id: string; userId: string; tenantIdCode: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [rent, setRent] = useState("");
  const [advancePaid, setAdvancePaid] = useState("0");
  const [existingStartDate, setExistingStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [agreementFile, setAgreementFile] = useState<File | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdCode, setCreatedCode] = useState("");
  const [availableRentCards, setAvailableRentCards] = useState<{ id: string; serial_number: string }[]>([]);
  const [selectedRentCardId, setSelectedRentCardId] = useState("");
  const [selectedRentCardId2, setSelectedRentCardId2] = useState("");

  const property = properties.find(p => p.id === selectedPropertyId);
  const unit = property?.units.find(u => u.id === selectedUnitId);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const [{ data: propData }, { data: cardData }] = await Promise.all([
        supabase
          .from("properties")
          .select("id, property_name, address, region, ghana_post_gps, units(id, unit_name, unit_type, monthly_rent, status)")
          .eq("landlord_user_id", user.id),
        supabase
          .from("rent_cards")
          .select("id, serial_number")
          .eq("landlord_user_id", user.id)
          .in("status", ["valid", "awaiting_serial"])
          .is("tenancy_id", null),
      ]);
      setProperties((propData || []) as PropertyWithUnits[]);
      setAvailableRentCards((cardData || []).filter((c: any) => c.serial_number) as { id: string; serial_number: string }[]);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const handleSearch = async () => {
    setSearching(true);
    setFoundTenant(null);
    try {
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
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").ilike("full_name", `%${tenantSearch.trim()}%`);
        if (profiles && profiles.length > 0) {
          const p = profiles[0];
          const { data: tenant } = await supabase.from("tenants").select("tenant_id").eq("user_id", p.user_id).single();
          if (tenant) {
            setFoundTenant({ name: p.full_name, id: tenant.tenant_id, userId: p.user_id, tenantIdCode: tenant.tenant_id });
            toast.success(`Tenant found: ${p.full_name}`);
          } else {
            toast.error("User found but not registered as a tenant.");
          }
        } else {
          toast.error("No tenant found with that ID or name.");
        }
      }
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !foundTenant || !property || !unit) return;
    setSubmitting(true);
    try {
      const registrationCode = `EX-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
      const monthlyRent = parseFloat(rent) || 0;
      const advMonths = parseInt(advancePaid) || 0;

      let agreementUrl: string | null = null;
      let voiceUrl: string | null = null;

      if (agreementFile) {
        const path = `existing-agreements/${user.id}/${Date.now()}_${agreementFile.name}`;
        const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(path, agreementFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
          agreementUrl = urlData.publicUrl;
        }
      }

      if (voiceFile) {
        const path = `existing-voice/${user.id}/${Date.now()}_${voiceFile.name}`;
        const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(path, voiceFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
          voiceUrl = urlData.publicUrl;
        }
      }

      const { error, data: tenancyData } = await supabase.from("tenancies").insert({
        tenant_user_id: foundTenant.userId,
        landlord_user_id: user.id,
        unit_id: unit.id,
        tenant_id_code: foundTenant.tenantIdCode,
        registration_code: registrationCode,
        agreed_rent: monthlyRent,
        advance_months: advMonths,
        start_date: existingStartDate,
        end_date: expiryDate,
        move_in_date: existingStartDate,
        status: "existing_declared",
        tenancy_type: "existing_migration",
        existing_advance_paid: advMonths,
        existing_start_date: existingStartDate,
        existing_agreement_url: agreementUrl,
        existing_voice_url: voiceUrl,
        landlord_accepted: true,
        tenant_accepted: false,
        compliance_status: "under_review",
        rent_card_id: selectedRentCardId || null,
        rent_card_id_2: selectedRentCardId2 || null,
      } as any).select().single();

      if (error) throw error;

      // Activate rent cards if selected
      if (selectedRentCardId && tenancyData) {
        const cardActivationData = {
          status: "active",
          tenancy_id: tenancyData.id,
          activated_at: new Date().toISOString(),
          tenant_user_id: foundTenant.userId,
          property_id: property.id,
          unit_id: unit.id,
          start_date: existingStartDate,
          expiry_date: expiryDate,
          current_rent: monthlyRent,
          max_advance: maxLawfulAdvance,
          advance_paid: advMonths,
        };

        const updates = [
          supabase.from("rent_cards").update({
            ...cardActivationData,
            card_role: "landlord_copy",
          } as any).eq("id", selectedRentCardId),
        ];
        if (selectedRentCardId2) {
          updates.push(
            supabase.from("rent_cards").update({
              ...cardActivationData,
              card_role: "tenant_copy",
            } as any).eq("id", selectedRentCardId2)
          );
        }
        await Promise.all(updates);
      }

      await supabase.from("units").update({ status: "occupied" }).eq("id", unit.id);

      setCreatedCode(registrationCode);
      setStep("done");
      toast.success("Existing tenancy declared successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to declare tenancy");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const monthlyRent = parseFloat(rent) || 0;
  const maxLawfulAdvance = monthlyRent * 6;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/landlord/dashboard" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></Link>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Declare Existing Tenancy</h1>
          <p className="text-muted-foreground mt-1">Migrate a tenancy that started before the platform</p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2 text-xs font-medium flex-wrap">
        {["Select Unit", "Find Tenant", "Tenancy Details", "Review"].map((s, i) => {
          const steps: Step[] = ["select-unit", "find-tenant", "details", "review"];
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

      {/* Step 1: Select Unit */}
      {step === "select-unit" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Unit</h2>
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.</p>
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
                  <Label>Unit</Label>
                  <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                    <SelectTrigger><SelectValue placeholder="Choose a unit" /></SelectTrigger>
                    <SelectContent>
                      {property.units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.unit_name} — {u.unit_type} (GH₵ {u.monthly_rent.toLocaleString()}/mo)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button disabled={!selectedUnitId} onClick={() => { setRent(unit?.monthly_rent.toString() || ""); setStep("find-tenant"); }}>
                Next: Find Tenant
              </Button>
            </>
          )}
        </motion.div>
      )}

      {/* Step 2: Find Tenant */}
      {step === "find-tenant" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Find Tenant</h2>
          <p className="text-sm text-muted-foreground">Search by Tenant ID or name.</p>
          <div className="space-y-3">
            <Label>Tenant ID or Name</Label>
            <div className="flex gap-2">
              <Input placeholder="e.g. TN-2026-0001 or Kwame" value={tenantSearch} onChange={(e) => { setTenantSearch(e.target.value); setFoundTenant(null); }} />
              <Button variant="outline" onClick={handleSearch} disabled={!tenantSearch.trim() || searching}>
                <Search className="h-4 w-4 mr-1" />
                {searching ? "..." : "Search"}
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
            <Button disabled={!foundTenant} onClick={() => setStep("details")}>Next: Tenancy Details</Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Details */}
      {step === "details" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Existing Tenancy Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Rent (GH₵)</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advance Already Paid (months)</Label>
              <Select value={advancePaid} onValueChange={setAdvancePaid}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 7 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>{i} month{i !== 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Maximum 6 months (Act 220)</p>
            </div>
            <div className="space-y-2">
              <Label>Tenancy Start Date</Label>
              <Input type="date" value={existingStartDate} onChange={(e) => setExistingStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Expected Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
          </div>

          {monthlyRent > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Monthly Rent</span><span className="font-semibold">GH₵ {monthlyRent.toLocaleString()}</span></div>
              <div className="flex justify-between text-primary font-semibold"><span>Maximum Lawful Advance (6 months)</span><span>GH₵ {maxLawfulAdvance.toLocaleString()}</span></div>
            </div>
          )}

          <div className="space-y-3">
            <Label>Agreement Upload (optional)</Label>
            <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setAgreementFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Upload existing tenancy agreement (PDF or image)</p>
          </div>

          <div className="space-y-3">
            <Label>Voice Message (optional)</Label>
            <Input type="file" accept="audio/*" onChange={(e) => setVoiceFile(e.target.files?.[0] || null)} />
            <p className="text-xs text-muted-foreground">Record or upload a voice description of the tenancy</p>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("find-tenant")}>Back</Button>
            <Button disabled={!rent || monthlyRent <= 0 || !existingStartDate || !expiryDate} onClick={() => setStep("review")}>Next: Review</Button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Review */}
      {step === "review" && property && unit && foundTenant && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Existing Tenancy Summary
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Property", property.property_name || property.address],
                ["Digital Address", property.ghana_post_gps || "—"],
                ["Unit", `${unit.unit_name} (${unit.unit_type})`],
                ["Tenant", `${foundTenant.name} (${foundTenant.id})`],
                ["Monthly Rent", `GH₵ ${monthlyRent.toLocaleString()}`],
                ["Advance Paid", `${advancePaid} month(s)`],
                ["Max Lawful Advance", `GH₵ ${maxLawfulAdvance.toLocaleString()}`],
                ["Start Date", new Date(existingStartDate).toLocaleDateString("en-GB")],
                ["Expiry Date", new Date(expiryDate).toLocaleDateString("en-GB")],
                ["Agreement Upload", agreementFile ? agreementFile.name : "None"],
                ["Voice Message", voiceFile ? voiceFile.name : "None"],
                ["Status", "Existing Tenancy — Awaiting Verification"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span className="text-muted-foreground">{label}</span>
                  <div className="font-semibold text-card-foreground">{value}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("details")}>Back</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {submitting ? "Declaring..." : "Declare Existing Tenancy"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-8 shadow-elevated border border-success/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground">Tenancy Declared!</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Your existing tenancy has been declared with temporary ID: <strong className="text-primary">{createdCode}</strong>. It will be verified by Rent Control before activation.
          </p>
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

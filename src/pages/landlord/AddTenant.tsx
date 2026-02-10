import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Search, CheckCircle2, FileText, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sampleProperties, type PropertyType } from "@/data/dummyData";
import { generateAgreementPdf } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link } from "react-router-dom";

type Step = "select-unit" | "find-tenant" | "set-terms" | "review" | "done";

// Simulated tenant lookup
const mockTenants: Record<string, { name: string; id: string }> = {
  "TN-2026-0042": { name: "Ama Serwaa", id: "TN-2026-0042" },
  "TN-2026-0099": { name: "Kofi Mensah", id: "TN-2026-0099" },
  "TN-2026-0155": { name: "Abena Osei", id: "TN-2026-0155" },
};

const AddTenant = () => {
  const [step, setStep] = useState<Step>("select-unit");

  // Step 1 — select property & unit
  const [selectedProperty, setSelectedProperty] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");

  // Step 2 — find tenant
  const [tenantSearch, setTenantSearch] = useState("");
  const [foundTenant, setFoundTenant] = useState<{ name: string; id: string } | null>(null);
  const [searching, setSearching] = useState(false);

  // Step 3 — terms
  const [rent, setRent] = useState("");
  const [advanceMonths, setAdvanceMonths] = useState("6");
  const [startDate, setStartDate] = useState("2026-03-01");

  // Derived
  const property = sampleProperties.find((p) => p.id === selectedProperty);
  const unit = property?.units.find((u) => u.id === selectedUnit);
  const vacantUnits = property?.units.filter((u) => u.status === "Vacant") ?? [];

  const handleSearch = () => {
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      const found = mockTenants[tenantSearch.trim()];
      if (found) {
        setFoundTenant(found);
        toast.success(`Tenant found: ${found.name}`);
      } else {
        setFoundTenant(null);
        toast.error("Tenant ID not found. Make sure they have registered on the platform.");
      }
    }, 1000);
  };

  const handleSearchByName = () => {
    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      const match = Object.values(mockTenants).find(
        (t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase())
      );
      if (match) {
        setFoundTenant(match);
        toast.success(`Tenant found: ${match.name} (${match.id})`);
      } else {
        setFoundTenant(null);
        toast.error("No tenant found with that name.");
      }
    }, 1000);
  };

  const endDate = (() => {
    if (!startDate || !advanceMonths) return "";
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + parseInt(advanceMonths));
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  })();

  const registrationCode = `RC-GR-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

  const handleDownloadPdf = () => {
    if (!property || !unit || !foundTenant) return;
    const doc = generateAgreementPdf({
      registrationCode,
      landlordName: "Kwame Asante",
      tenantName: foundTenant.name,
      tenantId: foundTenant.id,
      propertyName: property.name,
      propertyAddress: property.address,
      unitName: unit.name,
      unitType: unit.type,
      monthlyRent: parseFloat(rent),
      advanceMonths: parseInt(advanceMonths),
      startDate,
      endDate,
      region: property.region,
    });
    doc.save(`Tenancy_Agreement_${foundTenant.id}.pdf`);
    toast.success("Agreement PDF downloaded!");
  };

  const handleSubmit = () => {
    setStep("done");
    toast.success("Tenancy agreement generated and sent to tenant for acceptance!");
  };

  const monthlyRent = parseFloat(rent) || 0;
  const tax = monthlyRent * 0.08;
  const toLandlord = monthlyRent * 0.92;

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
      <div className="flex items-center gap-2 text-xs font-medium">
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

      {/* Step 1: Select Property & Unit */}
      {step === "select-unit" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Select Property & Unit</h2>

          <div className="space-y-3">
            <Label>Property</Label>
            <Select value={selectedProperty} onValueChange={(v) => { setSelectedProperty(v); setSelectedUnit(""); }}>
              <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
              <SelectContent>
                {sampleProperties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — {p.address}</SelectItem>
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
                <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                  <SelectTrigger><SelectValue placeholder="Choose a vacant unit" /></SelectTrigger>
                  <SelectContent>
                    {vacantUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} — {u.type} (GH₵ {u.rent}/mo)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Button disabled={!selectedUnit} onClick={() => { setRent(unit?.rent.toString() || ""); setStep("find-tenant"); }}>
            Next: Find Tenant
          </Button>
        </motion.div>
      )}

      {/* Step 2: Find Tenant */}
      {step === "find-tenant" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Find Tenant</h2>
          <p className="text-sm text-muted-foreground">Search by Tenant ID or name. The tenant must have registered on the platform first.</p>

          <div className="space-y-3">
            <Label>Tenant ID or Name</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. TN-2026-0042 or Ama Serwaa"
                value={tenantSearch}
                onChange={(e) => { setTenantSearch(e.target.value); setFoundTenant(null); }}
              />
              <Button variant="outline" onClick={tenantSearch.startsWith("TN-") ? handleSearch : handleSearchByName} disabled={!tenantSearch.trim() || searching}>
                <Search className="h-4 w-4 mr-1" />
                {searching ? "Searching..." : "Search"}
              </Button>
            </div>
          </div>

          {/* Demo hint */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            <span className="font-semibold">Demo IDs:</span> TN-2026-0042 (Ama Serwaa), TN-2026-0099 (Kofi Mensah), TN-2026-0155 (Abena Osei)
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
            <Button disabled={!foundTenant} onClick={() => setStep("set-terms")}>
              Next: Set Terms
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 3: Set Terms */}
      {step === "set-terms" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
          <h2 className="text-lg font-semibold text-card-foreground">Set Tenancy Terms</h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Monthly Rent (GH₵)</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Advance Period</Label>
              <Select value={advanceMonths} onValueChange={setAdvanceMonths}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6].map((m) => (
                    <SelectItem key={m} value={m.toString()}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Maximum 6 months by law (Act 220)</p>
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

          {monthlyRent > 0 && (
            <div className="bg-muted rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Monthly Rent</span>
                <span className="font-semibold">GH₵ {monthlyRent.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span>8% Govt. Tax (via Rent Control)</span>
                <span className="font-semibold">GH₵ {tax.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To Landlord (92%)</span>
                <span className="font-semibold">GH₵ {toLandlord.toLocaleString()}</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("find-tenant")}>Back</Button>
            <Button disabled={!rent || monthlyRent <= 0} onClick={() => setStep("review")}>
              Next: Review
            </Button>
          </div>
        </motion.div>
      )}

      {/* Step 4: Review */}
      {step === "review" && property && unit && foundTenant && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Agreement Summary
            </h2>
            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                ["Registration Code", registrationCode],
                ["Landlord", "Kwame Asante"],
                ["Tenant", `${foundTenant.name} (${foundTenant.id})`],
                ["Property", property.name],
                ["Address", property.address],
                ["Unit", `${unit.name} (${unit.type})`],
                ["Monthly Rent", `GH₵ ${monthlyRent.toLocaleString()}`],
                ["Advance", `${advanceMonths} month(s)`],
                ["Period", `${new Date(startDate).toLocaleDateString("en-GB")} — ${new Date(endDate).toLocaleDateString("en-GB")}`],
                ["8% Tax/mo", `GH₵ ${tax.toLocaleString()}`],
                ["To Landlord/mo", `GH₵ ${toLandlord.toLocaleString()}`],
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
              <Download className="h-4 w-4 mr-1" /> Download PDF Agreement
            </Button>
            <Button onClick={handleSubmit}>
              <UserPlus className="h-4 w-4 mr-1" /> Generate & Send to Tenant
            </Button>
          </div>
        </motion.div>
      )}

      {/* Done */}
      {step === "done" && foundTenant && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-card rounded-xl p-8 shadow-elevated border border-success/30 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h2 className="text-xl font-bold text-card-foreground">Agreement Sent!</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            The tenancy agreement has been generated and sent to <strong>{foundTenant.name}</strong> ({foundTenant.id}) for review and acceptance.
            Once accepted, the tenant will pay the 8% government tax through the app to validate the agreement.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={handleDownloadPdf}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            <Link to="/landlord/my-properties">
              <Button>Back to Properties</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default AddTenant;

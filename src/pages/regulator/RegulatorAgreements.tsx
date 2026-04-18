import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Search, Calendar, DollarSign, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateAgreementPdf, AgreementPdfData } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { SkeletonCardList } from "@/components/ui/skeleton";

const RegulatorAgreements = () => {
  const { profile } = useAdminProfile();
  const [agreements, setAgreements] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (password: string, reason: string) => {
    if (!deletingId) return;
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action: "delete_agreement", target_id: deletingId, reason, password },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setAgreements(prev => prev.filter(a => a.id !== deletingId));
    toast.success("Agreement permanently deleted");
  };

  useEffect(() => {
    const fetchData = async () => {
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("*")
        .order("created_at", { ascending: false });

      if (!tenancies || tenancies.length === 0) {
        setLoading(false);
        return;
      }

      const userIds = [...new Set([
        ...tenancies.map(t => t.tenant_user_id),
        ...tenancies.map(t => t.landlord_user_id),
      ])];
      const unitIds = [...new Set(tenancies.map(t => t.unit_id))];

      const [profilesRes, unitsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds),
        supabase.from("units").select("id, unit_name, unit_type, property_id, monthly_rent, has_toilet_bathroom, has_kitchen, water_available, electricity_available, has_borehole, has_polytank, amenities, custom_amenities").in("id", unitIds),
      ]);

      const propertyIds = [...new Set((unitsRes.data || []).map(u => u.property_id))];
      const { data: properties } = propertyIds.length > 0
        ? await supabase.from("properties").select("id, property_name, address, region, area, gps_location, ghana_post_gps, property_condition, room_count, bathroom_count").in("id", propertyIds)
        : { data: [] };

      const tenantUserIds = [...new Set(tenancies.map(t => t.tenant_user_id))];
      const { data: tenantRecords } = await supabase.from("tenants").select("user_id, tenant_id").in("user_id", tenantUserIds);

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const unitMap = new Map((unitsRes.data || []).map(u => [u.id, u]));
      const propMap = new Map((properties || []).map(p => [p.id, p]));
      const tenantIdMap = new Map((tenantRecords || []).map(t => [t.user_id, t.tenant_id]));

      setAgreements(tenancies.map(t => {
        const unit = unitMap.get(t.unit_id);
        const prop = unit ? propMap.get(unit.property_id) : null;
        const unitAmenities = [...((unit as any)?.amenities || [])];
        if ((unit as any)?.custom_amenities) unitAmenities.push(...(unit as any).custom_amenities.split(",").map((s: string) => s.trim()));
        return {
          ...t,
          _tenantName: profileMap.get(t.tenant_user_id)?.full_name || "Unknown",
          _tenantPhone: profileMap.get(t.tenant_user_id)?.phone || "",
          _landlordName: profileMap.get(t.landlord_user_id)?.full_name || "Unknown",
          _landlordPhone: profileMap.get(t.landlord_user_id)?.phone || "",
          _unitName: unit?.unit_name || "—",
          _unitType: unit?.unit_type || "—",
          _monthlyRent: unit?.monthly_rent || t.agreed_rent,
          _propertyName: prop?.property_name || "—",
          _propertyAddress: prop?.address || "—",
          _region: prop?.region || "—",
          _tenantIdCode: tenantIdMap.get(t.tenant_user_id) || t.tenant_id_code,
          _propertyId: prop?.id || null,
          _gpsLocation: (prop as any)?.gps_location || "",
          _ghanaPostGps: (prop as any)?.ghana_post_gps || "",
          _propertyCondition: (prop as any)?.property_condition || "",
          _bedroomCount: (prop as any)?.room_count || 0,
          _bathroomCount: (prop as any)?.bathroom_count || 0,
          _amenities: unitAmenities,
          _facilities: {
            hasToiletBathroom: (unit as any)?.has_toilet_bathroom || false,
            hasKitchen: (unit as any)?.has_kitchen || false,
            waterAvailable: (unit as any)?.water_available || false,
            electricityAvailable: (unit as any)?.electricity_available || false,
            hasBorehole: (unit as any)?.has_borehole || false,
            hasPolytank: (unit as any)?.has_polytank || false,
          },
        };
      }));
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = agreements.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return a.registration_code?.toLowerCase().includes(s) || a._tenantName?.toLowerCase().includes(s) || a._landlordName?.toLowerCase().includes(s) || a._propertyName?.toLowerCase().includes(s);
  });

  const downloadPdf = async (a: any) => {
    const isExisting = a.tenancy_type === "existing_migration";
    const useExistingFormat = isExisting && !(a as any).agreement_pdf_url;
    const data: AgreementPdfData = {
      tenancyId: a.id,
      registrationCode: a.registration_code,
      landlordName: a._landlordName,
      tenantName: a._tenantName,
      tenantId: a._tenantIdCode,
      propertyName: a._propertyName,
      propertyAddress: a._propertyAddress,
      unitName: a._unitName,
      unitType: a._unitType,
      monthlyRent: a.agreed_rent,
      advanceMonths: a.advance_months,
      startDate: a.start_date,
      endDate: a.end_date,
      region: a._region,
      tenantPhone: a._tenantPhone,
      landlordPhone: a._landlordPhone,
      gpsAddress: a._gpsLocation,
      ghanaPostGps: a._ghanaPostGps,
      propertyCondition: a._propertyCondition,
      bedroomCount: a._bedroomCount,
      bathroomCount: a._bathroomCount,
      amenities: a._amenities,
      facilities: a._facilities,
      propertyId: a._propertyId,
      isExistingTenancy: useExistingFormat,
    };
    const doc = await generateAgreementPdf(data);
    doc.save(`${useExistingFormat ? "Existing_Tenancy_Details" : "Agreement"}_${a.registration_code}.pdf`);
  };

  const exportCSV = () => {
    const headers = ["Reg Code", "Tenant", "Landlord", "Property", "Unit", "Rent", "Start", "End", "Status", "Advance Months"];
    const rows = filtered.map((a) => [
      a.registration_code, a._tenantName, a._landlordName, a._propertyName, a._unitName,
      a.agreed_rent, new Date(a.start_date).toLocaleDateString(), new Date(a.end_date).toLocaleDateString(),
      a.status, a.advance_months,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = "agreements_export.csv";
    el.click();
  };

  const renderTaxBadge = (a: any) => {
    if (a.tenancy_type !== "existing_migration") return null;

    return (
      <span
        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
          a.tax_compliance_status === "verified" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
        }`}
      >
        Tax: {a.tax_compliance_status === "verified" ? "Verified" : "Pending"}
      </span>
    );
  };

  const renderActionButtons = (a: any, widthClass: string) => {
    const compactButtonClass = "h-7 px-1.5 text-[9px] whitespace-nowrap shrink-0";

    return (
      <div className={`${widthClass} shrink-0 overflow-x-auto pb-1`}>
        <div className="ml-auto flex w-max items-center justify-end gap-2 flex-nowrap">
          {a.agreement_pdf_url && (
            <a href={a.agreement_pdf_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="outline" className={compactButtonClass}>Draft</Button>
            </a>
          )}
          {a.final_agreement_pdf_url && (
            <a href={a.final_agreement_pdf_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="default" className={compactButtonClass}>Final</Button>
            </a>
          )}
          {a.existing_agreement_url && (
            <a href={a.existing_agreement_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button size="sm" variant="secondary" className={compactButtonClass}>Uploaded</Button>
            </a>
          )}
          <Button size="sm" variant="outline" className={compactButtonClass} onClick={() => downloadPdf(a)}>
            {a.tenancy_type === "existing_migration" ? "Details" : "PDF"}
          </Button>
          {profile?.isMainAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0"
              onClick={() => setDeletingId(a.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> Rental Agreements</h1>
        <p className="text-muted-foreground mt-1">Loading agreements…</p>
      </div>
      <SkeletonCardList count={5} />
    </div>
  );

  const statusColors: Record<string, string> = {
    active: "bg-success/10 text-success",
    pending: "bg-warning/10 text-warning",
    expired: "bg-destructive/10 text-destructive",
    terminated: "bg-muted text-muted-foreground",
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> Rental Agreements</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} tenancy agreements on record</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="w-full sm:w-auto"><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["active", "pending", "expired", "terminated"].map(s => {
          const count = agreements.filter(a => a.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
              className={`rounded-xl p-3 border text-left transition-all ${statusFilter === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40"}`}
            >
              <div className="text-2xl font-bold text-foreground">{count}</div>
              <div className="text-xs text-muted-foreground capitalize">{s}</div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code, tenant, landlord, property..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No agreements found</div>
        ) : filtered.map((a) => (
          <div key={a.id} className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3 overflow-hidden">
            <div className="hidden min-[1100px]:grid min-[1100px]:grid-cols-[160px_160px_160px_200px_minmax(0,1fr)_220px] items-start gap-4 w-full">
              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <span className="font-mono text-sm font-bold text-primary max-w-[150px] overflow-hidden whitespace-nowrap">{a.registration_code}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${statusColors[a.status] || ""}`}>{a.status}</span>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tenant</div>
                <Link to={`/regulator/tenants?search=${encodeURIComponent(a._tenantName)}`} className="block max-w-[140px] truncate text-sm font-medium text-primary hover:underline">{a._tenantName}</Link>
                <span className="block max-w-full truncate text-xs text-muted-foreground">{a._tenantPhone}</span>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Landlord</div>
                <Link to={`/regulator/landlords?search=${encodeURIComponent(a._landlordName)}`} className="block max-w-[140px] truncate text-sm font-medium text-primary hover:underline">{a._landlordName}</Link>
                <span className="block max-w-full truncate text-xs text-muted-foreground">{a._landlordPhone}</span>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Property</div>
                <Link to={a._propertyId ? `/regulator/properties?id=${a._propertyId}` : "#"} className="block max-w-[180px] truncate text-sm text-primary hover:underline">{a._propertyName} • {a._unitName}</Link>
                <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{a._propertyAddress}</span>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Term & Rent</div>
                <div className="flex items-center gap-1 text-sm font-semibold text-foreground min-w-0">
                  <DollarSign className="h-3 w-3 shrink-0" />
                  <span className="block max-w-full truncate">GH₵ {a.agreed_rent?.toLocaleString()}/mo</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span className="block max-w-full truncate">{new Date(a.start_date).toLocaleDateString()} — {new Date(a.end_date).toLocaleDateString()}</span>
                </div>
                <span className="block max-w-full truncate text-xs text-muted-foreground">{a.advance_months} months advance</span>
              </div>

              {renderActionButtons(a, "w-[220px] min-w-[220px]")}
            </div>

            <div className="hidden min-[900px]:max-[1099px]:grid grid-cols-[140px_140px_minmax(0,1fr)_180px] items-start gap-4 w-full">
              <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                <span className="font-mono text-sm font-bold text-primary max-w-[130px] overflow-hidden whitespace-nowrap">{a.registration_code}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${statusColors[a.status] || ""}`}>{a.status}</span>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-1">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Parties</div>
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <Link to={`/regulator/tenants?search=${encodeURIComponent(a._tenantName)}`} className="block max-w-[120px] truncate text-sm font-medium text-primary hover:underline">{a._tenantName}</Link>
                  <span className="block max-w-full truncate text-xs text-muted-foreground">{a._tenantPhone}</span>
                </div>
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5 pt-1">
                  <Link to={`/regulator/landlords?search=${encodeURIComponent(a._landlordName)}`} className="block max-w-[120px] truncate text-sm font-medium text-primary hover:underline">{a._landlordName}</Link>
                </div>
              </div>

              <div className="min-w-0 overflow-hidden flex flex-col gap-1">
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Property</div>
                  <Link to={a._propertyId ? `/regulator/properties?id=${a._propertyId}` : "#"} className="block max-w-[180px] truncate text-sm text-primary hover:underline">{a._propertyName} • {a._unitName}</Link>
                  <span className="block max-w-[180px] truncate text-xs text-muted-foreground">{a._propertyAddress}</span>
                </div>
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5 pt-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Term & Rent</div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground min-w-0">
                    <DollarSign className="h-3 w-3 shrink-0" />
                    <span className="block max-w-full truncate">GH₵ {a.agreed_rent?.toLocaleString()}/mo</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span className="block max-w-full truncate">{new Date(a.start_date).toLocaleDateString()} — {new Date(a.end_date).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {renderActionButtons(a, "w-[180px] min-w-[180px]")}
            </div>

            <div className="space-y-3 min-[900px]:hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <span className="font-mono text-sm font-bold text-primary max-w-[150px] overflow-hidden whitespace-nowrap">{a.registration_code}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit whitespace-nowrap ${statusColors[a.status] || ""}`}>{a.status}</span>
                </div>
                <div className="min-w-0 overflow-hidden flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                    <DollarSign className="h-3 w-3 shrink-0" />
                    <span className="whitespace-nowrap">GH₵ {a.agreed_rent?.toLocaleString()}/mo</span>
                  </div>
                  {renderTaxBadge(a)}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60">
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tenant</div>
                  <Link to={`/regulator/tenants?search=${encodeURIComponent(a._tenantName)}`} className="block max-w-full truncate text-sm font-medium text-primary hover:underline">{a._tenantName}</Link>
                  <span className="block max-w-full truncate text-xs text-muted-foreground">{a._tenantPhone}</span>
                </div>
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Landlord</div>
                  <Link to={`/regulator/landlords?search=${encodeURIComponent(a._landlordName)}`} className="block max-w-full truncate text-sm font-medium text-primary hover:underline">{a._landlordName}</Link>
                  <span className="block max-w-full truncate text-xs text-muted-foreground">{a._landlordPhone}</span>
                </div>
                <div className="min-w-0 overflow-hidden flex flex-col gap-0.5">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Property</div>
                  <Link to={a._propertyId ? `/regulator/properties?id=${a._propertyId}` : "#"} className="block max-w-full truncate text-sm text-primary hover:underline">{a._propertyName} • {a._unitName}</Link>
                  <span className="block max-w-full truncate text-xs text-muted-foreground">{a._propertyAddress}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60">
                {renderActionButtons(a, "w-full min-w-0")}
              </div>
            </div>

            <div className="pt-2.5 border-t border-border/60 flex flex-col gap-2 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between min-[900px]:gap-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4 min-[900px]:flex-nowrap min-w-0 shrink-0">
                <span className="whitespace-nowrap text-xs text-muted-foreground">Tenant accepted: <span className={a.tenant_accepted ? "text-success font-semibold" : "text-destructive font-semibold"}>{a.tenant_accepted ? "Yes" : "No"}</span></span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">Landlord accepted: <span className={a.landlord_accepted ? "text-success font-semibold" : "text-destructive font-semibold"}>{a.landlord_accepted ? "Yes" : "No"}</span></span>
                <span className="whitespace-nowrap text-xs text-muted-foreground">Region: {a._region}</span>
              </div>
              <div className="shrink-0 min-[900px]:ml-auto self-start min-[900px]:self-auto">
                {renderTaxBadge(a)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AdminPasswordConfirm
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
        title="Delete Agreement Permanently"
        description="This will permanently delete this tenancy agreement. This cannot be undone."
        actionLabel="Delete Permanently"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default RegulatorAgreements;

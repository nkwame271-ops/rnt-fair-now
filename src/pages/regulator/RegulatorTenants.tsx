import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Download, Search, ChevronDown, ChevronUp, Home, FileText, Calendar, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TenantFull {
  tenant_id: string;
  user_id: string;
  status: string;
  registration_date: string | null;
  expiry_date: string | null;
  registration_fee_paid: boolean;
  profile?: {
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string;
    is_citizen: boolean;
    ghana_card_no: string | null;
    residence_permit_no: string | null;
    occupation: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    work_address: string | null;
    delivery_address: string | null;
    delivery_region: string | null;
  };
  tenancies?: Array<{
    id: string;
    status: string;
    agreed_rent: number;
    start_date: string;
    end_date: string;
    move_in_date: string;
    registration_code: string;
    advance_months: number;
    landlord_user_id: string;
    _landlordName?: string;
    _propertyName?: string;
    _propertyAddress?: string;
    _unitName?: string;
    _region?: string;
  }>;
  complaints?: Array<{
    complaint_code: string;
    complaint_type: string;
    status: string;
    created_at: string;
  }>;
}

const RegulatorTenants = () => {
  const [tenants, setTenants] = useState<TenantFull[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("tenant_id, user_id, status, registration_date, expiry_date, registration_fee_paid")
        .order("created_at", { ascending: false });

      if (!tenantData || tenantData.length === 0) { setLoading(false); return; }

      const userIds = tenantData.map(t => t.user_id);

      // Parallel fetches
      const [profilesRes, tenanciesRes, complaintsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, email, nationality, is_citizen, ghana_card_no, residence_permit_no, occupation, emergency_contact_name, emergency_contact_phone, work_address, delivery_address, delivery_region").in("user_id", userIds),
        supabase.from("tenancies").select("id, tenant_user_id, landlord_user_id, status, agreed_rent, start_date, end_date, move_in_date, registration_code, advance_months, unit_id").in("tenant_user_id", userIds).order("start_date", { ascending: false }),
        supabase.from("complaints").select("tenant_user_id, complaint_code, complaint_type, status, created_at").in("tenant_user_id", userIds),
      ]);

      // Get landlord names and property info for tenancies
      const landlordIds = [...new Set((tenanciesRes.data || []).map(t => t.landlord_user_id))];
      const unitIds = [...new Set((tenanciesRes.data || []).map(t => t.unit_id))];

      const [landlordProfiles, unitsRes] = await Promise.all([
        landlordIds.length > 0 ? supabase.from("profiles").select("user_id, full_name").in("user_id", landlordIds) : { data: [] },
        unitIds.length > 0 ? supabase.from("units").select("id, unit_name, property_id").in("id", unitIds) : { data: [] },
      ]);

      const propertyIds = [...new Set((unitsRes.data || []).map(u => u.property_id))];
      const { data: properties } = propertyIds.length > 0
        ? await supabase.from("properties").select("id, property_name, address, region").in("id", propertyIds)
        : { data: [] };

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const landlordNameMap = new Map(((landlordProfiles as any).data || []).map((p: any) => [p.user_id, p.full_name]));
      const unitMap = new Map((unitsRes.data || []).map(u => [u.id, u]));
      const propMap = new Map((properties || []).map(p => [p.id, p]));

      // Group tenancies by tenant
      const tenancyMap = new Map<string, any[]>();
      (tenanciesRes.data || []).forEach(t => {
        const unit = unitMap.get(t.unit_id);
        const prop = unit ? propMap.get(unit.property_id) : null;
        const enriched = {
          ...t,
          _landlordName: landlordNameMap.get(t.landlord_user_id) || "Unknown",
          _propertyName: prop?.property_name || "—",
          _propertyAddress: prop?.address || "—",
          _unitName: unit?.unit_name || "—",
          _region: prop?.region || "—",
        };
        const arr = tenancyMap.get(t.tenant_user_id) || [];
        arr.push(enriched);
        tenancyMap.set(t.tenant_user_id, arr);
      });

      // Group complaints by tenant
      const complaintMap = new Map<string, any[]>();
      (complaintsRes.data || []).forEach(c => {
        const arr = complaintMap.get(c.tenant_user_id) || [];
        arr.push(c);
        complaintMap.set(c.tenant_user_id, arr);
      });

      setTenants(tenantData.map(t => ({
        ...t,
        profile: profileMap.get(t.user_id) || undefined,
        tenancies: tenancyMap.get(t.user_id) || [],
        complaints: complaintMap.get(t.user_id) || [],
      })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = tenants.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.tenant_id.toLowerCase().includes(s) ||
      t.profile?.full_name?.toLowerCase().includes(s) ||
      t.profile?.phone?.includes(s) ||
      t.profile?.email?.toLowerCase().includes(s)
    );
  });

  const exportCSV = () => {
    const headers = ["Tenant ID", "Name", "Phone", "Email", "Nationality", "Citizen", "ID Number", "Occupation", "Status", "Active Tenancies", "Complaints", "Registered", "Expires"];
    const rows = filtered.map((t) => [
      t.tenant_id, t.profile?.full_name || "", t.profile?.phone || "", t.profile?.email || "",
      t.profile?.nationality || "", t.profile?.is_citizen ? "Yes" : "No",
      t.profile?.is_citizen ? t.profile?.ghana_card_no || "" : t.profile?.residence_permit_no || "",
      t.profile?.occupation || "", t.status,
      t.tenancies?.filter(tc => tc.status === "active").length || 0,
      t.complaints?.length || 0,
      t.registration_date ? new Date(t.registration_date).toLocaleDateString() : "",
      t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "tenants_export.csv"; a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Tenant Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered tenants</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, phone, or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No tenants found</div>
        ) : filtered.map((t) => {
          const isExpanded = expandedId === t.tenant_id;
          const activeTenancies = t.tenancies?.filter(tc => tc.status === "active") || [];
          const pastTenancies = t.tenancies?.filter(tc => tc.status !== "active") || [];

          return (
            <div key={t.tenant_id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.tenant_id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-7 gap-2 items-center text-sm">
                  <div className="font-mono font-bold text-primary">{t.tenant_id}</div>
                  <div className="font-medium text-foreground">{t.profile?.full_name || "—"}</div>
                  <div className="text-muted-foreground">{t.profile?.phone || "—"}</div>
                  <div className="text-muted-foreground">{t.profile?.is_citizen ? "🇬🇭 Citizen" : "Permit"}</div>
                  <div className="text-muted-foreground">{t.profile?.occupation || "—"}</div>
                  <div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${t.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{t.status}</span>
                    {activeTenancies.length > 0 && <span className="ml-2 text-xs text-primary font-medium">{activeTenancies.length} active</span>}
                  </div>
                  <div className="text-muted-foreground text-xs">{t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "—"}</div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-muted/10 space-y-5">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Personal Info */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Personal Information</h3>
                      <div className="text-sm space-y-1.5">
                        <div><span className="text-muted-foreground">Full Name:</span> <span className="font-medium text-foreground">{t.profile?.full_name}</span></div>
                        <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{t.profile?.phone}</span></div>
                        <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{t.profile?.email || "—"}</span></div>
                        <div><span className="text-muted-foreground">Nationality:</span> <span className="text-foreground">{t.profile?.nationality}</span></div>
                        <div><span className="text-muted-foreground">Citizen:</span> <span className="text-foreground">{t.profile?.is_citizen ? "Yes" : "No"}</span></div>
                        <div><span className="text-muted-foreground">ID Number:</span> <span className="font-mono text-xs text-foreground">{t.profile?.is_citizen ? t.profile?.ghana_card_no || "—" : t.profile?.residence_permit_no || "—"}</span></div>
                        <div><span className="text-muted-foreground">Occupation:</span> <span className="text-foreground">{t.profile?.occupation || "—"}</span></div>
                        <div><span className="text-muted-foreground">Work Address:</span> <span className="text-foreground">{t.profile?.work_address || "—"}</span></div>
                      </div>
                    </div>

                    {/* Emergency & delivery */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Emergency & Contact</h3>
                      <div className="text-sm space-y-1.5">
                        <div><span className="text-muted-foreground">Emergency Contact:</span> <span className="text-foreground">{t.profile?.emergency_contact_name || "—"}</span></div>
                        <div><span className="text-muted-foreground">Emergency Phone:</span> <span className="text-foreground">{t.profile?.emergency_contact_phone || "—"}</span></div>
                        <div><span className="text-muted-foreground">Delivery Address:</span> <span className="text-foreground">{t.profile?.delivery_address || "—"}</span></div>
                        <div><span className="text-muted-foreground">Delivery Region:</span> <span className="text-foreground">{t.profile?.delivery_region || "—"}</span></div>
                      </div>
                      <h3 className="text-sm font-semibold text-foreground pt-2">Registration</h3>
                      <div className="text-sm space-y-1.5">
                        <div><span className="text-muted-foreground">Tenant ID:</span> <span className="font-mono text-primary font-bold">{t.tenant_id}</span></div>
                        <div><span className="text-muted-foreground">Fee Paid:</span> <span className={`font-semibold ${t.registration_fee_paid ? "text-success" : "text-destructive"}`}>{t.registration_fee_paid ? "Yes" : "No"}</span></div>
                        <div><span className="text-muted-foreground">Registered:</span> <span className="text-foreground">{t.registration_date ? new Date(t.registration_date).toLocaleDateString() : "—"}</span></div>
                        <div><span className="text-muted-foreground">Expires:</span> <span className="text-foreground">{t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "—"}</span></div>
                      </div>
                    </div>

                    {/* Complaints */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><FileText className="h-4 w-4 text-warning" /> Complaints ({t.complaints?.length || 0})</h3>
                      {(t.complaints?.length || 0) === 0 ? (
                        <div className="text-sm text-muted-foreground italic">No complaints filed</div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {t.complaints?.map(c => (
                            <div key={c.complaint_code} className="text-sm bg-background rounded-lg p-2.5 border border-border">
                              <div className="font-mono text-xs text-primary font-semibold">{c.complaint_code}</div>
                              <div className="text-foreground">{c.complaint_type}</div>
                              <div className="text-xs text-muted-foreground">{c.status} • {new Date(c.created_at).toLocaleDateString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tenancy history */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> Tenancy History ({t.tenancies?.length || 0})</h3>
                    {(t.tenancies?.length || 0) === 0 ? (
                      <div className="text-sm text-muted-foreground italic">No tenancies on record</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {t.tenancies?.map(tc => (
                          <div key={tc.id} className={`text-sm rounded-lg p-3 border ${tc.status === "active" ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-xs text-primary font-semibold">{tc.registration_code}</span>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tc.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{tc.status}</span>
                            </div>
                            <div className="font-medium text-foreground">{tc._propertyName}</div>
                            <div className="text-muted-foreground text-xs">{tc._propertyAddress} • {tc._unitName}</div>
                            <div className="text-muted-foreground text-xs">{tc._region}</div>
                            <div className="mt-1.5 flex justify-between text-xs">
                              <span className="text-muted-foreground">Landlord: <span className="text-foreground">{tc._landlordName}</span></span>
                              <span className="font-medium text-foreground">GH₵ {tc.agreed_rent?.toLocaleString()}/mo</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(tc.start_date).toLocaleDateString()} — {new Date(tc.end_date).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegulatorTenants;

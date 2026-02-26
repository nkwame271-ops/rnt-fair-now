import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Download, Search, ChevronDown, ChevronUp, Users, Home, DollarSign } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface LandlordFull {
  landlord_id: string;
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
    ghana_card_no: string | null;
    occupation: string | null;
  };
  properties?: Array<{
    id: string;
    property_code: string;
    property_name: string | null;
    address: string;
    region: string;
    area: string;
    units?: Array<{
      id: string;
      unit_name: string;
      unit_type: string;
      monthly_rent: number;
      status: string;
    }>;
  }>;
  tenancies?: Array<{
    id: string;
    status: string;
    agreed_rent: number;
    start_date: string;
    end_date: string;
    registration_code: string;
    _tenantName?: string;
    _unitName?: string;
  }>;
}

const RegulatorLandlords = () => {
  const [landlords, setLandlords] = useState<LandlordFull[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: landlordData } = await supabase
        .from("landlords")
        .select("landlord_id, user_id, status, registration_date, expiry_date, registration_fee_paid")
        .order("created_at", { ascending: false });

      if (!landlordData || landlordData.length === 0) { setLoading(false); return; }

      const userIds = landlordData.map(l => l.user_id);

      const [profilesRes, propertiesRes, tenanciesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, email, nationality, ghana_card_no, occupation").in("user_id", userIds),
        supabase.from("properties").select("id, landlord_user_id, property_code, property_name, address, region, area").in("landlord_user_id", userIds),
        supabase.from("tenancies").select("id, landlord_user_id, tenant_user_id, status, agreed_rent, start_date, end_date, registration_code, unit_id").in("landlord_user_id", userIds).order("start_date", { ascending: false }),
      ]);

      // Get units for properties
      const propertyIds = (propertiesRes.data || []).map(p => p.id);
      const { data: units } = propertyIds.length > 0
        ? await supabase.from("units").select("id, property_id, unit_name, unit_type, monthly_rent, status").in("property_id", propertyIds)
        : { data: [] };

      // Get tenant names for tenancies
      const tenantUserIds = [...new Set((tenanciesRes.data || []).map(t => t.tenant_user_id))];
      const { data: tenantProfiles } = tenantUserIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", tenantUserIds)
        : { data: [] };

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const tenantNameMap = new Map((tenantProfiles || []).map(p => [p.user_id, p.full_name]));
      const unitMap = new Map((units || []).map(u => [u.id, u]));

      // Group units by property
      const unitsByProp = new Map<string, any[]>();
      (units || []).forEach(u => {
        const arr = unitsByProp.get(u.property_id) || [];
        arr.push(u);
        unitsByProp.set(u.property_id, arr);
      });

      // Group properties by landlord
      const propsByLandlord = new Map<string, any[]>();
      (propertiesRes.data || []).forEach(p => {
        const arr = propsByLandlord.get(p.landlord_user_id) || [];
        arr.push({ ...p, units: unitsByProp.get(p.id) || [] });
        propsByLandlord.set(p.landlord_user_id, arr);
      });

      // Group tenancies by landlord
      const tenanciesByLandlord = new Map<string, any[]>();
      (tenanciesRes.data || []).forEach(t => {
        const unit = unitMap.get(t.unit_id);
        const enriched = {
          ...t,
          _tenantName: tenantNameMap.get(t.tenant_user_id) || "Unknown",
          _unitName: unit?.unit_name || "—",
        };
        const arr = tenanciesByLandlord.get(t.landlord_user_id) || [];
        arr.push(enriched);
        tenanciesByLandlord.set(t.landlord_user_id, arr);
      });

      setLandlords(landlordData.map(l => ({
        ...l,
        profile: profileMap.get(l.user_id) || undefined,
        properties: propsByLandlord.get(l.user_id) || [],
        tenancies: tenanciesByLandlord.get(l.user_id) || [],
      })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = landlords.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.landlord_id.toLowerCase().includes(s) || l.profile?.full_name?.toLowerCase().includes(s) || l.profile?.phone?.includes(s);
  });

  const exportCSV = () => {
    const headers = ["Landlord ID", "Name", "Phone", "Email", "Nationality", "Properties", "Active Tenants", "Status", "Registered", "Expires"];
    const rows = filtered.map((l) => [
      l.landlord_id, l.profile?.full_name || "", l.profile?.phone || "", l.profile?.email || "", l.profile?.nationality || "",
      l.properties?.length || 0, l.tenancies?.filter(t => t.status === "active").length || 0,
      l.status, l.registration_date ? new Date(l.registration_date).toLocaleDateString() : "",
      l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "landlords_export.csv"; a.click();
  };

  if (loading) return <LogoLoader message="Loading landlords..." />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Landlord Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered landlords</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or phone..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No landlords found</div>
        ) : filtered.map((l) => {
          const isExpanded = expandedId === l.landlord_id;
          const activeTenancies = l.tenancies?.filter(t => t.status === "active") || [];
          const totalUnits = l.properties?.reduce((sum, p) => sum + (p.units?.length || 0), 0) || 0;
          const totalRentIncome = activeTenancies.reduce((sum, t) => sum + (t.agreed_rent || 0), 0);

          return (
            <div key={l.landlord_id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : l.landlord_id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center text-sm">
                  <div className="font-mono font-bold text-primary">{l.landlord_id}</div>
                  <div className="font-medium text-foreground">{l.profile?.full_name || "—"}</div>
                  <div className="text-muted-foreground">{l.profile?.phone || "—"}</div>
                  <div className="text-muted-foreground">{l.properties?.length || 0} properties • {totalUnits} units</div>
                  <div className="text-muted-foreground">{activeTenancies.length} active tenants</div>
                  <div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${l.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{l.status}</span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-muted/10 space-y-5">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {/* Personal info */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Personal Information</h3>
                      <div className="text-sm space-y-1.5">
                        <div><span className="text-muted-foreground">Full Name:</span> <span className="font-medium text-foreground">{l.profile?.full_name}</span></div>
                        <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{l.profile?.phone}</span></div>
                        <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{l.profile?.email || "—"}</span></div>
                        <div><span className="text-muted-foreground">Nationality:</span> <span className="text-foreground">{l.profile?.nationality}</span></div>
                        <div><span className="text-muted-foreground">Ghana Card:</span> <span className="font-mono text-xs text-foreground">{l.profile?.ghana_card_no || "—"}</span></div>
                        <div><span className="text-muted-foreground">Occupation:</span> <span className="text-foreground">{l.profile?.occupation || "—"}</span></div>
                      </div>
                      <div className="pt-2 space-y-1.5">
                        <h4 className="text-sm font-semibold text-foreground">Registration</h4>
                        <div className="text-sm"><span className="text-muted-foreground">Landlord ID:</span> <span className="font-mono text-primary font-bold">{l.landlord_id}</span></div>
                        <div className="text-sm"><span className="text-muted-foreground">Fee Paid:</span> <span className={`font-semibold ${l.registration_fee_paid ? "text-success" : "text-destructive"}`}>{l.registration_fee_paid ? "Yes" : "No"}</span></div>
                        <div className="text-sm"><span className="text-muted-foreground">Registered:</span> <span className="text-foreground">{l.registration_date ? new Date(l.registration_date).toLocaleDateString() : "—"}</span></div>
                        <div className="text-sm"><span className="text-muted-foreground">Expires:</span> <span className="text-foreground">{l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : "—"}</span></div>
                      </div>
                    </div>

                    {/* Properties */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Home className="h-4 w-4 text-primary" /> Properties ({l.properties?.length || 0})</h3>
                      {(l.properties?.length || 0) === 0 ? (
                        <div className="text-sm text-muted-foreground italic">No properties registered</div>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {l.properties?.map(p => (
                            <div key={p.id} className="text-sm bg-background rounded-lg p-3 border border-border">
                              <div className="font-mono text-xs text-primary font-semibold">{p.property_code}</div>
                              <div className="font-medium text-foreground">{p.property_name || "Unnamed"}</div>
                              <div className="text-xs text-muted-foreground">{p.address} • {p.region}, {p.area}</div>
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {p.units?.map(u => (
                                  <span key={u.id} className={`text-xs px-1.5 py-0.5 rounded ${u.status === "occupied" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                    {u.unit_name} • GH₵{u.monthly_rent}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Tenants & income */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Tenants & Income</h3>
                      <div className="bg-background rounded-lg p-3 border border-border mb-2">
                        <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-success" /><span className="text-sm font-semibold text-foreground">Monthly Income</span></div>
                        <div className="text-xl font-bold text-foreground">GH₵ {totalRentIncome.toLocaleString()}</div>
                        <div className="text-xs text-muted-foreground">{activeTenancies.length} active tenant(s)</div>
                      </div>
                      {(l.tenancies?.length || 0) === 0 ? (
                        <div className="text-sm text-muted-foreground italic">No tenancies on record</div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {l.tenancies?.map(t => (
                            <div key={t.id} className={`text-sm rounded-lg p-2.5 border ${t.status === "active" ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                              <div className="flex justify-between items-center">
                                <span className="font-mono text-xs text-primary">{t.registration_code}</span>
                                <span className={`text-xs font-semibold ${t.status === "active" ? "text-success" : "text-muted-foreground"}`}>{t.status}</span>
                              </div>
                              <div className="text-foreground">{t._tenantName} • {t._unitName}</div>
                              <div className="text-xs text-muted-foreground">GH₵ {t.agreed_rent?.toLocaleString()}/mo • {new Date(t.start_date).toLocaleDateString()} — {new Date(t.end_date).toLocaleDateString()}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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

export default RegulatorLandlords;

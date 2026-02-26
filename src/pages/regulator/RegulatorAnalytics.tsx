import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, Building2, TrendingUp, CreditCard, MapPin } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import LogoLoader from "@/components/LogoLoader";
import PropertyMap, { MapMarker } from "@/components/PropertyMap";
import { GHANA_REGIONS } from "@/lib/gpsUtils";

const COLORS = ["hsl(152,55%,38%)", "hsl(43,85%,55%)", "hsl(210,60%,50%)", "hsl(0,72%,50%)", "hsl(152,55%,28%)"];

const RegulatorAnalytics = () => {
  const [data, setData] = useState<any>({
    tenantsByRegion: [],
    complaintsByType: [],
    citizenVsNonCitizen: [],
    totalTenants: 0,
    totalLandlords: 0,
    totalRevenue: 0,
    totalTaxCollected: 0,
    regionBreakdown: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Fetch tenants
      const { data: tenants } = await supabase.from("tenants").select("user_id");
      const tenantUserIds = (tenants || []).map(t => t.user_id);

      // Fetch profiles for tenant region & citizen data
      let regionMap: Record<string, { total: number; citizens: number; nonCitizens: number }> = {};
      let citizens = 0, nonCitizens = 0;
      if (tenantUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, delivery_region, is_citizen")
          .in("user_id", tenantUserIds);

        (profiles || []).forEach((p: any) => {
          const region = p.delivery_region || "Unknown";
          if (!regionMap[region]) regionMap[region] = { total: 0, citizens: 0, nonCitizens: 0 };
          regionMap[region].total++;
          if (p.is_citizen) { citizens++; regionMap[region].citizens++; }
          else { nonCitizens++; regionMap[region].nonCitizens++; }
        });
      }

      const tenantsByRegion = Object.entries(regionMap)
        .map(([region, d]) => ({ region, count: d.total }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Region breakdown for map
      const regionBreakdown = Object.entries(regionMap)
        .map(([region, d]) => ({ region, ...d }))
        .sort((a, b) => b.total - a.total);

      // Properties by region
      const { data: properties } = await supabase.from("properties").select("region");
      const propRegionMap: Record<string, number> = {};
      (properties || []).forEach((p: any) => {
        propRegionMap[p.region] = (propRegionMap[p.region] || 0) + 1;
      });

      // Complaints by type
      const { data: complaints } = await supabase.from("complaints").select("complaint_type");
      const typeMap: Record<string, number> = {};
      (complaints || []).forEach((c: any) => {
        typeMap[c.complaint_type] = (typeMap[c.complaint_type] || 0) + 1;
      });
      const complaintsByType = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

      // Landlords
      const { data: landlords } = await supabase.from("landlords").select("landlord_id");

      // Tax revenue
      const { data: payments } = await supabase
        .from("rent_payments")
        .select("tax_amount, status, landlord_confirmed")
        .or("status.eq.confirmed,landlord_confirmed.eq.true");
      const totalTaxCollected = (payments || []).reduce((sum: number, p: any) => sum + (p.tax_amount || 0), 0);

      setData({
        tenantsByRegion,
        complaintsByType,
        totalTenants: tenants?.length || 0,
        totalLandlords: landlords?.length || 0,
        citizenVsNonCitizen: [
          { name: "Citizens", value: citizens },
          { name: "Non-Citizens", value: nonCitizens },
        ],
        totalRevenue: ((tenants?.length || 0) + (landlords?.length || 0)) * 50,
        totalTaxCollected,
        regionBreakdown,
        propRegionMap,
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  // Build map markers from region breakdown
  const regionMarkers: MapMarker[] = (data.regionBreakdown || [])
    .map((r: any) => {
      const coords = GHANA_REGIONS[r.region];
      if (!coords) return null;
      const propCount = data.propRegionMap?.[r.region] || 0;
      return {
        lat: coords.lat,
        lng: coords.lng,
        label: r.region,
        detail: `${r.total} tenants (${r.citizens} citizens, ${r.nonCitizens} non-citizens) • ${propCount} properties`,
        color: r.total > 5 ? "green" as const : r.total > 0 ? "blue" as const : "gold" as const,
      };
    })
    .filter(Boolean) as MapMarker[];

  if (loading) return <LogoLoader message="Loading analytics..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" /> Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Statistical data, trends, and geographic insights</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Users className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold text-card-foreground">{data.totalTenants}</div>
          <div className="text-xs text-muted-foreground">Total Tenants</div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Building2 className="h-5 w-5 text-info mb-2" />
          <div className="text-2xl font-bold text-card-foreground">{data.totalLandlords}</div>
          <div className="text-xs text-muted-foreground">Total Landlords</div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <TrendingUp className="h-5 w-5 text-success mb-2" />
          <div className="text-2xl font-bold text-card-foreground">
            GH₵ {data.totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Registration Revenue</div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <CreditCard className="h-5 w-5 text-primary mb-2" />
          <div className="text-2xl font-bold text-card-foreground">
            GH₵ {data.totalTaxCollected.toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Rent Tax Collected</div>
        </div>
        <div className="bg-card rounded-xl p-5 shadow-card border border-border">
          <Users className="h-5 w-5 text-warning mb-2" />
          <div className="text-2xl font-bold text-card-foreground">
            {data.citizenVsNonCitizen.find((d: any) => d.name === "Non-Citizens")?.value || 0}
          </div>
          <div className="text-xs text-muted-foreground">Non-Citizen Tenants</div>
        </div>
      </div>

      {/* Geographic Map */}
      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" /> Regional Distribution Map
        </h2>
        {regionMarkers.length > 0 ? (
          <>
            <PropertyMap markers={regionMarkers} height="400px" zoom={7} />
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {data.regionBreakdown.map((r: any) => (
                <div key={r.region} className="text-sm bg-muted/50 rounded-lg px-3 py-2 flex justify-between items-center">
                  <span className="text-foreground font-medium truncate">{r.region}</span>
                  <div className="flex gap-2 text-xs shrink-0">
                    <span className="text-primary font-semibold">{r.total}</span>
                    {r.nonCitizens > 0 && (
                      <span className="text-warning">({r.nonCitizens} NC)</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-center py-12">No regional data yet</p>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tenants by Region</h2>
          {data.tenantsByRegion.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.tenantsByRegion}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="region" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(152,55%,38%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Citizen vs Non-Citizen Tenants</h2>
          {data.citizenVsNonCitizen.some((d: any) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.citizenVsNonCitizen} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {data.citizenVsNonCitizen.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">No data yet</p>
          )}
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Complaints by Type</h2>
          {data.complaintsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.complaintsByType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(43,85%,55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-muted-foreground text-center py-12">No complaints yet</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegulatorAnalytics;

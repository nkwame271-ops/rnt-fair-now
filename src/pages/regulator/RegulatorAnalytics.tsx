import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Users, Building2, TrendingUp, CreditCard } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      // Fetch tenants
      const { data: tenants } = await supabase.from("tenants").select("user_id");
      const tenantUserIds = (tenants || []).map(t => t.user_id);

      // Fetch profiles for tenant region & citizen data
      let regionMap: Record<string, number> = {};
      let citizens = 0, nonCitizens = 0;
      if (tenantUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, delivery_region, is_citizen")
          .in("user_id", tenantUserIds);

        (profiles || []).forEach((p: any) => {
          const region = p.delivery_region || "Unknown";
          regionMap[region] = (regionMap[region] || 0) + 1;
          if (p.is_citizen) citizens++; else nonCitizens++;
        });
      }

      const tenantsByRegion = Object.entries(regionMap)
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Complaints by type
      const { data: complaints } = await supabase.from("complaints").select("complaint_type");
      const typeMap: Record<string, number> = {};
      (complaints || []).forEach((c: any) => {
        typeMap[c.complaint_type] = (typeMap[c.complaint_type] || 0) + 1;
      });
      const complaintsByType = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

      // Landlords
      const { data: landlords } = await supabase.from("landlords").select("landlord_id");

      // Tax revenue from confirmed payments
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
      });
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><BarChart3 className="h-7 w-7 text-primary" /> Analytics & Reports</h1>
        <p className="text-muted-foreground mt-1">Statistical data and trends</p>
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

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Building2, FileText, AlertTriangle, TrendingUp, Shield } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { supabase } from "@/integrations/supabase/client";

const RegulatorDashboard = () => {
  const [stats, setStats] = useState({
    totalTenants: 0,
    totalLandlords: 0,
    totalProperties: 0,
    totalComplaints: 0,
    activeTenancies: 0,
    pendingComplaints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [tenants, landlords, properties, complaints, tenancies] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("landlords").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("complaints").select("id", { count: "exact", head: true }),
        supabase.from("tenancies").select("id", { count: "exact", head: true }).eq("status", "active"),
      ]);

      const pendingComplaints = await supabase
        .from("complaints")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "under_review"]);

      setStats({
        totalTenants: tenants.count || 0,
        totalLandlords: landlords.count || 0,
        totalProperties: properties.count || 0,
        totalComplaints: complaints.count || 0,
        activeTenancies: tenancies.count || 0,
        pendingComplaints: pendingComplaints.count || 0,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const statCards = [
    { label: "Registered Tenants", value: stats.totalTenants, icon: Users, color: "text-primary" },
    { label: "Registered Landlords", value: stats.totalLandlords, icon: Building2, color: "text-info" },
    { label: "Properties", value: stats.totalProperties, icon: Building2, color: "text-secondary-foreground" },
    { label: "Active Tenancies", value: stats.activeTenancies, icon: FileText, color: "text-success" },
    { label: "Total Complaints", value: stats.totalComplaints, icon: AlertTriangle, color: "text-warning" },
    { label: "Pending Complaints", value: stats.pendingComplaints, icon: AlertTriangle, color: "text-destructive" },
  ];

  if (loading) {
    return <LogoLoader message="Loading dashboard..." />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <Shield className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Rent Control Office</h1>
        </div>
        <p className="text-muted-foreground">System overview and compliance monitoring</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Quick Summary
        </h2>
        <div className="grid sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registration Revenue (est.)</span>
              <span className="font-semibold text-foreground">
                GH₵ {((stats.totalTenants + stats.totalLandlords) * 50).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Occupancy Rate</span>
              <span className="font-semibold text-foreground">
                {stats.totalProperties > 0
                  ? `${Math.round((stats.activeTenancies / Math.max(stats.totalProperties, 1)) * 100)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Complaint Resolution Rate</span>
              <span className="font-semibold text-foreground">
                {stats.totalComplaints > 0
                  ? `${Math.round(((stats.totalComplaints - stats.pendingComplaints) / stats.totalComplaints) * 100)}%`
                  : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">System Status</span>
              <span className="font-semibold text-success">Operational</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegulatorDashboard;

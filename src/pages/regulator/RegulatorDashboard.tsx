import { useEffect, useState } from "react";
import { Users, Building2, FileText, AlertTriangle, TrendingUp, Shield, Gavel, ShieldAlert } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { FeatureCard, type FeatureCardVariant } from "@/components/FeatureCard";
import { useMouseParallax } from "@/hooks/useMouseParallax";

const RegulatorDashboard = () => {
  const { profile } = useAdminProfile();
  const { ref: parallaxRef, styleFor } = useMouseParallax<HTMLDivElement>();
  const [stats, setStats] = useState({
    totalTenants: 0, totalLandlords: 0, totalProperties: 0,
    totalComplaints: 0, activeTenancies: 0, pendingComplaints: 0,
    pendingTerminations: 0, reportedSidePayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("all");

  // Sub admins are locked to their office
  const effectiveOffice = profile && !profile.isMainAdmin && profile.officeId
    ? profile.officeId
    : selectedOffice;

  useEffect(() => {
    const fetchOffices = async () => {
      const { data } = await supabase.from("offices").select("id, name").order("name");
      setOffices(data || []);
    };
    fetchOffices();
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      const officeFilter = effectiveOffice !== "all" ? effectiveOffice : null;

      let tenantsQ = supabase.from("tenants").select("id", { count: "exact", head: true });
      let landlordsQ = supabase.from("landlords").select("id", { count: "exact", head: true });
      let propertiesQ = supabase.from("properties").select("id", { count: "exact", head: true });
      let complaintsQ = supabase.from("complaints").select("id", { count: "exact", head: true });
      let tenanciesQ = supabase.from("tenancies").select("id", { count: "exact", head: true }).eq("status", "active");

      if (officeFilter) {
        propertiesQ = propertiesQ.eq("office_id", officeFilter);
        complaintsQ = complaintsQ.eq("office_id", officeFilter);
        tenanciesQ = tenanciesQ.eq("office_id", officeFilter);
      }

      const [tenants, landlords, properties, complaints, tenancies] = await Promise.all([
        tenantsQ, landlordsQ, propertiesQ, complaintsQ, tenanciesQ,
      ]);

      let pendingComplaintsQ = supabase.from("complaints").select("id", { count: "exact", head: true }).in("status", ["submitted", "under_review"]);
      let pendingTerminationsQ = supabase.from("termination_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review", "mediation"]);
      let reportedSidePaymentsQ = supabase.from("side_payment_declarations").select("id", { count: "exact", head: true }).in("status", ["reported", "under_investigation"]);

      if (officeFilter) {
        pendingComplaintsQ = pendingComplaintsQ.eq("office_id", officeFilter);
      }

      const [pendingComplaints, pendingTerminations, reportedSidePayments] = await Promise.all([
        pendingComplaintsQ, pendingTerminationsQ, reportedSidePaymentsQ,
      ]);

      setStats({
        totalTenants: tenants.count || 0, totalLandlords: landlords.count || 0,
        totalProperties: properties.count || 0, totalComplaints: complaints.count || 0,
        activeTenancies: tenancies.count || 0, pendingComplaints: pendingComplaints.count || 0,
        pendingTerminations: pendingTerminations.count || 0, reportedSidePayments: reportedSidePayments.count || 0,
      });

      setLoading(false);
    };
    fetchStats();
  }, [effectiveOffice]);

  const statCards = [
    { label: "Registered Tenants", value: stats.totalTenants, icon: Users, color: "text-primary" },
    { label: "Registered Landlords", value: stats.totalLandlords, icon: Building2, color: "text-info" },
    { label: "Properties", value: stats.totalProperties, icon: Building2, color: "text-secondary-foreground" },
    { label: "Active Tenancies", value: stats.activeTenancies, icon: FileText, color: "text-success" },
    { label: "Total Complaints", value: stats.totalComplaints, icon: AlertTriangle, color: "text-warning" },
    { label: "Pending Complaints", value: stats.pendingComplaints, icon: AlertTriangle, color: "text-destructive" },
    { label: "Pending Terminations", value: stats.pendingTerminations, icon: Gavel, color: "text-primary" },
    { label: "Side Payment Reports", value: stats.reportedSidePayments, icon: ShieldAlert, color: "text-warning" },
  ];

  if (loading && offices.length === 0) return <LogoLoader message="Loading dashboard..." />;

  return (
    <PageTransition>
      <div ref={parallaxRef} className="max-w-6xl mx-auto space-y-8 relative">
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-primary/15 blur-3xl -z-10" style={styleFor("bg")} />
        <div aria-hidden className="pointer-events-none absolute top-40 -right-24 w-96 h-96 rounded-full bg-secondary/20 blur-3xl -z-10" style={styleFor("bg")} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-start gap-3 mb-1">
              <Shield className="h-6 w-6 text-primary shrink-0 mt-0.5" />
              <h1 className="text-xl sm:text-3xl font-bold text-foreground leading-tight break-words">Rent Control Office</h1>
            </div>
            <p className="text-muted-foreground text-xs sm:text-base break-words">System overview and compliance monitoring</p>
          </div>

          {profile?.isMainAdmin && (
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="All Offices (National)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices (National)</SelectItem>
                {offices.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {profile && !profile.isMainAdmin && profile.officeName && (
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border truncate max-w-full whitespace-nowrap overflow-hidden text-ellipsis">
              📍 {profile.officeName}
            </div>
          )}
        </div>

        {loading ? (
          <LogoLoader message="Loading stats..." />
        ) : (
          <>
            <div data-stagger className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative" style={styleFor("fg")}>
              {[
                { variant: "primary" as FeatureCardVariant, eyebrow: "This week", title: "Active tenancies under management", value: stats.activeTenancies, icon: <FileText className="h-5 w-5" /> },
                { variant: "teal" as FeatureCardVariant, eyebrow: "Live", title: "Open complaints awaiting review", value: stats.pendingComplaints, icon: <AlertTriangle className="h-5 w-5" /> },
                { variant: "dark" as FeatureCardVariant, eyebrow: "Total", title: "Registered properties on platform", value: stats.totalProperties, icon: <Building2 className="h-5 w-5" /> },
                { variant: "amber" as FeatureCardVariant, eyebrow: "Action needed", title: "Pending termination cases", value: stats.pendingTerminations, icon: <Gavel className="h-5 w-5" /> },
              ].map((c) => (
                <FeatureCard key={c.title} variant={c.variant} eyebrow={c.eyebrow} title={c.title} icon={c.icon} value={<AnimatedCounter value={c.value} />} />
              ))}
            </div>

            <div data-stagger className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 relative" style={styleFor("mid")}>
              {statCards.map((stat) => (
                <div key={stat.label} className="bg-card rounded-xl p-3 sm:p-5 border border-border w-full min-w-0 overflow-hidden">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <stat.icon className={`h-5 w-5 shrink-0 ${stat.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-2xl sm:text-3xl font-bold text-card-foreground leading-none">
                        <AnimatedCounter value={stat.value} />
                      </div>
                      <div className="text-xs sm:text-[11px] text-muted-foreground mt-1 truncate">{stat.label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Quick Summary
              </h2>
              <div className="grid sm:grid-cols-2 gap-6 text-sm">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Occupancy Rate</span>
                    <span className="font-semibold text-foreground">
                      {stats.totalProperties > 0
                        ? <><AnimatedCounter value={Math.round((stats.activeTenancies / Math.max(stats.totalProperties, 1)) * 100)} suffix="%" /></>
                        : "N/A"}
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Complaint Resolution Rate</span>
                    <span className="font-semibold text-foreground">
                      {stats.totalComplaints > 0
                        ? <><AnimatedCounter value={Math.round(((stats.totalComplaints - stats.pendingComplaints) / stats.totalComplaints) * 100)} suffix="%" /></>
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
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default RegulatorDashboard;

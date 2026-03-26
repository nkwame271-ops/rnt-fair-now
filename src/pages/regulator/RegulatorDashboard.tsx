import { useEffect, useState } from "react";
import { Users, Building2, FileText, AlertTriangle, TrendingUp, Shield, Gavel, ShieldAlert, CalendarDays } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { Badge } from "@/components/ui/badge";

interface ScheduleItem {
  id: string;
  complaint_id: string;
  complaint_code: string;
  complainant_name: string;
  complaint_type: string;
  status: string;
  selected_slot: any;
  available_slots: any;
}

const RegulatorDashboard = () => {
  const { profile } = useAdminProfile();
  const [stats, setStats] = useState({
    totalTenants: 0, totalLandlords: 0, totalProperties: 0,
    totalComplaints: 0, activeTenancies: 0, pendingComplaints: 0,
    pendingTerminations: 0, reportedSidePayments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [upcomingSchedules, setUpcomingSchedules] = useState<ScheduleItem[]>([]);

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

      // Build queries with optional office filter
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

      // Fetch upcoming appointment schedules
      const { data: schedules } = await supabase
        .from("complaint_schedules")
        .select("*")
        .in("status", ["pending_selection", "confirmed"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (schedules && schedules.length > 0) {
        const complaintIds = schedules.map((s: any) => s.complaint_id);
        // Fetch from both complaint tables
        const [{ data: tenantComplaints }, { data: landlordComplaints }] = await Promise.all([
          supabase.from("complaints").select("id, complaint_code, tenant_user_id").in("id", complaintIds),
          supabase.from("landlord_complaints").select("id, complaint_code, landlord_user_id").in("id", complaintIds),
        ]);

        const userIds = [
          ...(tenantComplaints || []).map((c: any) => c.tenant_user_id),
          ...(landlordComplaints || []).map((c: any) => c.landlord_user_id),
        ];
        const { data: profiles } = userIds.length > 0
          ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : { data: [] };
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

        const tcMap = new Map((tenantComplaints || []).map((c: any) => [c.id, { code: c.complaint_code, userId: c.tenant_user_id }]));
        const lcMap = new Map((landlordComplaints || []).map((c: any) => [c.id, { code: c.complaint_code, userId: c.landlord_user_id }]));

        const items: ScheduleItem[] = schedules.map((s: any) => {
          const tc = tcMap.get(s.complaint_id);
          const lc = lcMap.get(s.complaint_id);
          const info = tc || lc;
          return {
            id: s.id,
            complaint_id: s.complaint_id,
            complaint_code: info?.code || "—",
            complainant_name: profileMap.get(info?.userId) || "Unknown",
            complaint_type: s.complaint_type,
            status: s.status,
            selected_slot: s.selected_slot,
            available_slots: s.available_slots,
          };
        });
        setUpcomingSchedules(items);
      } else {
        setUpcomingSchedules([]);
      }

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
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Rent Control Office</h1>
            </div>
            <p className="text-muted-foreground">System overview and compliance monitoring</p>
          </div>

          {profile?.isMainAdmin && (
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-64">
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
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              📍 {profile.officeName}
            </div>
          )}
        </div>

        {loading ? (
          <LogoLoader message="Loading stats..." />
        ) : (
          <>
            <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {statCards.map((stat) => (
                <StaggeredItem key={stat.label}>
                  <div className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                    <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                    <div className="text-2xl font-bold text-card-foreground">
                      <AnimatedCounter value={stat.value} />
                    </div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                </StaggeredItem>
              ))}
            </StaggeredGrid>

            {/* Upcoming Appointments */}
            {upcomingSchedules.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  Upcoming Appointments
                </h2>
                <div className="space-y-3">
                  {upcomingSchedules.map((s) => {
                    const slotDate = s.selected_slot?.date
                      ? new Date(s.selected_slot.date).toLocaleDateString("en-GB")
                      : "Pending selection";
                    const slotTime = s.selected_slot?.time || "";
                    return (
                      <div key={s.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border-border/50">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <CalendarDays className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-card-foreground">{s.complaint_code}</div>
                            <div className="text-xs text-muted-foreground">{s.complainant_name} • {s.complaint_type === "landlord" ? "Landlord" : "Tenant"}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-card-foreground">{slotDate} {slotTime}</div>
                          <Badge className={s.status === "confirmed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                            {s.status === "confirmed" ? "Confirmed" : "Awaiting Selection"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                      GH₵ <AnimatedCounter value={(stats.totalTenants * 40) + (stats.totalLandlords * 30)} />
                    </span>
                  </div>
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

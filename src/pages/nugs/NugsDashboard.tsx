import { useEffect, useState } from "react";
import { GraduationCap, AlertTriangle, CheckCircle2, Clock, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import AnimatedCounter from "@/components/AnimatedCounter";

const NugsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalStudents: 0,
    institutions: 0,
    totalComplaints: 0,
    pendingComplaints: 0,
    resolvedComplaints: 0,
    scheduledComplaints: 0,
  });

  useEffect(() => {
    const load = async () => {
      const [studentsRes, complaintsRes, schedulesRes] = await Promise.all([
        supabase.from("tenants").select("school", { count: "exact" }).eq("is_student", true),
        supabase.from("complaints").select("status"),
        supabase.from("complaint_schedules").select("id", { count: "exact", head: true }),
      ]);

      const schools = new Set(
        (studentsRes.data || []).map((s: any) => (s.school || "").trim()).filter(Boolean)
      );
      const complaints = complaintsRes.data || [];

      setStats({
        totalStudents: studentsRes.count || 0,
        institutions: schools.size,
        totalComplaints: complaints.length,
        pendingComplaints: complaints.filter((c: any) =>
          ["submitted", "under_review", "in_progress"].includes(c.status)
        ).length,
        resolvedComplaints: complaints.filter((c: any) =>
          ["resolved", "closed"].includes(c.status)
        ).length,
        scheduledComplaints: schedulesRes.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  const cards = [
    { label: "Students Registered", value: stats.totalStudents, icon: GraduationCap, color: "text-primary" },
    { label: "Institutions", value: stats.institutions, icon: Building2, color: "text-info" },
    { label: "Total Complaints", value: stats.totalComplaints, icon: AlertTriangle, color: "text-warning" },
    { label: "Pending", value: stats.pendingComplaints, icon: Clock, color: "text-warning" },
    { label: "Resolved", value: stats.resolvedComplaints, icon: CheckCircle2, color: "text-success" },
    { label: "Scheduled Hearings", value: stats.scheduledComplaints, icon: Clock, color: "text-info" },
  ];

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">NUGS Monitoring Overview</h1>
          <p className="text-muted-foreground mt-1">
            Read-only visibility into student tenants and their complaints across the platform
          </p>
        </div>

        <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((stat) => (
            <StaggeredItem key={stat.label}>
              <div className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <div className="text-3xl font-bold text-card-foreground">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </StaggeredItem>
          ))}
        </StaggeredGrid>
      </div>
    </PageTransition>
  );
};

export default NugsDashboard;

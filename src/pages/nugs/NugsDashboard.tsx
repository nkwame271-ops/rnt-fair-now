import { useEffect, useState } from "react";
import { GraduationCap, AlertTriangle, CheckCircle2, Clock, Building2, Loader2, Store, FileText, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import PageTransition from "@/components/PageTransition";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Button } from "@/components/ui/button";
import { FeatureCard, type FeatureCardVariant } from "@/components/FeatureCard";
import UpdateResidenceDialog from "@/components/student/UpdateResidenceDialog";
import StudentResidenceTrail from "@/components/student/StudentResidenceTrail";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";

const AdminView = () => {
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
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">NUGS Monitoring Overview</h1>
        <p className="text-muted-foreground mt-1">
          Read-only visibility into student tenants and their complaints across the platform
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { variant: "primary" as FeatureCardVariant, eyebrow: "Registered", title: "Students on the platform", value: stats.totalStudents, icon: <GraduationCap className="h-5 w-5" /> },
          { variant: "teal" as FeatureCardVariant, eyebrow: "Coverage", title: "Active institutions", value: stats.institutions, icon: <Building2 className="h-5 w-5" /> },
          { variant: "amber" as FeatureCardVariant, eyebrow: "Pending", title: "Open student complaints", value: stats.pendingComplaints, icon: <Clock className="h-5 w-5" /> },
          { variant: "dark" as FeatureCardVariant, eyebrow: "Resolved", title: "Closed complaint cases", value: stats.resolvedComplaints, icon: <CheckCircle2 className="h-5 w-5" /> },
        ].map((c) => (
          <FeatureCard key={c.title} variant={c.variant} eyebrow={c.eyebrow} title={c.title} icon={c.icon} value={<AnimatedCounter value={c.value} />} />
        ))}
      </div>

      <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((stat) => (
          <StaggeredItem key={stat.label}>
            <div className="bg-card rounded-xl p-5 border border-border">
              <div className="flex items-center gap-3">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
                <div>
                  <div className="text-3xl font-bold text-card-foreground leading-none">
                    <AnimatedCounter value={stat.value} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{stat.label}</div>
                </div>
              </div>
            </div>
          </StaggeredItem>
        ))}
      </StaggeredGrid>
    </div>
  );
};

const StudentView = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [complaints, setComplaints] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profRes, tenRes, compRes] = await Promise.all([
        supabase.from("profiles").select("full_name, phone, email").eq("user_id", user.id).maybeSingle(),
        supabase.from("tenants").select("tenant_id, school, hostel_or_hall, room_or_bed_space, status").eq("user_id", user.id).maybeSingle(),
        supabase.from("complaints").select("id, complaint_code, complaint_type, status, created_at").eq("tenant_user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setProfile(profRes.data);
      setTenant(tenRes.data);
      setComplaints(compRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  const pendingCount = complaints.filter(c => ["submitted", "under_review", "in_progress"].includes(c.status)).length;
  const resolvedCount = complaints.filter(c => ["resolved", "closed"].includes(c.status)).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-primary" />
          Welcome, {profile?.full_name?.split(" ")[0] || "Student"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Your NUGS-supported student housing dashboard
        </p>
      </div>

      {/* Student info card — read-only overview */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-card">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Student ID</p>
            <p className="font-mono font-bold text-primary">{tenant?.tenant_id || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Institution</p>
            <p className="font-medium text-foreground">{tenant?.school || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Hostel / Hall</p>
            <p className="font-medium text-foreground">{tenant?.hostel_or_hall || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Room / Bed</p>
            <p className="font-medium text-foreground">{tenant?.room_or_bed_space || "—"}</p>
          </div>
        </div>
      </div>

      {/* Hostel Accommodation — separate feature */}
      <div className="bg-card rounded-xl p-6 border border-border shadow-card space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Hostel Accommodation
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Update your school, hostel, or room. Previous records are kept in your residence history.
            </p>
          </div>
          <UpdateResidenceDialog
            current={tenant ? { school: tenant.school, hostel_or_hall: tenant.hostel_or_hall, room_or_bed_space: tenant.room_or_bed_space } : null}
            onUpdated={async () => {
              const { data } = await supabase.from("tenants").select("tenant_id, school, hostel_or_hall, room_or_bed_space, status").eq("user_id", user!.id).maybeSingle();
              setTenant(data);
            }}
          />
        </div>

        {user && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
              <History className="h-3.5 w-3.5" /> View residence history
              <ChevronDown className="h-3.5 w-3.5" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <StudentResidenceTrail tenantUserId={user.id} compact />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      {/* Quick stats */}
      <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StaggeredItem>
          <div className="bg-card rounded-xl p-5 shadow-card border border-border">
            <AlertTriangle className="h-5 w-5 text-warning mb-2" />
            <div className="text-3xl font-bold text-card-foreground"><AnimatedCounter value={complaints.length} /></div>
            <div className="text-xs text-muted-foreground">My Complaints</div>
          </div>
        </StaggeredItem>
        <StaggeredItem>
          <div className="bg-card rounded-xl p-5 shadow-card border border-border">
            <Clock className="h-5 w-5 text-info mb-2" />
            <div className="text-3xl font-bold text-card-foreground"><AnimatedCounter value={pendingCount} /></div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </StaggeredItem>
        <StaggeredItem>
          <div className="bg-card rounded-xl p-5 shadow-card border border-border">
            <CheckCircle2 className="h-5 w-5 text-success mb-2" />
            <div className="text-3xl font-bold text-card-foreground"><AnimatedCounter value={resolvedCount} /></div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </div>
        </StaggeredItem>
      </StaggeredGrid>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Button onClick={() => navigate("/nugs/marketplace")} className="h-auto py-5 flex flex-col items-start gap-2 text-left">
          <Store className="h-5 w-5" />
          <div>
            <p className="font-semibold">Browse Hostel Listings</p>
            <p className="text-xs opacity-80 font-normal">Find approved student accommodation</p>
          </div>
        </Button>
        <Button onClick={() => navigate("/nugs/file-complaint")} variant="outline" className="h-auto py-5 flex flex-col items-start gap-2 text-left">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-semibold">File a Complaint</p>
            <p className="text-xs opacity-80 font-normal">Report issues with your hostel or landlord</p>
          </div>
        </Button>
      </div>

      {/* Recent complaints */}
      {complaints.length > 0 && (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><FileText className="h-4 w-4" /> My Recent Complaints</h2>
            <Button size="sm" variant="ghost" onClick={() => navigate("/nugs/my-complaints")}>View all</Button>
          </div>
          <div className="divide-y divide-border">
            {complaints.slice(0, 5).map((c) => (
              <div key={c.id} className="px-5 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-mono font-bold text-primary">{c.complaint_code}</p>
                  <p className="text-muted-foreground capitalize">{c.complaint_type?.replace(/_/g, " ")}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted text-foreground capitalize">
                    {c.status?.replace(/_/g, " ")}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(c.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const NugsDashboard = () => {
  const { role } = useAuth();
  return (
    <PageTransition>
      {role === "nugs_admin" ? <AdminView /> : <StudentView />}
    </PageTransition>
  );
};

export default NugsDashboard;

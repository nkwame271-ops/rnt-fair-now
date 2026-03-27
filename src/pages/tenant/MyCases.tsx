import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle2, AlertTriangle, Loader2, CreditCard, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import AppointmentSlotPicker from "@/components/AppointmentSlotPicker";

const statusIcon: Record<string, React.ReactNode> = {
  pending_payment: <CreditCard className="h-4 w-4 text-warning" />,
  submitted: <Clock className="h-4 w-4 text-info" />,
  under_review: <AlertTriangle className="h-4 w-4 text-warning" />,
  in_progress: <Clock className="h-4 w-4 text-primary" />,
  schedule_complainant: <CalendarDays className="h-4 w-4 text-accent-foreground" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const statusColors: Record<string, string> = {
  pending_payment: "bg-warning/10 text-warning",
  submitted: "bg-info/10 text-info",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  schedule_complainant: "bg-accent/10 text-accent-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  submitted: "Submitted",
  under_review: "Under Review",
  in_progress: "In Progress",
  schedule_complainant: "Scheduling",
  resolved: "Resolved",
  closed: "Closed",
};

const MyCases = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [scheduleMap, setScheduleMap] = useState<Record<string, any>>({});

  const fetchComplaints = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false });
    setComplaints(data || []);

    // Fetch schedules for all complaints
    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: schedules } = await supabase
        .from("complaint_schedules")
        .select("*")
        .in("complaint_id", ids)
        .in("status", ["pending_selection", "confirmed"]);
      if (schedules) {
        const map: Record<string, any> = {};
        schedules.forEach((s: any) => { map[s.complaint_id] = s; });
        setScheduleMap(map);
      }
    }

    setLoading(false);
  };

  // Auto-verify payment on return from Paystack
  useEffect(() => {
    if (!user) return;
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (reference) {
      const verifyPayment = async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-payment", {
            body: { reference },
          });
          if (data?.verified) {
            toast.success("Payment confirmed! Your complaint has been submitted.");
          }
        } catch (_) {}
        setSearchParams({}, { replace: true });
        await new Promise((r) => setTimeout(r, 1500));
        await fetchComplaints();
        setTimeout(() => fetchComplaints(), 3000);
      };
      verifyPayment();
    } else {
      fetchComplaints();
    }
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Cases</h1>
        <p className="text-muted-foreground mt-1">Track the status of your complaints</p>
      </div>

      {/* Appointment scheduling cards */}
      <AppointmentSlotPicker complaintTable="complaints" userIdColumn="tenant_user_id" />

      {complaints.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No complaints filed yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Use "File Complaint" to report a tenancy violation.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-bold text-card-foreground">{c.complaint_code}</span>
                  </div>
                  <h3 className="font-semibold text-card-foreground mt-1">{c.complaint_type}</h3>
                </div>
                <span
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}
                >
                  {statusIcon[c.status]}
                  {statusLabel[c.status] || c.status.replace("_", " ")}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Landlord: <span className="text-card-foreground font-medium">{c.landlord_name}</span></div>
                <div>Property: <span className="text-card-foreground font-medium">{c.property_address}</span></div>
                <div>Filed: <span className="text-card-foreground font-medium">{new Date(c.created_at).toLocaleDateString()}</span></div>
                <div>Updated: <span className="text-card-foreground font-medium">{new Date(c.updated_at).toLocaleDateString()}</span></div>
              </div>

              {/* Appointment info */}
              {scheduleMap[c.id] && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" /> Appointment
                  </div>
                  {scheduleMap[c.id].status === "confirmed" && scheduleMap[c.id].selected_slot ? (
                    <div className="text-sm mt-1">
                      <span className="font-medium text-foreground">
                        {new Date(scheduleMap[c.id].selected_slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </span>{" "}
                      <span className="text-muted-foreground">{scheduleMap[c.id].selected_slot.time_start} — {scheduleMap[c.id].selected_slot.time_end}</span>
                      <span className="ml-2 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Confirmed</span>
                    </div>
                  ) : (
                    <div className="text-sm mt-1 text-warning font-medium">Awaiting your slot selection (check above)</div>
                  )}
                </div>
              )}

              <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCases;

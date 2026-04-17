import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FileText, Clock, CheckCircle2, AlertTriangle, Loader2, CreditCard, Hash, Receipt, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const statusColors: Record<string, string> = {
  awaiting_payment: "bg-info/10 text-info",
  submitted: "bg-info/10 text-info",
  pending_payment: "bg-warning/10 text-warning",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  ready_for_scheduling: "bg-primary/10 text-primary",
  scheduled: "bg-accent/10 text-accent-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  awaiting_payment: "Submitted — Awaiting Review",
  submitted: "Submitted",
  pending_payment: "Payment Requested",
  under_review: "Under Review",
  in_progress: "In Progress",
  ready_for_scheduling: "Ready for Scheduling",
  scheduled: "Scheduled",
  resolved: "Resolved",
  closed: "Closed",
};

const NugsMyComplaints = () => {
  const { user, role } = useAuth();
  const [isStudent, setIsStudent] = useState<boolean | null>(null);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("tenants").select("is_student").eq("user_id", user.id).maybeSingle();
      setIsStudent(!!data?.is_student);
    })();
  }, [user]);

  const fetchComplaints = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false });
    setComplaints(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isStudent) fetchComplaints();
  }, [isStudent]);

  const handlePayNow = async (complaint: any) => {
    setPaying(complaint.id);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "complaint_fee", complaintId: complaint.id },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.authorization_url) {
        if ((data as any)?.reference) sessionStorage.setItem("pendingPaymentReference", (data as any).reference);
        window.location.href = (data as any).authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not start payment");
    } finally {
      setPaying(null);
    }
  };

  // Non-student users (e.g. nugs_admin) shouldn't see this page
  if (isStudent === false && role !== "tenant") {
    return <Navigate to="/nugs/dashboard" replace />;
  }
  if (isStudent === false) {
    return <Navigate to="/tenant/my-cases" replace />;
  }
  if (isStudent === null || loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Complaints</h1>
        <p className="text-muted-foreground mt-1">Track the status of complaints you have filed</p>
      </div>

      {complaints.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No complaints filed yet</h3>
          <p className="text-sm text-muted-foreground mt-1">When you file a complaint it will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {complaints.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="font-bold text-card-foreground">{c.complaint_code}</span>
                    {c.ticket_number && (
                      <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        <Hash className="h-3 w-3" /> {c.ticket_number}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-card-foreground mt-1">{c.complaint_type}</h3>
                </div>
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}>
                  {statusLabel[c.status] || c.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>Landlord: <span className="text-card-foreground font-medium">{c.landlord_name}</span></div>
                <div>Property: <span className="text-card-foreground font-medium">{c.property_address}</span></div>
                <div>Filed: <span className="text-card-foreground font-medium">{new Date(c.created_at).toLocaleDateString()}</span></div>
                <div>Updated: <span className="text-card-foreground font-medium">{new Date(c.updated_at).toLocaleDateString()}</span></div>
              </div>

              {c.status === "pending_payment" && c.payment_status === "pending" && Number(c.outstanding_amount) > 0 && (
                <div className="mt-3 bg-warning/5 border border-warning/30 rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <CreditCard className="h-4 w-4 text-warning" /> Filing fee requested
                    </div>
                    <div className="text-lg font-bold text-foreground mt-1">
                      GH₵ {Number(c.outstanding_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <Button onClick={() => handlePayNow(c)} disabled={paying === c.id}>
                    {paying === c.id ? "Processing..." : "Pay Now"}
                  </Button>
                </div>
              )}

              {c.payment_status === "paid" && (
                <div className="mt-3 bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-success" />
                  <span className="text-foreground"><strong>Filing fee paid.</strong> Your complaint is ready for scheduling.</span>
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

export default NugsMyComplaints;

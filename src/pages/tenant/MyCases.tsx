import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle2, AlertTriangle, Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

const statusIcon: Record<string, React.ReactNode> = {
  pending_payment: <CreditCard className="h-4 w-4 text-warning" />,
  submitted: <Clock className="h-4 w-4 text-info" />,
  under_review: <AlertTriangle className="h-4 w-4 text-warning" />,
  in_progress: <Clock className="h-4 w-4 text-primary" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const statusColors: Record<string, string> = {
  pending_payment: "bg-warning/10 text-warning",
  submitted: "bg-info/10 text-info",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const statusLabel: Record<string, string> = {
  pending_payment: "Awaiting Payment",
  submitted: "Submitted",
  under_review: "Under Review",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

const MyCases = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Auto-verify payment on return from Paystack
  useEffect(() => {
    if (!user) return;
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (reference) {
      const verifyPayment = async () => {
        try {
          const { data, error } = await supabase.functions.invoke("verify-payment", {
            body: { reference },
          });
          if (data?.verified) {
            toast.success("Payment confirmed! Your complaint has been submitted.");
          }
        } catch (_) {}
        setSearchParams({}, { replace: true });
        fetchComplaints();
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
              <p className="text-sm text-muted-foreground mt-3 border-t border-border pt-3">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyCases;

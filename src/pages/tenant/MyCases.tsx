import { useEffect, useState } from "react";
import { FileText, Clock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const statusIcon: Record<string, React.ReactNode> = {
  submitted: <Clock className="h-4 w-4 text-info" />,
  under_review: <AlertTriangle className="h-4 w-4 text-warning" />,
  in_progress: <Clock className="h-4 w-4 text-primary" />,
  resolved: <CheckCircle2 className="h-4 w-4 text-success" />,
  closed: <CheckCircle2 className="h-4 w-4 text-muted-foreground" />,
};

const statusColors: Record<string, string> = {
  submitted: "bg-info/10 text-info",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const MyCases = () => {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchComplaints = async () => {
      const { data } = await supabase
        .from("complaints")
        .select("*")
        .eq("tenant_user_id", user.id)
        .order("created_at", { ascending: false });
      setComplaints(data || []);
      setLoading(false);
    };
    fetchComplaints();
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
                  {c.status.replace("_", " ")}
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

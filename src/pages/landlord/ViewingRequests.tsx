import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Eye, Check, X, Calendar, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LandlordViewingRequests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("viewing_requests")
      .select("*, units(unit_name, unit_type, monthly_rent), properties(property_name, address)")
      .eq("landlord_user_id", user.id)
      .order("created_at", { ascending: false });
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [user]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("viewing_requests").update({ status }).eq("id", id);
    toast.success(`Viewing request ${status}`);
    fetchRequests();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Eye className="h-7 w-7 text-primary" /> Viewing Requests</h1>
        <p className="text-muted-foreground mt-1">Tenants who want to view your properties</p>
      </div>

      {requests.length === 0 ? (
        <div className="bg-card rounded-xl p-12 shadow-card border border-border text-center">
          <Eye className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No viewing requests yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div key={req.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-card-foreground">{req.properties?.property_name || "Property"} — {req.units?.unit_name}</h3>
                  <p className="text-sm text-muted-foreground">{req.units?.unit_type} · GH₵ {req.units?.monthly_rent}/mo</p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  req.status === "pending" ? "bg-warning/10 text-warning" :
                  req.status === "accepted" ? "bg-success/10 text-success" :
                  req.status === "declined" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>{req.status}</span>
              </div>
              {req.preferred_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-3.5 w-3.5" /> Preferred: {new Date(req.preferred_date).toLocaleDateString()} {req.preferred_time && `at ${req.preferred_time}`}
                </div>
              )}
              {req.message && <p className="text-sm text-muted-foreground mb-3">"{req.message}"</p>}
              {req.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateStatus(req.id, "accepted")}><Check className="h-4 w-4 mr-1" /> Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(req.id, "declined")}><X className="h-4 w-4 mr-1" /> Decline</Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LandlordViewingRequests;

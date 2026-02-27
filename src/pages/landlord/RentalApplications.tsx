import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Loader2, FileText, User, Phone, Mail, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface Application {
  id: string;
  tenant_user_id: string;
  property_id: string;
  unit_id: string;
  status: string;
  created_at: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  tenant_occupation: string;
  tenant_ghana_card: string;
  property_name: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
}

const RentalApplications = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rental_applications")
      .select("*")
      .eq("landlord_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) { setApps([]); setLoading(false); return; }

    const tenantIds = [...new Set(data.map(a => a.tenant_user_id))];
    const unitIds = [...new Set(data.map(a => a.unit_id))];
    const propIds = [...new Set(data.map(a => a.property_id))];

    const [{ data: profiles }, { data: units }, { data: props }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, phone, email, occupation, ghana_card_no").in("user_id", tenantIds),
      supabase.from("units").select("id, unit_name, unit_type, monthly_rent").in("id", unitIds),
      supabase.from("properties").select("id, property_name").in("id", propIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const unitMap = new Map((units || []).map(u => [u.id, u]));
    const propMap = new Map((props || []).map(p => [p.id, p]));

    setApps(data.map(a => {
      const profile = profileMap.get(a.tenant_user_id);
      const unit = unitMap.get(a.unit_id);
      const prop = propMap.get(a.property_id);
      return {
        ...a,
        tenant_name: profile?.full_name || "Unknown",
        tenant_phone: profile?.phone || "",
        tenant_email: profile?.email || "",
        tenant_occupation: profile?.occupation || "",
        tenant_ghana_card: profile?.ghana_card_no || "",
        property_name: prop?.property_name || "Property",
        unit_name: unit?.unit_name || "Unit",
        unit_type: unit?.unit_type || "",
        monthly_rent: unit?.monthly_rent || 0,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, [user]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("rental_applications").update({ status }).eq("id", id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(`Application ${status}`);
    fetchApps();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><FileText className="h-7 w-7 text-primary" /> Rental Applications</h1>
        <p className="text-muted-foreground mt-1">Review tenant applications for your properties</p>
      </div>

      {apps.length === 0 ? (
        <div className="bg-card rounded-xl p-12 border border-border text-center">
          <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No rental applications yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {apps.map(app => (
            <div key={app.id} className="bg-card rounded-xl p-5 border border-border shadow-card space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-card-foreground">{app.property_name} — {app.unit_name}</h3>
                  <p className="text-sm text-muted-foreground">{app.unit_type} · GH₵ {app.monthly_rent.toLocaleString()}/mo</p>
                </div>
                <Badge variant={app.status === "pending" ? "secondary" : app.status === "approved" ? "default" : "destructive"}>
                  {app.status}
                </Badge>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-muted-foreground" /> <span className="font-medium">{app.tenant_name}</span></div>
                <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> <span>{app.tenant_phone || "—"}</span></div>
                <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> <span>{app.tenant_email || "—"}</span></div>
                <div className="flex items-center gap-2"><Briefcase className="h-3.5 w-3.5 text-muted-foreground" /> <span>{app.tenant_occupation || "—"}</span></div>
              </div>
              {app.tenant_ghana_card && (
                <p className="text-xs text-muted-foreground">Ghana Card: {app.tenant_ghana_card}</p>
              )}
              <p className="text-xs text-muted-foreground">Applied: {new Date(app.created_at).toLocaleDateString()}</p>

              {app.status === "pending" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateStatus(app.id, "approved")}><Check className="h-4 w-4 mr-1" /> Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => updateStatus(app.id, "rejected")}><X className="h-4 w-4 mr-1" /> Reject</Button>
                  <Link to="/landlord/add-tenant" className="ml-auto">
                    <Button size="sm" variant="secondary">Add as Tenant</Button>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RentalApplications;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gavel, CheckCircle, XCircle, Scale, ShieldAlert, Trash2 } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

const RegulatorTerminations = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [termApps, setTermApps] = useState<any[]>([]);
  const [sidePayments, setSidePayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (password: string, reason: string) => {
    if (!deletingId) return;
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action: "delete_termination", target_id: deletingId, reason, password },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setTermApps(prev => prev.filter(a => a.id !== deletingId));
    toast.success("Termination application permanently deleted");
  };

  const load = async () => {
    const [{ data: apps }, { data: sp }] = await Promise.all([
      supabase.from("termination_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("side_payment_declarations").select("*").order("created_at", { ascending: false }),
    ]);
    setTermApps(apps || []);
    setSidePayments(sp || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleTermAction = async (id: string, action: "approved" | "rejected" | "mediation" | "under_review") => {
    setProcessing(id);
    try {
      const { error } = await supabase.from("termination_applications").update({
        status: action,
        reviewer_user_id: user!.id,
        reviewer_notes: notes[id] || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      // If approved, terminate the tenancy and recalculate compliance
      if (action === "approved") {
        const app = termApps.find(a => a.id === id);
        if (app) {
          await supabase.from("tenancies").update({
            status: "terminated",
            terminated_at: new Date().toISOString(),
            termination_reason: `${app.applicant_role}_request_approved`,
          }).eq("id", app.tenancy_id);

          // Get landlord_user_id for compliance recalculation
          const { data: tenancy } = await supabase.from("tenancies").select("landlord_user_id, tenant_user_id, unit_id, registration_code").eq("id", app.tenancy_id).single();
          if (tenancy) {
            // Revert unit to vacant
            await supabase.from("units").update({ status: "vacant" }).eq("id", tenancy.unit_id);
            // Recalculate compliance if tenant-initiated
            if (app.applicant_role === "tenant") {
              await supabase.rpc("recalculate_compliance_score", { p_landlord_user_id: tenancy.landlord_user_id });
            }
            // Notify both
            await supabase.from("notifications").insert([
              { user_id: tenancy.tenant_user_id, title: "Termination Approved", body: `Tenancy ${tenancy.registration_code} has been terminated by the Rent Control Office.`, link: "/tenant/my-agreements" },
              { user_id: tenancy.landlord_user_id, title: "Termination Approved", body: `Tenancy ${tenancy.registration_code} has been terminated. The unit is now vacant.`, link: "/landlord/agreements" },
            ]);
          }
        }
      }

      toast.success(`Application ${action}`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleSidePaymentAction = async (id: string, action: "confirmed" | "dismissed" | "under_investigation") => {
    setProcessing(id);
    try {
      const { error } = await supabase.from("side_payment_declarations").update({ status: action }).eq("id", id);
      if (error) throw error;

      if (action === "confirmed") {
        const sp = sidePayments.find(s => s.id === id);
        if (sp) {
          const { data: tenancy } = await supabase.from("tenancies").select("landlord_user_id").eq("id", sp.tenancy_id).single();
          if (tenancy) {
            await supabase.rpc("recalculate_compliance_score", { p_landlord_user_id: tenancy.landlord_user_id });
          }
        }
      }

      toast.success(`Declaration ${action}`);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <LogoLoader message="Loading terminations..." />;

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": case "reported": return "bg-warning/10 text-warning";
      case "under_review": case "under_investigation": return "bg-info/10 text-info";
      case "mediation": return "bg-primary/10 text-primary";
      case "approved": case "confirmed": return "bg-success/10 text-success";
      case "rejected": case "dismissed": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-6 w-6 text-primary" />
            Terminations & Side Payments
          </h1>
          <p className="text-muted-foreground text-sm">Review termination applications and side-payment declarations.</p>
        </div>

        <Tabs defaultValue="terminations">
          <TabsList>
            <TabsTrigger value="terminations">Termination Apps ({termApps.length})</TabsTrigger>
            <TabsTrigger value="side-payments">Side Payments ({sidePayments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="terminations" className="space-y-4 mt-4">
            {termApps.length === 0 ? (
              <EmptyState icon={Gavel} title="No Termination Applications" description="No applications have been filed yet." />
            ) : termApps.map(app => (
              <Card key={app.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{app.reason.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                      <Badge className={`ml-2 ${statusColor(app.status)}`}>{app.status}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      By {app.applicant_role} · {format(new Date(app.created_at), "MMM d, yyyy")}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{app.description}</p>
                  {app.status === "pending" || app.status === "under_review" || app.status === "mediation" ? (
                    <div className="space-y-2">
                      <Textarea placeholder="Reviewer notes..." value={notes[app.id] || ""} onChange={e => setNotes(prev => ({ ...prev, [app.id]: e.target.value }))} rows={2} />
                      <div className="flex gap-2 flex-wrap">
                        {app.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => handleTermAction(app.id, "under_review")} disabled={processing === app.id}>
                            <Scale className="h-3 w-3 mr-1" /> Review
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleTermAction(app.id, "mediation")} disabled={processing === app.id}>
                          <Scale className="h-3 w-3 mr-1" /> Mediation
                        </Button>
                        <Button size="sm" onClick={() => handleTermAction(app.id, "approved")} disabled={processing === app.id}>
                          <CheckCircle className="h-3 w-3 mr-1" /> Approve
                        </Button>
                         <Button size="sm" variant="destructive" onClick={() => handleTermAction(app.id, "rejected")} disabled={processing === app.id}>
                           <XCircle className="h-3 w-3 mr-1" /> Reject
                         </Button>
                         {profile?.isMainAdmin && (
                           <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1" onClick={() => setDeletingId(app.id)}>
                             <Trash2 className="h-3 w-3 mr-1" /> Delete
                           </Button>
                         )}
                       </div>
                     </div>
                   ) : app.reviewer_notes ? (
                     <div className="bg-muted/50 rounded p-2 text-sm">
                       <span className="font-medium">Notes:</span> {app.reviewer_notes}
                     </div>
                   ) : null}
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="side-payments" className="space-y-4 mt-4">
            {sidePayments.length === 0 ? (
              <EmptyState icon={ShieldAlert} title="No Side Payments" description="No side-payment declarations have been filed." />
            ) : sidePayments.map(sp => (
              <Card key={sp.id}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="text-sm font-semibold text-foreground">
                        {sp.payment_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())} — GH₵{Number(sp.amount).toFixed(2)}
                      </span>
                      <Badge className={`ml-2 ${statusColor(sp.status)}`}>{sp.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">{format(new Date(sp.created_at), "MMM d, yyyy")}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{sp.description}</p>
                  {(sp.status === "reported" || sp.status === "under_investigation") && (
                    <div className="flex gap-2 flex-wrap">
                      {sp.status === "reported" && (
                        <Button size="sm" variant="outline" onClick={() => handleSidePaymentAction(sp.id, "under_investigation")} disabled={processing === sp.id}>
                          Investigate
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handleSidePaymentAction(sp.id, "confirmed")} disabled={processing === sp.id}>
                        <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleSidePaymentAction(sp.id, "dismissed")} disabled={processing === sp.id}>
                        <XCircle className="h-3 w-3 mr-1" /> Dismiss
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default RegulatorTerminations;

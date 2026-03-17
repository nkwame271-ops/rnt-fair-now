import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Gavel, FileText, Send } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";

const reasons = [
  { value: "non_payment", label: "Non-Payment of Rent" },
  { value: "property_damage", label: "Property Damage" },
  { value: "breach_of_agreement", label: "Breach of Agreement" },
  { value: "personal_use", label: "Personal Use of Property" },
  { value: "subletting", label: "Unauthorized Subletting" },
  { value: "other", label: "Other" },
];

const LandlordTerminationRequest = () => {
  const { user } = useAuth();
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [existing, setExisting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTenancy, setSelectedTenancy] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: t }, { data: apps }] = await Promise.all([
        supabase.from("tenancies").select("id, registration_code, agreed_rent, tenant_id_code, status").eq("landlord_user_id", user.id).in("status", ["active", "renewal_window"]),
        supabase.from("termination_applications").select("*").eq("applicant_user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setTenancies(t || []);
      setExisting(apps || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handleSubmit = async () => {
    if (!selectedTenancy || !reason || !description.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSubmitting(true);
    try {
      const tenancy = tenancies.find(t => t.id === selectedTenancy);
      const { error } = await supabase.from("termination_applications").insert({
        tenancy_id: selectedTenancy,
        applicant_user_id: user!.id,
        applicant_role: "landlord",
        reason,
        description: description.trim(),
      });
      if (error) throw error;

      // Notify tenant
      if (tenancy) {
        const { data: ten } = await supabase.from("tenancies").select("tenant_user_id").eq("id", selectedTenancy).single();
        if (ten) {
          await supabase.from("notifications").insert({
            user_id: ten.tenant_user_id,
            title: "Ejection Application Filed",
            body: `Your landlord has filed an ejection application for tenancy ${tenancy.registration_code}. The Rent Control Office will review this.`,
            link: "/tenant/my-cases",
          });
        }
      }

      toast.success("Ejection application submitted for review");
      setSelectedTenancy("");
      setReason("");
      setDescription("");
      const { data: apps } = await supabase.from("termination_applications").select("*").eq("applicant_user_id", user!.id).order("created_at", { ascending: false });
      setExisting(apps || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LogoLoader message="Loading..." />;

  const statusColor = (s: string) => {
    switch (s) {
      case "pending": return "bg-warning/10 text-warning";
      case "under_review": return "bg-info/10 text-info";
      case "mediation": return "bg-primary/10 text-primary";
      case "approved": return "bg-success/10 text-success";
      case "rejected": return "bg-destructive/10 text-destructive";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-6 w-6 text-destructive" />
            Ejection Application
          </h1>
          <p className="text-muted-foreground text-sm">Apply to the Rent Control Office for tenant ejection. All applications are reviewed before approval.</p>
        </div>

        {tenancies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Ejection Application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Select Tenancy</label>
                <Select value={selectedTenancy} onValueChange={setSelectedTenancy}>
                  <SelectTrigger><SelectValue placeholder="Choose tenancy" /></SelectTrigger>
                  <SelectContent>
                    {tenancies.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.registration_code} — Tenant {t.tenant_id_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Reason for Ejection</label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {reasons.map(r => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description & Evidence</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the situation and provide supporting details..." rows={4} maxLength={2000} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </CardContent>
          </Card>
        )}

        {tenancies.length === 0 && existing.length === 0 && (
          <EmptyState icon={FileText} title="No Active Tenancies" description="You don't have any active tenancies to request ejection for." />
        )}

        {existing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Ejection Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {existing.map(app => (
                <div key={app.id} className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{app.reason.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
                    <Badge className={statusColor(app.status)}>{app.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{app.description}</p>
                  <p className="text-xs text-muted-foreground">Filed {format(new Date(app.created_at), "MMM d, yyyy")}</p>
                  {app.reviewer_notes && (
                    <div className="bg-muted/50 rounded p-2 text-sm">
                      <span className="font-medium">Regulator Notes:</span> {app.reviewer_notes}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageTransition>
  );
};

export default LandlordTerminationRequest;

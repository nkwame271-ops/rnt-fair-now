import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Edit3, AlertTriangle } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import { format } from "date-fns";

interface RenewalTenancy {
  id: string;
  registration_code: string;
  agreed_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  tenant_user_id: string;
  unit_id: string;
  tenantName?: string;
  propertyAddress?: string;
  assessmentStatus?: string;
}

const RenewalRequests = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tenancies, setTenancies] = useState<RenewalTenancy[]>([]);
  const [proposedRents, setProposedRents] = useState<Record<string, string>>({});
  const [durations, setDurations] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchRenewals = async () => {
      const { data, error } = await supabase
        .from("tenancies")
        .select("id, registration_code, agreed_rent, start_date, end_date, status, tenant_user_id, unit_id")
        .eq("landlord_user_id", user.id)
        .in("status", ["renewal_pending", "renewal_pending_assessment", "renewal_pending_confirmation"]);

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      const enriched: RenewalTenancy[] = [];
      for (const t of data || []) {
        const { data: tenantProfile } = await supabase.from("profiles").select("full_name").eq("user_id", t.tenant_user_id).single();
        const { data: unit } = await supabase.from("units").select("property_id").eq("id", t.unit_id).single();
        let propertyAddress = "";
        let assessmentStatus = "pending";
        if (unit) {
          const { data: prop } = await supabase.from("properties").select("address, assessment_status").eq("id", unit.property_id).single();
          propertyAddress = prop?.address || "";
          assessmentStatus = prop?.assessment_status || "pending";
        }
        enriched.push({
          ...t,
          tenantName: tenantProfile?.full_name || "Unknown",
          propertyAddress,
          assessmentStatus,
        } as RenewalTenancy);
      }

      setTenancies(enriched);
      setLoading(false);
    };
    fetchRenewals();
  }, [user]);

  const handleAccept = async (tenancy: RenewalTenancy) => {
    if (tenancy.assessmentStatus !== "assessed") {
      // Set status to pending assessment
      setSubmitting(tenancy.id);
      const { error } = await supabase
        .from("tenancies")
        .update({ status: "renewal_pending_assessment" })
        .eq("id", tenancy.id);
      if (error) toast.error(error.message);
      else {
        toast.info("Property needs Rent Control assessment before renewal can proceed.");
        setTenancies(prev => prev.map(t => t.id === tenancy.id ? { ...t, status: "renewal_pending_assessment" } : t));
      }
      setSubmitting(null);
      return;
    }

    setSubmitting(tenancy.id);
    const rent = proposedRents[tenancy.id] ? Number(proposedRents[tenancy.id]) : tenancy.agreed_rent;
    const duration = durations[tenancy.id] ? Number(durations[tenancy.id]) : 12;

    const { error } = await supabase
      .from("tenancies")
      .update({
        status: "renewal_pending_confirmation",
        proposed_rent: rent,
        renewal_duration_months: duration,
      })
      .eq("id", tenancy.id);

    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("notifications").insert({
        user_id: tenancy.tenant_user_id,
        title: "Renewal Approved",
        body: `Your landlord has approved your renewal at GH₵ ${rent.toLocaleString()}/month for ${duration} months. Please confirm and pay.`,
        link: "/tenant/renewal",
      });
      toast.success("Renewal approved! Tenant has been notified.");
      setTenancies(prev => prev.map(t => t.id === tenancy.id ? { ...t, status: "renewal_pending_confirmation" } : t));
    }
    setSubmitting(null);
  };

  const handleDecline = async (tenancy: RenewalTenancy) => {
    setSubmitting(tenancy.id);
    const { error } = await supabase
      .from("tenancies")
      .update({
        status: "terminated",
        termination_reason: "landlord_declined_renewal",
        terminated_at: new Date().toISOString(),
      })
      .eq("id", tenancy.id);

    if (error) {
      toast.error(error.message);
    } else {
      await supabase.from("notifications").insert({
        user_id: tenancy.tenant_user_id,
        title: "Renewal Declined",
        body: `Your landlord has declined your renewal request for tenancy ${tenancy.registration_code}.`,
        link: "/tenant/renewal",
      });
      toast.success("Renewal declined. Tenant has been notified.");
      setTenancies(prev => prev.filter(t => t.id !== tenancy.id));
    }
    setSubmitting(null);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Renewal Requests</h1>
        <p className="text-muted-foreground">Manage tenant renewal requests for your properties.</p>

        {tenancies.length === 0 && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Pending Renewals</AlertTitle>
            <AlertDescription>You don't have any pending renewal requests at this time.</AlertDescription>
          </Alert>
        )}

        {tenancies.map((t) => {
          const isAssessed = t.assessmentStatus === "assessed";
          const isPendingAssessment = t.status === "renewal_pending_assessment";
          const isConfirmed = t.status === "renewal_pending_confirmation";

          return (
            <Card key={t.id} className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{t.tenantName}</CardTitle>
                    <CardDescription>{t.registration_code} • {t.propertyAddress}</CardDescription>
                  </div>
                  <Badge variant={isPendingAssessment ? "outline" : isConfirmed ? "default" : "secondary"}>
                    {t.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current Rent</span>
                    <p className="font-medium">GH₵ {t.agreed_rent.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Expires</span>
                    <p className="font-medium">{format(new Date(t.end_date), "dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Assessment</span>
                    <Badge variant={isAssessed ? "default" : "outline"} className="text-xs">
                      {isAssessed ? "Assessed" : "Pending"}
                    </Badge>
                  </div>
                </div>

                {t.status === "renewal_pending" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`rent-${t.id}`}>Proposed Rent (GH₵)</Label>
                        <Input
                          id={`rent-${t.id}`}
                          type="number"
                          placeholder={t.agreed_rent.toString()}
                          value={proposedRents[t.id] || ""}
                          onChange={(e) => setProposedRents(prev => ({ ...prev, [t.id]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`dur-${t.id}`}>Duration (months)</Label>
                        <Input
                          id={`dur-${t.id}`}
                          type="number"
                          placeholder="12"
                          min={1}
                          max={24}
                          value={durations[t.id] || ""}
                          onChange={(e) => setDurations(prev => ({ ...prev, [t.id]: e.target.value }))}
                        />
                      </div>
                    </div>

                    {!isAssessed && (
                      <Alert className="border-warning bg-warning/10">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        <AlertTitle className="text-sm">Assessment Required</AlertTitle>
                        <AlertDescription className="text-xs">
                          This property has not been assessed by Rent Control. The renewal will be held until an assessment is completed.
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleAccept(t)}
                        disabled={submitting === t.id}
                        className="flex-1"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        {!isAssessed ? "Accept (Pending Assessment)" : submitting === t.id ? "Submitting..." : "Accept & Send to Tenant"}
                      </Button>
                      <Button
                        onClick={() => handleDecline(t)}
                        disabled={submitting === t.id}
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline
                      </Button>
                    </div>
                  </>
                )}

                {isPendingAssessment && (
                  <Alert className="border-warning bg-warning/10">
                    <Clock className="h-4 w-4 text-warning" />
                    <AlertTitle>Awaiting Rent Control Assessment</AlertTitle>
                    <AlertDescription>This renewal is on hold until the property assessment is completed by Rent Control.</AlertDescription>
                  </Alert>
                )}

                {isConfirmed && (
                  <Alert className="border-success bg-success/10">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <AlertTitle>Awaiting Tenant Confirmation</AlertTitle>
                    <AlertDescription>The tenant has been notified and needs to confirm and pay.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageTransition>
  );
};

export default RenewalRequests;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, LogOut, CheckCircle2, Clock, AlertTriangle, CreditCard } from "lucide-react";
import PageTransition from "@/components/PageTransition";
import { differenceInDays, format } from "date-fns";

interface TenancyRenewal {
  id: string;
  registration_code: string;
  agreed_rent: number;
  start_date: string;
  end_date: string;
  status: string;
  landlord_user_id: string;
  proposed_rent: number | null;
  renewal_duration_months: number | null;
  unit_id: string;
  propertyAddress?: string;
  landlordName?: string;
}

const RequestRenewal = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenancies, setTenancies] = useState<TenancyRenewal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchTenancy = async () => {
      const { data, error } = await supabase
        .from("tenancies")
        .select("id, registration_code, agreed_rent, start_date, end_date, status, landlord_user_id, proposed_rent, renewal_duration_months, unit_id")
        .eq("tenant_user_id", user.id)
        .in("status", ["active", "renewal_window", "renewal_pending", "renewal_pending_assessment", "renewal_pending_confirmation", "renewal_pending_payment"])
        .order("end_date", { ascending: false });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const results: TenancyRenewal[] = [];
        for (const t of data as any[]) {
          const { data: unit } = await supabase.from("units").select("property_id").eq("id", t.unit_id).single();
          let propertyAddress = "";
          if (unit) {
            const { data: prop } = await supabase.from("properties").select("address").eq("id", unit.property_id).single();
            propertyAddress = prop?.address || "";
          }
          const { data: landlord } = await supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).single();
          results.push({ ...t, propertyAddress, landlordName: landlord?.full_name || "Unknown" });
        }
        setTenancies(results);
        setSelectedId(results[0].id);
      }
      setLoading(false);
    };
    fetchTenancy();
  }, [user]);

  const tenancy = tenancies.find(t => t.id === selectedId) || null;

  const updateTenancy = (id: string, updates: Partial<TenancyRenewal>) => {
    setTenancies(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleRequestRenewal = async () => {
    if (!tenancy || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tenancies")
        .update({
          renewal_requested_at: new Date().toISOString(),
          renewal_requested_by: user.id,
          status: "renewal_pending",
        })
        .eq("id", tenancy.id);

      if (error) throw error;

      // Notify landlord
      await supabase.from("notifications").insert({
        user_id: tenancy.landlord_user_id,
        title: "Renewal Request",
        body: `Your tenant has requested a renewal for tenancy ${tenancy.registration_code}.`,
        link: "/landlord/renewal-requests",
      });

      toast.success("Renewal request submitted!");
      updateTenancy(tenancy.id, { status: "renewal_pending" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleNotifyExit = async () => {
    if (!tenancy || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tenancies")
        .update({
          status: "terminated",
          termination_reason: "tenant_exit",
          terminated_at: new Date().toISOString(),
        })
        .eq("id", tenancy.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: tenancy.landlord_user_id,
        title: "Tenant Exit Notice",
        body: `Your tenant will not be renewing tenancy ${tenancy.registration_code}.`,
        link: "/landlord/dashboard",
      });

      toast.success("Exit notice submitted. Your landlord has been notified.");
      updateTenancy(tenancy.id, { status: "terminated" });
    } catch (err: any) {
      toast.error(err.message || "Failed to submit exit notice");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmRenewal = async () => {
    if (!tenancy || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tenancies")
        .update({ status: "renewal_pending_payment" })
        .eq("id", tenancy.id);

      if (error) throw error;

      // Initiate payment
      const { data, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "renewal_payment", tenancyId: tenancy.id },
      });

      if (payErr) throw new Error(payErr.message);
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate renewal payment");
      // Revert status
      await supabase.from("tenancies").update({ status: "renewal_pending_confirmation" }).eq("id", tenancy.id);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeclineProposal = async () => {
    if (!tenancy || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("tenancies")
        .update({
          status: "terminated",
          termination_reason: "tenant_declined_renewal",
          terminated_at: new Date().toISOString(),
        })
        .eq("id", tenancy.id);

      if (error) throw error;

      await supabase.from("notifications").insert({
        user_id: tenancy.landlord_user_id,
        title: "Renewal Declined",
        body: `Your tenant declined the renewal proposal for tenancy ${tenancy.registration_code}.`,
        link: "/landlord/dashboard",
      });

      toast.success("You have declined the renewal.");
      updateTenancy(tenancy.id, { status: "terminated" });
    } catch (err: any) {
      toast.error(err.message || "Failed to decline");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (tenancies.length === 0) {
    return (
      <PageTransition>
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold text-foreground mb-4">Tenancy Renewal</h1>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>No Active Tenancy</AlertTitle>
            <AlertDescription>You don't have an active or renewal-eligible tenancy at this time.</AlertDescription>
          </Alert>
        </div>
      </PageTransition>
    );
  }

  if (!tenancy) return null;

  const daysLeft = differenceInDays(new Date(tenancy.end_date), new Date());
  const isRenewalWindow = tenancy.status === "active" || tenancy.status === "renewal_window";
  const isPending = tenancy.status === "renewal_pending" || tenancy.status === "renewal_pending_assessment";
  const isConfirmation = tenancy.status === "renewal_pending_confirmation";
  const isPendingPayment = tenancy.status === "renewal_pending_payment";
  const isTerminated = tenancy.status === "terminated";

  return (
    <PageTransition>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Tenancy Renewal</h1>

        {tenancies.length > 1 && (
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Select tenancy</label>
            <Select value={selectedId || ""} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a tenancy" />
              </SelectTrigger>
              <SelectContent>
                {tenancies.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.registration_code} — {t.propertyAddress || "Property"} (GH₵ {t.agreed_rent.toLocaleString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Tenancy</CardTitle>
            <CardDescription>{tenancy.registration_code}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Property</span>
                <p className="font-medium">{tenancy.propertyAddress || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Landlord</span>
                <p className="font-medium">{tenancy.landlordName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Monthly Rent</span>
                <p className="font-medium">GH₵ {tenancy.agreed_rent.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires</span>
                <p className="font-medium">{format(new Date(tenancy.end_date), "dd MMM yyyy")}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Days Remaining</span>
                <p className={`font-bold ${daysLeft > 30 ? "text-success" : daysLeft > 0 ? "text-warning" : "text-destructive"}`}>
                  {daysLeft > 0 ? `${daysLeft} days` : "Expired"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Status</span>
                <Badge variant={isTerminated ? "destructive" : "secondary"}>
                  {tenancy.status.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Renewal Window — choose renewal or exit */}
        {isRenewalWindow && (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                What would you like to do?
              </CardTitle>
              <CardDescription>Your tenancy is approaching its expiry. Choose an option below.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleRequestRenewal} disabled={submitting} className="flex-1">
                <RefreshCw className="mr-2 h-4 w-4" />
                {submitting ? "Submitting..." : "Request Renewal"}
              </Button>
              <Button onClick={handleNotifyExit} disabled={submitting} variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive/10">
                <LogOut className="mr-2 h-4 w-4" />
                {submitting ? "Submitting..." : "Notify Exit"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Pending landlord response */}
        {isPending && (
          <Alert className="border-primary/30 bg-primary/5">
            <Clock className="h-4 w-4 text-primary" />
            <AlertTitle>Renewal Request Submitted</AlertTitle>
            <AlertDescription>
              {tenancy.status === "renewal_pending_assessment"
                ? "Your landlord has responded, but a Rent Control assessment is needed before the renewal can proceed."
                : "Your renewal request has been sent to your landlord. You will be notified when they respond."}
            </AlertDescription>
          </Alert>
        )}

        {/* Landlord has proposed terms — tenant confirms or declines */}
        {isConfirmation && (
          <Card className="border-success/30">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Landlord Renewal Proposal
              </CardTitle>
              <CardDescription>Your landlord has accepted the renewal with the following terms.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Proposed Rent</span>
                  <p className="font-bold text-lg">GH₵ {(tenancy.proposed_rent ?? tenancy.agreed_rent).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Duration</span>
                  <p className="font-bold text-lg">{tenancy.renewal_duration_months ?? 12} months</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleConfirmRenewal} disabled={submitting} className="flex-1">
                  <CreditCard className="mr-2 h-4 w-4" />
                  {submitting ? "Processing..." : "Confirm & Pay"}
                </Button>
                <Button onClick={handleDeclineProposal} disabled={submitting} variant="outline" className="flex-1 border-destructive text-destructive hover:bg-destructive/10">
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending payment */}
        {isPendingPayment && (
          <Alert className="border-warning bg-warning/10">
            <CreditCard className="h-4 w-4 text-warning" />
            <AlertTitle>Payment Pending</AlertTitle>
            <AlertDescription>Your renewal payment is being processed. You will be redirected shortly.</AlertDescription>
          </Alert>
        )}

        {/* Terminated */}
        {isTerminated && (
          <Alert className="border-destructive bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle>Tenancy Ended</AlertTitle>
            <AlertDescription>This tenancy has been terminated or you have chosen not to renew.</AlertDescription>
          </Alert>
        )}
      </div>
    </PageTransition>
  );
};

export default RequestRenewal;

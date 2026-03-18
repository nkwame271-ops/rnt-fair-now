import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileText, Send, CreditCard, Loader2 } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import EmptyState from "@/components/EmptyState";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { useFeeConfig } from "@/hooks/useFeatureFlag";

const reasons = [
  { value: "landlord_harassment", label: "Landlord Harassment" },
  { value: "uninhabitable_conditions", label: "Uninhabitable Conditions" },
  { value: "illegal_charges", label: "Illegal Charges / Side Payments" },
  { value: "privacy_violation", label: "Privacy Violation" },
  { value: "personal_reasons", label: "Personal Reasons" },
  { value: "other", label: "Other" },
];

const TenantTerminationRequest = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const feeConfig = useFeeConfig("termination_fee");
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [existing, setExisting] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTenancy, setSelectedTenancy] = useState("");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [feePaid, setFeePaid] = useState(false);
  const [payingFee, setPayingFee] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data: t }, { data: apps }] = await Promise.all([
        supabase.from("tenancies").select("id, registration_code, agreed_rent, start_date, end_date, status, unit_id").eq("tenant_user_id", user.id).in("status", ["active", "renewal_window"]),
        supabase.from("termination_applications").select("*").eq("applicant_user_id", user.id).order("created_at", { ascending: false }),
      ]);
      setTenancies(t || []);
      setExisting(apps || []);
      setLoading(false);
    };
    load();
  }, [user]);

  // Check if fee was paid via callback
  useEffect(() => {
    if (searchParams.get("status") === "fee_paid") {
      setFeePaid(true);
    }
  }, [searchParams]);

  // Auto-skip if fee is disabled or zero
  useEffect(() => {
    if (!feeConfig.loading && (!feeConfig.enabled || feeConfig.amount <= 0)) {
      setFeePaid(true);
    }
  }, [feeConfig]);

  const handlePayFee = async () => {
    if (!user) return;
    setPayingFee(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "termination_fee" },
      });
      if (error) throw error;
      if (data?.skipped) {
        setFeePaid(true);
        toast.success(data.message || "Fee waived");
        return;
      }
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setPayingFee(false);
    }
  };

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
        applicant_role: "tenant",
        reason,
        description: description.trim(),
      });
      if (error) throw error;

      // Notify landlord
      if (tenancy) {
        const { data: landlordTenancy } = await supabase.from("tenancies").select("landlord_user_id").eq("id", selectedTenancy).single();
        if (landlordTenancy) {
          await supabase.from("notifications").insert({
            user_id: landlordTenancy.landlord_user_id,
            title: "Termination Request Filed",
            body: `Your tenant has filed a termination request for tenancy ${tenancy.registration_code}.`,
            link: "/landlord/agreements",
          });
        }
      }

      toast.success("Termination request submitted successfully");
      setSelectedTenancy("");
      setReason("");
      setDescription("");
      // Refresh
      const { data: apps } = await supabase.from("termination_applications").select("*").eq("applicant_user_id", user!.id).order("created_at", { ascending: false });
      setExisting(apps || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
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
            <AlertTriangle className="h-6 w-6 text-destructive" />
            Request Termination
          </h1>
          <p className="text-muted-foreground text-sm">Submit a formal request to terminate your tenancy through the Rent Control Office.</p>
        </div>

        {/* Fee Gate */}
        {!feePaid && !feeConfig.loading && feeConfig.enabled && feeConfig.amount > 0 && tenancies.length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-start gap-3">
                <CreditCard className="h-6 w-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">Payment Required</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    A fee of <span className="font-semibold text-foreground">GH₵ {feeConfig.amount.toFixed(2)}</span> is required to submit a termination request.
                  </p>
                </div>
              </div>
              <Button onClick={handlePayFee} disabled={payingFee} className="w-full">
                {payingFee ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : `Pay GH₵ ${feeConfig.amount.toFixed(2)} to Continue`}
              </Button>
            </CardContent>
          </Card>
        )}

        {feePaid && tenancies.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">New Termination Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Select Tenancy</label>
                <Select value={selectedTenancy} onValueChange={setSelectedTenancy}>
                  <SelectTrigger><SelectValue placeholder="Choose tenancy" /></SelectTrigger>
                  <SelectContent>
                    {tenancies.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.registration_code} — GH₵{t.agreed_rent}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Reason</label>
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
                <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your situation in detail..." rows={4} maxLength={2000} />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full">
                <Send className="h-4 w-4 mr-2" />
                {submitting ? "Submitting..." : "Submit Request"}
              </Button>
            </CardContent>
          </Card>
        )}

        {tenancies.length === 0 && existing.length === 0 && (
          <EmptyState icon={FileText} title="No Active Tenancies" description="You don't have any active tenancies to terminate." />
        )}

        {existing.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your Termination Requests</CardTitle>
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

export default TenantTerminationRequest;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeeConfig, useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { RENTCARE_LEGAL_NOTICE, RENTCARE_PROGRAMME_NAME, RENTCARE_STATUS_LABELS } from "@/lib/rentcare/legalNotice";

export default function RentCareDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { amount: feeAmount } = useFeeConfig("rentcare_assistance");
  const { flags } = useAllFeatureFlags();
  const umbLink = flags.find((f) => f.feature_key === "rentcare_umb_link")?.description || "";
  const allowEdit = flags.find((f) => f.feature_key === "rentcare_allow_umb_edit")?.is_enabled ?? false;
  const [app, setApp] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [paying, setPaying] = useState(false);
  const [umb, setUmb] = useState<any>({});
  const [savingUmb, setSavingUmb] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: a }, { data: h }] = await Promise.all([
      supabase.from("rentcare_applications").select("*").eq("id", id).maybeSingle(),
      supabase.from("rentcare_status_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    ]);
    setApp(a);
    setHistory(h || []);
    if (a) setUmb({
      umb_account_name: a.umb_account_name || "",
      umb_account_number: a.umb_account_number || "",
      umb_branch: a.umb_branch || "",
      umb_account_type: a.umb_account_type || "",
      umb_account_created_on: a.umb_account_created_on || "",
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const pay = async () => {
    if (!consent) { toast.error("Please accept the legal notice first."); return; }
    setPaying(true);
    try {
      await supabase.from("rentcare_audit_log").insert({
        application_id: id, event_type: "legal_notice_accepted",
        actor_user_id: user?.id, actor_role: "student",
      });
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "rentcare_application_fee", applicationId: id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Payment init failed");
      if (data?.authorization_url) {
        if (data.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
      }
    } catch (e: any) {
      toast.error(e.message || "Payment failed");
      setPaying(false);
    }
  };

  const submitUmb = async () => {
    if (!umb.umb_account_name || !umb.umb_account_number) {
      toast.error("Account name and number are required"); return;
    }
    setSavingUmb(true);
    try {
      const { error } = await supabase
        .from("rentcare_applications")
        .update({
          ...umb,
          umb_submitted_at: new Date().toISOString(),
          status: "umb_account_submitted",
        })
        .eq("id", id!);
      if (error) throw error;
      // Mirror to profile
      await supabase.from("profiles").update({
        ...umb,
        umb_submitted_at: new Date().toISOString(),
      }).eq("user_id", user!.id);
      await supabase.from("rentcare_audit_log").insert({
        application_id: id, event_type: "umb_account_submitted",
        actor_user_id: user?.id, actor_role: "student",
        new_value: { umb_account_number: umb.umb_account_number },
      });
      toast.success("UMB account details submitted.");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save UMB details");
    } finally {
      setSavingUmb(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!app) return <div className="py-20 text-center">Application not found.</div>;

  const isUnpaid = app.payment_status === "unpaid" || app.payment_status === "pending" || app.payment_status === "failed";
  const isPaid = app.payment_status === "paid" || app.payment_status === "reconciled";
  const needsUmb = isPaid && !app.umb_submitted_at;
  const canEditUmb = needsUmb || allowEdit;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">{app.reference}</h1>
          <p className="text-sm text-muted-foreground">{RENTCARE_PROGRAMME_NAME}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">Payment: {app.payment_status}</Badge>
          <Badge>{RENTCARE_STATUS_LABELS[app.status] || app.status}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Application Summary</CardTitle></CardHeader>
        <CardContent className="text-sm grid sm:grid-cols-2 gap-2">
          <div><span className="text-muted-foreground">Applicant:</span> {app.full_name}</div>
          <div><span className="text-muted-foreground">Institution:</span> {app.institution}</div>
          <div><span className="text-muted-foreground">Amount requested:</span> GHS {Number(app.amount_requested || 0).toLocaleString()}</div>
          <div><span className="text-muted-foreground">Created:</span> {new Date(app.created_at).toLocaleString()}</div>
          {app.submitted_at && <div><span className="text-muted-foreground">Submitted:</span> {new Date(app.submitted_at).toLocaleString()}</div>}
        </CardContent>
      </Card>

      {isUnpaid && (
        <Card>
          <CardHeader><CardTitle>Legal Notice & Application Fee</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/50 border rounded p-3 text-xs leading-relaxed">{RENTCARE_LEGAL_NOTICE}</div>
            <label className="flex gap-2 items-start text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(!!v)} />
              <span>I have read and accept the legal notice above.</span>
            </label>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">Application fee: <strong>GHS {feeAmount.toLocaleString()}</strong></div>
              <Button onClick={pay} disabled={!consent || paying}>
                {paying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Pay Application Fee
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Your application is not submitted to administrators until payment is successful.</p>
          </CardContent>
        </Card>
      )}

      {isPaid && (
        <Card>
          <CardHeader><CardTitle>UMB Account</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {umbLink && (
              <a href={umbLink} target="_blank" rel="noreferrer">
                <Button variant="outline"><ExternalLink className="h-4 w-4 mr-1" />Create UMB Account</Button>
              </a>
            )}
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label>Account Name *</Label><Input disabled={!canEditUmb} value={umb.umb_account_name} onChange={(e) => setUmb({ ...umb, umb_account_name: e.target.value })} /></div>
              <div><Label>Account Number *</Label><Input disabled={!canEditUmb} value={umb.umb_account_number} onChange={(e) => setUmb({ ...umb, umb_account_number: e.target.value })} /></div>
              <div><Label>Branch</Label><Input disabled={!canEditUmb} value={umb.umb_branch} onChange={(e) => setUmb({ ...umb, umb_branch: e.target.value })} /></div>
              <div><Label>Account Type</Label><Input disabled={!canEditUmb} value={umb.umb_account_type} onChange={(e) => setUmb({ ...umb, umb_account_type: e.target.value })} /></div>
              <div><Label>Date Created</Label><Input type="date" disabled={!canEditUmb} value={umb.umb_account_created_on} onChange={(e) => setUmb({ ...umb, umb_account_created_on: e.target.value })} /></div>
            </div>
            {canEditUmb && (
              <Button onClick={submitUmb} disabled={savingUmb}>
                {savingUmb && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {app.umb_submitted_at ? "Update UMB Details" : "Submit UMB Details"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Status Timeline</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          {history.length === 0 ? (
            <div className="text-muted-foreground">No status changes yet.</div>
          ) : history.map((h) => (
            <div key={h.id} className="flex justify-between gap-2 border-b py-1">
              <span>{RENTCARE_STATUS_LABELS[h.new_status] || h.new_status}</span>
              <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={() => navigate("/nugs/rentcare")}>Back</Button>
    </div>
  );
}

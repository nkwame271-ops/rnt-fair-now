import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Upload, ShieldCheck, AlertCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const SERVICE_TYPES = [
  { value: "complaint_fee", label: "Complaint filing fee" },
  { value: "rent_card", label: "Rent card purchase" },
  { value: "tenancy_registration", label: "Tenancy registration" },
  { value: "viewing_fee", label: "Property viewing fee" },
  { value: "renewal_fee", label: "Tenancy renewal" },
  { value: "termination_fee", label: "Termination application" },
  { value: "other", label: "Other / not sure" },
];

const verdictMeta: Record<string, { label: string; tone: string; icon: any }> = {
  pending: { label: "Awaiting AI review", tone: "bg-muted text-muted-foreground", icon: Clock },
  ai_verified_high_confidence: { label: "AI verified — high confidence", tone: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  needs_admin_review: { label: "Needs officer review", tone: "bg-amber-100 text-amber-800", icon: AlertCircle },
  ai_rejected_paystack_says_unpaid: { label: "Paystack says unpaid", tone: "bg-red-100 text-red-800", icon: XCircle },
  ai_rejected_appears_fake: { label: "Receipt may be edited", tone: "bg-red-100 text-red-800", icon: XCircle },
};

const statusMeta: Record<string, { label: string; tone: string }> = {
  pending_ai_review: { label: "Checking…", tone: "bg-muted text-muted-foreground" },
  awaiting_admin: { label: "Awaiting officer approval", tone: "bg-amber-100 text-amber-800" },
  approved: { label: "Approved & credited", tone: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejected", tone: "bg-red-100 text-red-800" },
  info_requested: { label: "More info requested", tone: "bg-blue-100 text-blue-800" },
};

export default function ReportMissingPayment() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [serviceType, setServiceType] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("payment_proof_submissions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
    setLoadingHistory(false);
  };

  useEffect(() => { loadHistory(); }, [user?.id]);

  const handleSubmit = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    if (!serviceType) { toast.error("Tell us what you were paying for"); return; }
    if (!file) { toast.error("Please upload the SMS or email receipt"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("File must be under 5 MB"); return; }

    setSubmitting(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { contentType: file.type || "image/jpeg" });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase
        .from("payment_proof_submissions")
        .insert({
          user_id: user.id,
          service_type: serviceType,
          claimed_reference: reference.trim() || null,
          claimed_amount: amount ? Number(amount) : null,
          claimed_paid_at: paidAt ? new Date(paidAt).toISOString() : null,
          notes: notes.trim() || null,
          proof_file_path: path,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;

      // Kick off AI verification (fire-and-forget for UX)
      supabase.functions.invoke("verify-payment-proof", { body: { submission_id: inserted.id } })
        .then(() => loadHistory())
        .catch((e) => console.error("verify-payment-proof failed", e));

      toast.success("Receipt submitted. We're checking it now.");
      setServiceType(""); setReference(""); setAmount(""); setPaidAt(""); setNotes(""); setFile(null);
      const input = document.getElementById("proof-file") as HTMLInputElement | null;
      if (input) input.value = "";
      loadHistory();
    } catch (e: any) {
      toast.error(e.message || "Could not submit proof");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Report a Missing Payment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paid but the system hasn't credited you yet? Upload the SMS or email payment receipt below.
        </p>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Bad networks can interrupt payments</AlertTitle>
        <AlertDescription className="text-xs">
          Sometimes your bank or Paystack confirms a charge before our platform receives it. When that happens,
          send us your receipt here. Our system will check it automatically, and an officer will review and credit
          your account — usually within a few hours. No payment is approved without an officer's decision.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Upload your receipt</CardTitle>
          <CardDescription>The clearer the screenshot, the faster we can verify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>What were you paying for?</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger><SelectValue placeholder="Select a service" /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Reference / transaction ID (optional)</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. T12345678" />
            </div>
            <div className="space-y-2">
              <Label>Amount paid (GHS)</Label>
              <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100.00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>When did you pay?</Label>
            <Input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Receipt screenshot</Label>
            <Input
              id="proof-file"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-[11px] text-muted-foreground">Image or PDF, max 5 MB.</p>
          </div>

          <div className="space-y-2">
            <Label>Anything else? (optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. I got the SMS but the page reloaded before it confirmed." />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting…</> : <><Upload className="h-4 w-4 mr-2" />Submit for review</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your previous submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">You haven't submitted any receipts yet.</p>
          ) : (
            <div className="space-y-3">
              {history.map(h => {
                const vm = verdictMeta[h.ai_verdict] || verdictMeta.pending;
                const sm = statusMeta[h.submission_status] || statusMeta.pending_ai_review;
                const Icon = vm.icon;
                return (
                  <div key={h.id} className="border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{SERVICE_TYPES.find(s => s.value === h.service_type)?.label || h.service_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleString()}
                          {h.claimed_amount ? ` · GHS ${Number(h.claimed_amount).toLocaleString()}` : ""}
                          {h.claimed_reference ? ` · ${h.claimed_reference}` : ""}
                        </p>
                      </div>
                      <Badge className={sm.tone}>{sm.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Icon className="h-3.5 w-3.5" />
                      <span className={`px-2 py-0.5 rounded-md ${vm.tone}`}>{vm.label}</span>
                      {typeof h.ai_confidence === "number" && (
                        <span className="text-muted-foreground">confidence {Math.round(h.ai_confidence * 100)}%</span>
                      )}
                    </div>
                    {h.review_notes && <p className="text-xs text-muted-foreground italic">Officer: {h.review_notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

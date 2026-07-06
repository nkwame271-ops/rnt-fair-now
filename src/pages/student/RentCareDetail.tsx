import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeeConfig, useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ExternalLink, Upload, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { RENTCARE_LEGAL_NOTICE, RENTCARE_PROGRAMME_NAME, RENTCARE_STATUS_LABELS } from "@/lib/rentcare/legalNotice";
import { logRentCareAudit } from "@/lib/rentcare/audit";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";

const DOC_TYPES = [
  { key: "ghana_card", label: "Ghana Card" },
  { key: "student_id", label: "Student ID" },
  { key: "admission_letter", label: "Admission/Enrolment Letter" },
  { key: "fee_statement", label: "Fee Statement" },
];

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
  const [docs, setDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState(false);
  const [paying, setPaying] = useState(false);
  const [umb, setUmb] = useState<any>({});
  const [savingUmb, setSavingUmb] = useState(false);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: a }, { data: h }, { data: d }, { data: m }] = await Promise.all([
      supabase.from("rentcare_applications").select("*").eq("id", id).maybeSingle(),
      supabase.from("rentcare_status_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
      supabase.from("rentcare_documents" as any).select("*").eq("application_id", id).order("created_at", { ascending: false }),
      supabase.from("rentcare_messages" as any).select("*").eq("application_id", id).order("created_at", { ascending: true }),
    ]);
    setApp(a);
    setHistory(h || []);
    setDocs((d as any[]) || []);
    setMessages((m as any[]) || []);
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
      await logRentCareAudit({ application_id: id, event_type: "payment_initiated" });
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "rentcare_application_fee", applicationId: id },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error || "Payment init failed");
      if (data?.authorization_url) {
        if (data.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        startBrandedCheckout(data as any);
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
        .update({ ...umb, umb_submitted_at: new Date().toISOString(), status: "umb_account_submitted" })
        .eq("id", id!);
      if (error) throw error;
      await supabase.from("profiles").update({ ...umb, umb_submitted_at: new Date().toISOString() }).eq("user_id", user!.id);
      await logRentCareAudit({
        application_id: id, event_type: "umb_account_saved",
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

  const uploadDoc = async (docType: string, file: File) => {
    if (!user || !id) return;
    setUploadingType(docType);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${user.id}/${id}/${docType}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("rentcare-docs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("rentcare_documents" as any).insert({
        application_id: id, uploader_user_id: user.id, doc_type: docType,
        file_path: path, file_name: file.name, mime_type: file.type, size_bytes: file.size,
      });
      if (insErr) throw insErr;
      await logRentCareAudit({ application_id: id, event_type: "document_uploaded", new_value: { doc_type: docType, file_name: file.name } });
      toast.success(`${docType.replace("_", " ")} uploaded`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploadingType(null);
    }
  };

  const downloadDoc = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("rentcare-docs").createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) { toast.error("Cannot generate download link"); return; }
    const a = document.createElement("a"); a.href = data.signedUrl; a.download = fileName; a.target = "_blank"; a.click();
  };

  const sendReply = async () => {
    if (!reply.trim() || !id || !user) return;
    setSendingReply(true);
    try {
      const { error } = await supabase.from("rentcare_messages" as any).insert({
        application_id: id, sender_user_id: user.id, sender_role: "student",
        subject: "Student reply", body: reply.trim(),
      });
      if (error) throw error;
      await logRentCareAudit({ application_id: id, event_type: "student_message_sent" });
      setReply("");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to send");
    } finally {
      setSendingReply(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!app) return <div className="py-20 text-center">Application not found.</div>;

  const isUnpaid = ["unpaid", "pending", "failed"].includes(app.payment_status);
  const isPaid = ["paid", "reconciled"].includes(app.payment_status);
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

      <Card>
        <CardHeader><CardTitle>Supporting Documents</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {DOC_TYPES.map((dt) => {
            const uploaded = docs.filter((d) => d.doc_type === dt.key);
            return (
              <div key={dt.key} className="flex flex-wrap items-center justify-between gap-2 border rounded p-2">
                <div className="text-sm">
                  <div className="font-medium">{dt.label}</div>
                  {uploaded.length === 0 && <div className="text-xs text-muted-foreground">Not uploaded</div>}
                  {uploaded.map((u) => (
                    <button key={u.id} onClick={() => downloadDoc(u.file_path, u.file_name)} className="text-xs text-primary underline flex items-center gap-1">
                      <FileText className="h-3 w-3" />{u.file_name}
                    </button>
                  ))}
                </div>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => e.target.files?.[0] && uploadDoc(dt.key, e.target.files[0])} />
                  <Button size="sm" variant="outline" asChild disabled={uploadingType === dt.key}>
                    <span>
                      {uploadingType === dt.key ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Upload className="h-3 w-3 mr-1" />}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {isUnpaid && (
        <Card>
          <CardHeader><CardTitle>Legal Notice & Application Fee</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-muted/50 border rounded p-3 text-xs leading-relaxed whitespace-pre-line">{RENTCARE_LEGAL_NOTICE}</div>
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
        <CardHeader><CardTitle>Messages</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {messages.length === 0 && <div className="text-sm text-muted-foreground">No messages yet.</div>}
          {messages.map((m) => (
            <div key={m.id} className={`text-sm p-2 rounded border ${m.sender_role === "student" ? "bg-muted/30" : "bg-primary/5"}`}>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>{m.sender_role}</span>
                <span>{new Date(m.created_at).toLocaleString()}</span>
              </div>
              {m.subject && <div className="font-medium">{m.subject}</div>}
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a message to the administrators…" rows={2} />
            <Button onClick={sendReply} disabled={!reply.trim() || sendingReply}>
              {sendingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>

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

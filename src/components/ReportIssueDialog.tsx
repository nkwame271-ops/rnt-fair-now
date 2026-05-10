import { useState } from "react";
import { Loader2, Upload, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ISSUE_TYPES = [
  { value: "payment_not_updated", label: "Payment made but service not updated" },
  { value: "receipt_missing", label: "Receipt not generated" },
  { value: "rent_card_missing", label: "Rent card not showing" },
  { value: "complaint_payment_missing", label: "Complaint payment not reflecting" },
  { value: "agreement_missing", label: "Agreement not appearing" },
  { value: "wrong_dashboard_status", label: "Wrong dashboard status" },
  { value: "other", label: "Other issue" },
];

const SERVICES = [
  { value: "rent_card", label: "Rent Card" },
  { value: "complaint", label: "Complaint" },
  { value: "agreement", label: "Agreement / Tenancy" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment / Escrow" },
  { value: "tenancy", label: "Tenancy" },
  { value: "dashboard", label: "Dashboard" },
  { value: "other", label: "Other" },
];

const ReportIssueDialog = ({ open, onOpenChange }: Props) => {
  const { user, role } = useAuth();
  const [issueType, setIssueType] = useState("");
  const [service, setService] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setIssueType(""); setService(""); setReferenceCode(""); setDescription("");
    setPhone(""); setEmail(""); setFiles([]);
  };

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = Array.from(e.target.files || []).slice(0, 3);
    const oversize = list.find((f) => f.size > 5 * 1024 * 1024);
    if (oversize) {
      toast({ title: "File too large", description: `${oversize.name} exceeds 5 MB.`, variant: "destructive" });
      return;
    }
    setFiles(list);
  };

  const handleSubmit = async () => {
    if (!user) { toast({ title: "Sign in required", variant: "destructive" }); return; }
    if (!issueType || !service || !description.trim()) {
      toast({ title: "Missing fields", description: "Issue type, service, and description are required.", variant: "destructive" });
      return;
    }
    if (description.trim().length < 10) {
      toast({ title: "Description too short", description: "Please describe the issue (min 10 characters).", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Upload evidence first
      const urls: string[] = [];
      for (const f of files) {
        const path = `${user.id}/${Date.now()}-${f.name.replace(/[^a-z0-9._-]/gi, "_")}`;
        const { error: upErr } = await supabase.storage.from("issue-evidence").upload(path, f, { upsert: false });
        if (upErr) throw upErr;
        urls.push(path);
      }

      const { data, error } = await supabase.from("issue_reports").insert({
        reporter_user_id: user.id,
        reporter_role: role || "user",
        issue_type: issueType as any,
        affected_service: service as any,
        reference_code: referenceCode.trim() || null,
        description: description.trim(),
        evidence_urls: urls,
        contact_phone: phone.trim() || null,
        contact_email: email.trim() || user.email || null,
      }).select("ticket_number").single();

      if (error) throw error;
      toast({ title: "Report submitted", description: `Your ticket ${data?.ticket_number} has been received. Super Admin will respond shortly.` });
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Report an Issue
          </DialogTitle>
          <DialogDescription>
            Tell us what went wrong. Super Admin will review and apply a correction if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Issue Type *</Label>
            <Select value={issueType} onValueChange={setIssueType}>
              <SelectTrigger><SelectValue placeholder="Select issue type" /></SelectTrigger>
              <SelectContent>{ISSUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Affected Service *</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue placeholder="Select service" /></SelectTrigger>
              <SelectContent>{SERVICES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reference Code (optional)</Label>
            <Input value={referenceCode} onChange={(e) => setReferenceCode(e.target.value)} placeholder="e.g. TKT-..., PUR-..., serial number, receipt no." />
          </div>

          <div className="space-y-2">
            <Label>Describe the Issue *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              placeholder="What happened? When? What did you expect to see?" maxLength={2000} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={user?.email || "Optional"} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload Proof (up to 3 files, 5 MB each)</Label>
            <Input type="file" multiple accept="image/*,application/pdf" onChange={onFiles} />
            {files.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Upload className="h-3 w-3" /> {f.name}
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Submit Report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportIssueDialog;

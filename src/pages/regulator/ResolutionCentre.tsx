import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert, Send, FileText, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { useAuth } from "@/hooks/useAuth";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-700",
  under_review: "bg-blue-500/15 text-blue-700",
  awaiting_user: "bg-purple-500/15 text-purple-700",
  resolved: "bg-emerald-500/15 text-emerald-700",
  rejected: "bg-slate-500/15 text-slate-700",
};

const ResolutionCentre = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionType, setCorrectionType] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionPayload, setCorrectionPayload] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: reports, isLoading } = useQuery({
    queryKey: ["resolution-centre", statusFilter],
    queryFn: async () => {
      let q = supabase.from("issue_reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.isSuperAdmin,
  });

  const selected = useMemo(() => reports?.find(r => r.id === selectedId) || null, [reports, selectedId]);

  const { data: messages } = useQuery({
    queryKey: ["resolution-messages", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase.from("issue_messages").select("*").eq("issue_id", selectedId).order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedId,
  });

  const { data: corrections } = useQuery({
    queryKey: ["resolution-corrections", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase.from("issue_correction_log").select("*").eq("issue_id", selectedId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedId,
  });

  const { data: reporterProfile } = useQuery({
    queryKey: ["resolution-reporter", selected?.reporter_user_id],
    queryFn: async () => {
      if (!selected?.reporter_user_id) return null;
      const { data } = await supabase.from("profiles").select("full_name,phone,email").eq("user_id", selected.reporter_user_id).maybeSingle();
      return data;
    },
    enabled: !!selected?.reporter_user_id,
  });

  const sendReply = async () => {
    if (!selected || !reply.trim() || !user) return;
    const { error } = await supabase.from("issue_messages").insert({
      issue_id: selected.id, sender_user_id: user.id, sender_role: "admin", body: reply.trim(),
    });
    if (error) { toast({ title: "Send failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("notifications").insert({
      user_id: selected.reporter_user_id,
      title: "Reply on your report",
      body: `Super Admin replied on ${selected.ticket_number}.`,
      link: "/",
    });
    setReply("");
    qc.invalidateQueries({ queryKey: ["resolution-messages", selected.id] });
  };

  const updateStatus = async (status: string) => {
    if (!selected) return;
    await supabase.from("issue_reports").update({ status: status as any, resolved_at: status === "resolved" ? new Date().toISOString() : null }).eq("id", selected.id);
    qc.invalidateQueries({ queryKey: ["resolution-centre"] });
    toast({ title: "Status updated" });
  };

  const runCorrection = async () => {
    if (!selected) return;
    if (correctionReason.trim().length < 5) { toast({ title: "Reason required (min 5 chars)", variant: "destructive" }); return; }
    let payload: any = {};
    try {
      payload = correctionPayload ? JSON.parse(correctionPayload) : {};
    } catch {
      toast({ title: "Invalid JSON payload", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolution-correction", {
        body: { issue_id: selected.id, correction_type: correctionType, reason: correctionReason, payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Correction applied", description: JSON.stringify((data as any)?.result || {}) });
      setCorrectionOpen(false);
      setCorrectionType(""); setCorrectionReason(""); setCorrectionPayload("");
      qc.invalidateQueries({ queryKey: ["resolution-corrections", selected.id] });
      qc.invalidateQueries({ queryKey: ["resolution-centre"] });
    } catch (err: any) {
      toast({ title: "Correction failed", description: err.message || String(err), variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (profileLoading) return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!profile?.isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 text-center space-y-3 bg-card border border-border rounded-2xl">
        <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
        <h2 className="text-lg font-bold">Super Admin Only</h2>
        <p className="text-sm text-muted-foreground">The Resolution Centre is restricted to Super Admins.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wrench className="h-6 w-6" /> Resolution Centre</h1>
          <p className="text-sm text-muted-foreground">User-reported issues and manual corrections.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="under_review">Under review</SelectItem>
              <SelectItem value="awaiting_user">Awaiting user</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["resolution-centre"] })}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-3 lg:col-span-1 max-h-[75vh] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : reports && reports.length > 0 ? (
            <ul className="space-y-2">
              {reports.map(r => (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedId === r.id ? "bg-primary/10 border-primary" : "border-border hover:bg-accent/40"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs">{r.ticket_number}</span>
                      <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{r.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{r.issue_type} · {r.affected_service} · {new Date(r.created_at).toLocaleString()}</p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground p-6 text-center">No reports.</p>
          )}
        </Card>

        <Card className="p-4 lg:col-span-2 max-h-[75vh] overflow-y-auto space-y-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground text-center p-8">Select a report to view details.</p>
          ) : (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="font-bold">{selected.ticket_number}</h2>
                  <p className="text-xs text-muted-foreground">{new Date(selected.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <Select value={selected.status} onValueChange={updateStatus}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="under_review">Under review</SelectItem>
                      <SelectItem value="awaiting_user">Awaiting user</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => setCorrectionOpen(true)}><Wrench className="h-3.5 w-3.5 mr-1" /> Apply Correction</Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Reporter</p>
                  <p className="font-medium">{reporterProfile?.full_name || "—"}</p>
                  <p className="text-xs">{selected.contact_phone || reporterProfile?.phone || "—"}</p>
                  <p className="text-xs">{selected.contact_email || reporterProfile?.email || "—"}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Role: {selected.reporter_role}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Classification</p>
                  <p><strong>Type:</strong> {selected.issue_type}</p>
                  <p><strong>Service:</strong> {selected.affected_service}</p>
                  {selected.reference_code && <p><strong>Ref:</strong> <span className="font-mono">{selected.reference_code}</span></p>}
                </div>
              </div>

              <div>
                <Label>Description</Label>
                <p className="text-sm whitespace-pre-wrap p-3 rounded-lg bg-muted/30 mt-1">{selected.description}</p>
              </div>

              {selected.evidence_urls && selected.evidence_urls.length > 0 && (
                <div className="space-y-2">
                  <Label>Evidence ({selected.evidence_urls.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selected.evidence_urls.map((p: string, i: number) => (
                      <EvidenceLink key={i} path={p} />
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Conversation</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto p-2 bg-muted/20 rounded-lg">
                  {messages && messages.length > 0 ? messages.map(m => (
                    <div key={m.id} className={`p-2 rounded-lg text-sm ${m.sender_role === "admin" ? "bg-primary/10 ml-6" : "bg-card mr-6"}`}>
                      <p className="text-[10px] font-semibold text-muted-foreground">{m.sender_role === "admin" ? "Admin" : "User"} · {new Date(m.created_at).toLocaleString()}</p>
                      <p className="whitespace-pre-wrap">{m.body}</p>
                    </div>
                  )) : <p className="text-xs text-muted-foreground text-center p-4">No messages yet.</p>}
                </div>
                <div className="flex gap-2">
                  <Textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to user..." rows={2} />
                  <Button onClick={sendReply} disabled={!reply.trim()}><Send className="h-4 w-4" /></Button>
                </div>
              </div>

              {corrections && corrections.length > 0 && (
                <div className="space-y-2">
                  <Label>Correction History</Label>
                  <ul className="space-y-1 text-xs">
                    {corrections.map(c => (
                      <li key={c.id} className="p-2 rounded-lg border border-border">
                        <p><strong>{c.correction_type}</strong> on {c.target_table || "—"}</p>
                        <p className="text-muted-foreground">{c.reason}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Dialog open={correctionOpen} onOpenChange={setCorrectionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply Manual Correction</DialogTitle>
            <DialogDescription>All corrections are logged with reason, before/after state, and timestamp.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Correction Type *</Label>
              <Select value={correctionType} onValueChange={setCorrectionType}>
                <SelectTrigger><SelectValue placeholder="Choose correction" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="provision_rent_cards">Provision missing rent cards (payload: {`{ "escrow_id": "..." }`})</SelectItem>
                  <SelectItem value="mark_complaint_payment_paid">Mark complaint payment as paid (payload: {`{ "complaint_id": "..." }`})</SelectItem>
                  <SelectItem value="regenerate_receipt">Regenerate receipt (payload: {`{ "escrow_id": "..." }`})</SelectItem>
                  <SelectItem value="update_dashboard_status">Update record (payload: {`{ "table": "...", "id": "...", "updates": {} }`})</SelectItem>
                  <SelectItem value="free_form_note">Free-form note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Payload (JSON) *</Label>
              <Textarea value={correctionPayload} onChange={(e) => setCorrectionPayload(e.target.value)} rows={4} className="font-mono text-xs" placeholder='{ "escrow_id": "uuid-here" }' />
            </div>
            <div className="space-y-2">
              <Label>Reason * (audit log)</Label>
              <Textarea value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} rows={2} placeholder="Why is this correction needed?" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCorrectionOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={runCorrection} disabled={submitting || !correctionType}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const EvidenceLink = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("issue-evidence").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl || null));
  }, [path]);
  const name = path.split("/").pop() || "file";
  if (!url) return <span className="text-xs text-muted-foreground">{name}…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-xs underline inline-flex items-center gap-1">
      <FileText className="h-3 w-3" /> {name}
    </a>
  );
};

export default ResolutionCentre;

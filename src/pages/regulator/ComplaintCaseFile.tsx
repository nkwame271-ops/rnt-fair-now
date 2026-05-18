import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, FileText, Users, Home, Paperclip, UserCheck, FileSignature, CalendarClock,
  StickyNote, Gavel, Activity, ChevronLeft, Edit3, UserPlus, Calendar as CalendarIcon, Plus, CheckCircle2,
} from "lucide-react";
import { STAGE_LABELS, STAGE_BADGE_CLASS, transitionStage, logComplaintAction } from "@/lib/complaintAudit";
import { signStorageUrl } from "@/lib/signStorageUrl";

const ComplaintCaseFile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<any>(null);
  const [hearings, setHearings] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [witnesses, setWitnesses] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [decision, setDecision] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);

  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [
      cRes, hRes, nRes, wRes, dRes, decRes, hisRes, audRes, offRes, roomRes, staffRes,
    ] = await Promise.all([
      supabase.from("complaints").select("*").eq("id", id).maybeSingle(),
      supabase.from("complaint_hearings").select("*").eq("case_id", id).order("scheduled_at", { ascending: false }),
      supabase.from("complaint_notes").select("*").eq("complaint_id", id).order("created_at", { ascending: false }),
      supabase.from("complaint_witnesses").select("*").eq("case_id", id),
      supabase.from("complaint_documents").select("*").eq("case_id", id).order("generated_at", { ascending: false }),
      supabase.from("complaint_decisions").select("*").eq("case_id", id).order("recorded_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("complaint_status_history").select("*").eq("case_id", id).order("changed_at", { ascending: false }),
      supabase.from("complaint_audit_log").select("*").eq("case_id", id).order("created_at", { ascending: false }).limit(100),
      supabase.from("offices").select("*").order("name"),
      supabase.from("hearing_rooms").select("*").order("name"),
      supabase.from("admin_staff").select("user_id, admin_type, full_name, office_id"),
    ]);
    setC(cRes.data);
    setHearings(hRes.data || []);
    setNotes(nRes.data || []);
    setWitnesses(wRes.data || []);
    setDocs(dRes.data || []);
    setDecision(decRes.data);
    setHistory(hisRes.data || []);
    setAudit(audRes.data || []);
    setOffices(offRes.data || []);
    setRooms(roomRes.data || []);
    setAdmins(staffRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (loading || !c) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const stageLabel = STAGE_LABELS[c.current_stage] || c.current_stage;
  const stageClass = STAGE_BADGE_CLASS[c.current_stage] || "bg-muted text-foreground";

  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/regulator/complaints/command-center")}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Command Center
          </Button>
          <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
            <FileText className="h-6 w-6" /> {c.complaint_title || c.complaint_type || "Case"}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground flex-wrap">
            <Badge variant="outline">{c.ticket_number || c.complaint_code}</Badge>
            <Badge className={stageClass}>{stageLabel}</Badge>
            <span>•</span>
            <span>{new Date(c.created_at).toLocaleDateString()}</span>
            {c.next_hearing_at && (
              <>
                <span>•</span>
                <span>Next hearing {new Date(c.next_hearing_at).toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.status === "draft" && (
            <Button variant="outline" size="sm" onClick={() => navigate(`/regulator/complaints/new?draft=${c.id}`)}>
              <Edit3 className="h-4 w-4 mr-1" /> Edit Draft
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-4 w-4 mr-1" /> Assign
          </Button>
          <Button variant="outline" size="sm" onClick={() => setScheduleOpen(true)}>
            <CalendarIcon className="h-4 w-4 mr-1" /> Schedule Hearing
          </Button>
          <Button variant="outline" size="sm" onClick={() => setNoteOpen(true)}>
            <StickyNote className="h-4 w-4 mr-1" /> Add Note
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDecisionOpen(true)}>
            <Gavel className="h-4 w-4 mr-1" /> Record Decision
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="overview"><FileText className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="parties"><Users className="h-4 w-4 mr-1" /> Parties</TabsTrigger>
          <TabsTrigger value="property"><Home className="h-4 w-4 mr-1" /> Property</TabsTrigger>
          <TabsTrigger value="evidence"><Paperclip className="h-4 w-4 mr-1" /> Evidence</TabsTrigger>
          <TabsTrigger value="witnesses"><UserCheck className="h-4 w-4 mr-1" /> Witnesses</TabsTrigger>
          <TabsTrigger value="documents"><FileSignature className="h-4 w-4 mr-1" /> Documents</TabsTrigger>
          <TabsTrigger value="hearings"><CalendarClock className="h-4 w-4 mr-1" /> Hearings</TabsTrigger>
          <TabsTrigger value="notes"><StickyNote className="h-4 w-4 mr-1" /> Notes</TabsTrigger>
          <TabsTrigger value="decision"><Gavel className="h-4 w-4 mr-1" /> Decision</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card><CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row k="Type" v={c.complaint_type} />
              <Row k="Office" v={offices.find((o) => o.id === c.office_id)?.name} />
              <Row k="Assigned Officer" v={admins.find((a) => a.user_id === c.assigned_officer_user_id)?.full_name} />
              <Row k="Rent" v={c.rent_amount ? `GHS ${Number(c.rent_amount).toLocaleString()}` : "—"} />
              <Row k="Description" v={c.description} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parties" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card><CardHeader><CardTitle>Complainant</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row k="Role" v={c.complainant_role} />
                <Row k="Name" v={c.placeholder_complainant_name || (c.tenant_user_id ? "Registered user" : "—")} />
                <Row k="Phone" v={c.placeholder_complainant_phone} />
              </CardContent>
            </Card>
            <Card><CardHeader><CardTitle>Respondent</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row k="Role" v={c.respondent_role} />
                <Row k="Name" v={c.placeholder_respondent_name || c.landlord_name} />
                <Row k="Phone" v={c.placeholder_respondent_phone} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="property" className="mt-4">
          <Card><CardContent className="pt-6 space-y-1 text-sm">
            <Row k="Address" v={c.property_address} />
            <Row k="Region" v={c.region} />
            <Row k="Linked Property" v={c.linked_property_id || "—"} />
            <Row k="Linked Unit" v={c.linked_unit_id || "—"} />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="evidence" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2">
            {(c.evidence_urls || []).length === 0 && <p className="text-sm text-muted-foreground">No evidence uploaded.</p>}
            {(c.evidence_urls || []).map((p: string) => (
              <EvidenceRow key={p} path={p} />
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="witnesses" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2">
            {witnesses.length === 0 && <p className="text-sm text-muted-foreground">No witnesses recorded.</p>}
            {witnesses.map((w) => (
              <div key={w.id} className="rounded border p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <strong>{w.name}</strong>
                  <Badge variant={w.side === "complainant" ? "default" : "secondary"}>{w.side}</Badge>
                </div>
                <p className="text-muted-foreground">{w.phone} {w.address ? `• ${w.address}` : ""}</p>
                {w.expected_testimony && <p className="text-xs">{w.expected_testimony}</p>}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2">
            {docs.length === 0 && <p className="text-sm text-muted-foreground">No documents generated yet.</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <strong>{d.form_type}</strong> · v{d.version_number}
                  <Badge variant="outline" className="ml-2">{d.status}</Badge>
                  {d.change_reason && <p className="text-xs text-muted-foreground mt-1">{d.change_reason}</p>}
                </div>
                {d.file_url && (
                  <Button size="sm" variant="outline" onClick={async () => {
                    const url = await signStorageUrl("form-outputs", d.file_url);
                    if (url) window.open(url, "_blank");
                  }}>Open</Button>
                )}
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="hearings" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2">
            {hearings.length === 0 && <p className="text-sm text-muted-foreground">No hearings scheduled.</p>}
            {hearings.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded border p-3 text-sm">
                <div>
                  <strong>{new Date(h.scheduled_at).toLocaleString()}</strong>
                  <p className="text-muted-foreground">
                    {rooms.find((r) => r.id === h.room_id)?.name || "No room"} ·
                    {" "}{admins.find((a) => a.user_id === h.officer_user_id)?.full_name || "Unassigned officer"}
                  </p>
                  {h.outcome && <p className="text-xs">{h.outcome}</p>}
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">{h.status}</Badge>
                  <Button size="sm" onClick={() => navigate(`/regulator/complaints/${id}/hearing/${h.id}`)}>
                    Open Workspace
                  </Button>
                </div>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2">
            {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
            {notes.map((n) => (
              <div key={n.id} className="rounded border p-3 text-sm space-y-1">
                <div className="flex justify-between items-center">
                  <Badge variant={n.note_type === "official_proceedings" ? "default" : "secondary"}>
                    {n.note_type === "official_proceedings" ? "Official" : "Internal"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p>{n.content || n.note}</p>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="decision" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2 text-sm">
            {!decision && <p className="text-muted-foreground">No decision recorded.</p>}
            {decision && (
              <>
                <Row k="Outcome" v={decision.outcome} />
                <Row k="Summary" v={decision.decision_summary} />
                <Row k="Orders" v={decision.orders} />
                <Row k="Compliance Deadline" v={decision.compliance_deadline} />
                <Row k="Recorded" v={new Date(decision.recorded_at).toLocaleString()} />
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card><CardContent className="pt-6 space-y-2 text-sm">
            {history.length === 0 && audit.length === 0 && <p className="text-muted-foreground">No activity yet.</p>}
            {history.map((h) => (
              <div key={h.id} className="flex justify-between border-b py-1">
                <span>Stage: {h.previous_status || "—"} → <strong>{h.new_status}</strong></span>
                <span className="text-xs text-muted-foreground">{new Date(h.changed_at).toLocaleString()}</span>
              </div>
            ))}
            {audit.map((a) => (
              <div key={a.id} className="flex justify-between border-b py-1">
                <span>{a.action}</span>
                <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <AssignDialog
        open={assignOpen} onOpenChange={setAssignOpen}
        complaint={c} offices={offices} admins={admins} onSaved={load}
      />
      <ScheduleDialog
        open={scheduleOpen} onOpenChange={setScheduleOpen}
        complaint={c} rooms={rooms} admins={admins} onSaved={load}
      />
      <NoteDialog open={noteOpen} onOpenChange={setNoteOpen} caseId={c.id} onSaved={load} />
      <DecisionDialog open={decisionOpen} onOpenChange={setDecisionOpen} complaint={c} onSaved={load} />
    </div>
  );
};

const Row = ({ k, v }: { k: string; v?: any }) => (
  <div className="flex justify-between gap-4 border-b py-1">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-right font-medium whitespace-pre-wrap">{v || "—"}</span>
  </div>
);

const EvidenceRow = ({ path }: { path: string }) => {
  const [opening, setOpening] = useState(false);
  return (
    <div className="flex items-center justify-between rounded border p-2 text-sm">
      <span className="truncate">{path.split("/").pop()}</span>
      <Button size="sm" variant="outline" disabled={opening} onClick={async () => {
        setOpening(true);
        const url = await signStorageUrl("application-evidence", path);
        setOpening(false);
        if (url) window.open(url, "_blank");
        else toast({ title: "File not found", variant: "destructive" });
      }}>Open</Button>
    </div>
  );
};

const AssignDialog = ({ open, onOpenChange, complaint, offices, admins, onSaved }: any) => {
  const [officeId, setOfficeId] = useState(complaint.office_id || "");
  const [officerId, setOfficerId] = useState(complaint.assigned_officer_user_id || "");
  const [saving, setSaving] = useState(false);
  const eligible = useMemo(
    () => admins.filter((a: any) => ["adjudicating_officer", "case_admin", "main_admin", "super_admin"].includes(a.admin_type)),
    [admins]
  );
  const save = async () => {
    setSaving(true);
    try {
      await supabase.from("complaints").update({
        office_id: officeId || null,
        assigned_officer_user_id: officerId || null,
      }).eq("id", complaint.id);
      await transitionStage({ caseId: complaint.id, toStage: "assigned", reason: "Assigned to officer" });
      await logComplaintAction({ caseId: complaint.id, action: "assign", newValue: { officeId, officerId } });
      toast({ title: "Case assigned" });
      onOpenChange(false);
      onSaved();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign Case</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Office</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
              <SelectContent>{offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Officer</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger><SelectValue placeholder="Select officer" /></SelectTrigger>
              <SelectContent>{eligible.map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name} ({a.admin_type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ScheduleDialog = ({ open, onOpenChange, complaint, rooms, admins, onSaved }: any) => {
  const [when, setWhen] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [officerId, setOfficerId] = useState(complaint.assigned_officer_user_id || "");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!when) return toast({ title: "Pick a date/time", variant: "destructive" });
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("complaint_hearings").insert({
        case_id: complaint.id, case_kind: "complaint",
        scheduled_at: new Date(when).toISOString(),
        room_id: roomId || null, officer_user_id: officerId || null,
        priority, status: "scheduled", created_by: auth.user?.id,
      });
      if (error) throw error;
      await supabase.from("complaints").update({ next_hearing_at: new Date(when).toISOString() }).eq("id", complaint.id);
      await transitionStage({ caseId: complaint.id, toStage: "scheduled", reason: "Hearing scheduled" });
      toast({ title: "Hearing scheduled" });
      onOpenChange(false); onSaved();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Hearing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date & Time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div><Label>Room</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Select room (optional)" /></SelectTrigger>
              <SelectContent>{rooms.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Officer</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger><SelectValue placeholder="Select officer" /></SelectTrigger>
              <SelectContent>{admins.map((a: any) => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const NoteDialog = ({ open, onOpenChange, caseId, onSaved }: any) => {
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState<"internal" | "official_proceedings">("internal");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("complaint_notes").insert({
        complaint_id: caseId, case_kind: "complaint",
        note_type: noteType, content, author_id: auth.user?.id,
      } as any);
      if (error) throw error;
      toast({ title: "Note added" });
      setContent("");
      onOpenChange(false); onSaved();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Type</Label>
            <Select value={noteType} onValueChange={(v) => setNoteType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (staff only)</SelectItem>
                <SelectItem value="official_proceedings">Official Proceedings</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea rows={5} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write note..." />
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DecisionDialog = ({ open, onOpenChange, complaint, onSaved }: any) => {
  const [outcome, setOutcome] = useState("decided");
  const [summary, setSummary] = useState("");
  const [orders, setOrders] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!summary.trim()) return toast({ title: "Decision summary required", variant: "destructive" });
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("complaint_decisions").insert({
        case_id: complaint.id, case_kind: "complaint",
        outcome, decision_summary: summary, orders: orders || null,
        compliance_deadline: deadline || null,
        officer_user_id: auth.user?.id,
      });
      if (error) throw error;
      await transitionStage({ caseId: complaint.id, toStage: outcome, reason: "Decision recorded" });
      toast({ title: "Decision recorded" });
      onOpenChange(false); onSaved();
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Decision</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Outcome</Label>
            <Select value={outcome} onValueChange={setOutcome}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="decided">Decided</SelectItem>
                <SelectItem value="settled">Settled</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="withdrawn">Withdrawn</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Summary</Label><Textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
          <div><Label>Orders / Directions</Label><Textarea rows={3} value={orders} onChange={(e) => setOrders(e.target.value)} /></div>
          <div><Label>Compliance Deadline</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComplaintCaseFile;

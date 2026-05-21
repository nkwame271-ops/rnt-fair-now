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
import { notifyComplaintParties, complaintRecipients } from "@/lib/complaintNotify";
import { signStorageUrl } from "@/lib/signStorageUrl";
import ComplaintDocumentsHub from "@/components/regulator/ComplaintDocumentsHub";
import FormEditorDialog from "@/components/regulator/FormEditorDialog";
import { StatutoryFormType } from "@/lib/complaintForms";

const ComplaintCaseFile = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = (() => { try { const u = new URL(window.location.href); return [Object.fromEntries(u.searchParams)] as const; } catch { return [{} as Record<string,string>] as const; } })();
  const kindHint = (searchParams as any)?.kind === "landlord" ? "landlord_complaint" : null;
  const [caseKind, setCaseKind] = useState<"complaint" | "landlord_complaint">("complaint");
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<any>(null);
  const [hearings, setHearings] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [witnesses, setWitnesses] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [casePayments, setCasePayments] = useState<any[]>([]);
  const [basketItems, setBasketItems] = useState<any[]>([]);
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
  const [headerFormEditor, setHeaderFormEditor] = useState<{ open: boolean; type: StatutoryFormType }>({ open: false, type: "form_7" });

  const load = async () => {
    if (!id) return;
    setLoading(true);

    // Try primary table per hint, fall back to the other
    const primary = kindHint === "landlord_complaint" ? "landlord_complaints" : "complaints";
    const fallback = primary === "complaints" ? "landlord_complaints" : "complaints";
    let cData: any = null;
    let resolvedKind: "complaint" | "landlord_complaint" =
      primary === "complaints" ? "complaint" : "landlord_complaint";

    const primaryRes = await supabase.from(primary).select("*").eq("id", id).maybeSingle();
    if (primaryRes.data) {
      cData = primaryRes.data;
    } else {
      const fbRes = await supabase.from(fallback).select("*").eq("id", id).maybeSingle();
      if (fbRes.data) {
        cData = fbRes.data;
        resolvedKind = fallback === "complaints" ? "complaint" : "landlord_complaint";
      }
    }
    setCaseKind(resolvedKind);

    // Resolve the actual cases row id for this complaint so we can find receipts
    // that were stored against cases.id (not the complaint id directly).
    const { data: caseRow } = await supabase
      .from("cases")
      .select("id")
      .eq("related_complaint_id", id)
      .maybeSingle();
    const realCaseId = caseRow?.id || null;

    // Find all escrow transactions tied to this complaint (covers admin checkout + tenant flow)
    const { data: escrowRows } = await supabase
      .from("escrow_transactions")
      .select("id")
      .eq("related_complaint_id", id);
    const escrowIds = (escrowRows || []).map((r: any) => r.id);

    const [
      hRes, nRes, wRes, dRes, decRes, hisRes, audRes, offRes, roomRes, staffRes, rcptByCaseRes, rcptByEscrowRes, basketRes, cpByCaseRes, cpByEscrowRes,
    ] = await Promise.all([
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
      // Receipts linked through the real cases row
      realCaseId
        ? supabase.from("payment_receipts").select("*").eq("case_id", realCaseId).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      // Receipts linked through any escrow transaction tied to this complaint
      escrowIds.length
        ? supabase.from("payment_receipts").select("*").in("escrow_transaction_id", escrowIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      (supabase.from("complaint_basket_items") as any).select("*").eq("complaint_id", id).order("created_at"),
      // Unified case_payments — source of truth for amounts and reconciliation status
      realCaseId
        ? (supabase.from("case_payments") as any).select("*").eq("case_id", realCaseId).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
      escrowIds.length
        ? (supabase.from("case_payments") as any).select("*").in("escrow_transaction_id", escrowIds).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as any[] }),
    ]);
    setC(cData);
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
    // Merge & dedupe receipts found via case_id and via escrow linkage
    const seen = new Set<string>();
    const allReceipts = [...(rcptByCaseRes.data || []), ...(rcptByEscrowRes.data || [])].filter((r: any) => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    setReceipts(allReceipts);
    const seenCp = new Set<string>();
    const allCp = [...((cpByCaseRes as any).data || []), ...((cpByEscrowRes as any).data || [])].filter((r: any) => {
      if (seenCp.has(r.id)) return false;
      seenCp.add(r.id);
      return true;
    });
    setCasePayments(allCp);
    setBasketItems((basketRes as any).data || []);
    setLoading(false);
  };

  // After Paystack redirect, force-verify the payment so the case state catches up
  // immediately instead of waiting for the webhook.
  useEffect(() => {
    if (!id) return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref") || sessionStorage.getItem("pendingPaymentReference");
    if (!ref) return;
    (async () => {
      try {
        await supabase.functions.invoke("verify-payment", { body: { reference: ref } });
      } catch (e) { console.warn("verify-payment failed", e); }
      sessionStorage.removeItem("pendingPaymentReference");
      // Strip the query string so we don't re-trigger on every reload
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        url.searchParams.delete("status");
        window.history.replaceState({}, "", url.toString());
      } catch {}
      await new Promise((r) => setTimeout(r, 1200));
      await load();
      setTimeout(() => load(), 3000);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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
            {c.case_number && <Badge className="bg-primary text-primary-foreground">{c.case_number}</Badge>}
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
          <Button variant="outline" size="sm" onClick={() => setHeaderFormEditor({ open: true, type: "form_7" })}>
            <FileSignature className="h-4 w-4 mr-1" /> Generate Form 7
          </Button>
          <Button variant="outline" size="sm" onClick={() => setHeaderFormEditor({ open: true, type: "form_33" })}>
            <FileSignature className="h-4 w-4 mr-1" /> Generate Form 33
          </Button>
        </div>
      </div>

      <PaymentSummaryCard receipts={receipts} casePayments={casePayments} basket={basketItems} complaint={c} />

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
          <ComplaintDocumentsHub
            complaint={c}
            officeName={offices.find((o) => o.id === c.office_id)?.name}
            docs={docs}
            receipts={receipts}
            onChanged={load}
            onOpenGenericNew={() => navigate(`/regulator/complaints/${id}/documents/new`)}
          />
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
      <FormEditorDialog
        open={headerFormEditor.open}
        onOpenChange={(v) => setHeaderFormEditor((s) => ({ ...s, open: v }))}
        complaint={c}
        officeName={offices.find((o) => o.id === c.office_id)?.name}
        formType={headerFormEditor.type}
        onGenerated={load}
      />
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
        const url = await signStorageUrl(`application-evidence/${path}`);
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
      const officerName = admins.find((a: any) => a.user_id === officerId)?.full_name || "an officer";
      await notifyComplaintParties({
        event: "assigned",
        data: { ref: complaint.ticket_number || complaint.complaint_code, officer: officerName },
        recipients: complaintRecipients(complaint),
        link: `/regulator/complaints/${complaint.id}`,
      });
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
  const [roomNumber, setRoomNumber] = useState<string>("");
  const [officerId, setOfficerId] = useState(complaint.assigned_officer_user_id || "");
  const [priority, setPriority] = useState("normal");
  const [saving, setSaving] = useState(false);
  const [assignedOfficers, setAssignedOfficers] = useState<any[]>([]);

  // Populate the officer dropdown from the case's "Assigned To" list (complaint_assignments).
  useEffect(() => {
    if (!open || !complaint?.id) return;
    (async () => {
      const { data: assigns } = await (supabase.from("complaint_assignments") as any)
        .select("assigned_to, unassigned_at")
        .eq("complaint_id", complaint.id);
      const activeIds: string[] = (assigns || [])
        .filter((a: any) => !a.unassigned_at)
        .map((a: any) => a.assigned_to);
      const historicalIds: string[] = (assigns || []).map((a: any) => a.assigned_to);
      const ids = Array.from(new Set([...activeIds, ...historicalIds, complaint.assigned_officer_user_id].filter(Boolean)));
      if (ids.length === 0) { setAssignedOfficers([]); return; }
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
      const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));
      // Merge with admin_staff records to expose admin_type/office where available
      setAssignedOfficers(
        ids.map((uid) => {
          const a = (admins || []).find((x: any) => x.user_id === uid);
          return { user_id: uid, full_name: nameMap.get(uid) || a?.full_name || "Staff", admin_type: a?.admin_type, active: activeIds.includes(uid) };
        })
      );
    })();
  }, [open, complaint?.id, admins]);

  const save = async () => {
    if (!when) return toast({ title: "Pick a date/time", variant: "destructive" });
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      // Map numbered room (1-10) to an entry in hearing_rooms by name when present, otherwise persist the label only.
      let roomId: string | null = null;
      if (roomNumber) {
        const want = `Room ${roomNumber}`;
        const match = (rooms || []).find((r: any) => (r.name || "").toLowerCase() === want.toLowerCase());
        roomId = match?.id || null;
      }
      const { data: hearing, error } = await supabase.from("complaint_hearings").insert({
        case_id: complaint.id, case_kind: "complaint",
        scheduled_at: new Date(when).toISOString(),
        room_id: roomId, room_label: roomNumber ? `Room ${roomNumber}` : null,
        officer_user_id: officerId || null,
        priority, status: "scheduled", created_by: auth.user?.id,
      } as any).select("id").single();
      if (error) throw error;
      await supabase.from("complaints").update({ next_hearing_at: new Date(when).toISOString() }).eq("id", complaint.id);
      await transitionStage({ caseId: complaint.id, toStage: "scheduled", reason: "Hearing scheduled" });

      // Auto-generate Form 33 draft — non-blocking
      try {
        const { generateForm33Draft } = await import("@/lib/complaintForms");
        await generateForm33Draft(complaint.id, complaint, {
          scheduled_at: new Date(when).toISOString(),
          venue: roomNumber ? `Room ${roomNumber}` : undefined,
        });
      } catch (e) { console.warn("Form 33 auto-generate failed", e); }

      await notifyComplaintParties({
        event: "scheduled",
        data: { ref: complaint.ticket_number || complaint.complaint_code, when: new Date(when).toLocaleString() },
        recipients: complaintRecipients(complaint),
        link: `/regulator/complaints/${complaint.id}`,
      });
      toast({ title: "Hearing scheduled", description: "Form 33 draft created — edit and finalize from the Documents tab." });
      onOpenChange(false); onSaved();
    } catch (e: any) { toast({ title: e.message || "Failed to schedule", variant: "destructive" }); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule Hearing</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Date & Time</Label><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div><Label>Room</Label>
            <Select value={roomNumber} onValueChange={setRoomNumber}>
              <SelectTrigger><SelectValue placeholder="Select room number" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>Room {n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Officer</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder={assignedOfficers.length === 0 ? "Assign the case from Complaint Management first" : "Select officer"} />
              </SelectTrigger>
              <SelectContent>
                {assignedOfficers.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    No officers assigned to this case. Use “Assigned to” in Complaint Management.
                  </div>
                ) : (
                  assignedOfficers.map((a: any) => (
                    <SelectItem key={a.user_id} value={a.user_id}>
                      {a.full_name}{a.active ? "" : " · past"}{a.admin_type === "main_admin" ? " · Main" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Officer list is sourced from the case’s “Assigned To” list in Complaint Management.</p>
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
      const evt = outcome === "settled" ? "settled" : outcome === "closed" ? "closed" : "decided";
      await notifyComplaintParties({
        event: evt as any,
        data: { ref: complaint.ticket_number || complaint.complaint_code },
        recipients: complaintRecipients(complaint),
        link: `/regulator/complaints/${complaint.id}`,
      });
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

function PaymentSummaryCard({ receipts, casePayments, basket, complaint }: { receipts: any[]; casePayments: any[]; basket: any[]; complaint: any }) {
  const latest = receipts?.[0];
  const paidCp = (casePayments || []).filter((c) => c.payment_status === "paid");
  // Prefer the unified case_payments total — it never reports GHS 0.00 when status=paid.
  const totalFromReceipts = (receipts || []).reduce((s, r) => s + Number(r.total_amount || 0), 0);
  const totalFromCp = paidCp.reduce((s, c) => s + Number(c.amount_paid || 0), 0);
  const totalPaid = totalFromCp > 0 ? totalFromCp : totalFromReceipts;
  const paidBasket = (basket || []).filter((b) => b.paid_at);
  const unpaidBasket = (basket || []).filter((b) => !b.paid_at);
  const feeTypes = Array.from(new Set((basket || []).map((b) => b.label).filter(Boolean)));
  const isPaidByCp = paidCp.length > 0;
  const status = isPaidByCp
    ? "paid"
    : latest?.receipt_status || latest?.status || (paidBasket.length ? "paid" : "pending");
  const statusClass =
    status === "active" || status === "paid"
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : status === "voided" || status === "failed"
      ? "bg-rose-100 text-rose-800 border-rose-200"
      : "bg-amber-100 text-amber-800 border-amber-200";

  if (!latest && (!basket || basket.length === 0) && paidCp.length === 0) {
    return (
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Payment &amp; Receipt Summary</p>
            <p className="text-xs text-muted-foreground">No payment recorded yet for this case.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">Payment &amp; Receipt Summary</p>
            <Badge variant="outline" className={statusClass}>{status.toUpperCase()}</Badge>
            {unpaidBasket.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200">
                {unpaidBasket.length} unpaid item(s)
              </Badge>
            )}
          </div>
          <div className="text-sm font-semibold">
            Total paid: GHS {totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
          {feeTypes.length > 0 && (
            <Row k="Fee type(s)" v={feeTypes.join(", ")} />
          )}
          {latest && <>
            <Row k="Receipt #" v={latest.receipt_number} />
            <Row k="Payment ref" v={latest.paystack_reference || latest.platform_reference || "—"} />
            <Row k="Payer" v={latest.payer_name || "—"} />
            <Row k="Payer type" v={latest.generated_by_type || complaint.complainant_role || "—"} />
            <Row k="Payer phone" v={latest.payer_phone || "—"} />
            <Row k="Payment date" v={latest.payment_date ? new Date(latest.payment_date).toLocaleString("en-GB") : new Date(latest.created_at).toLocaleString("en-GB")} />
          </>}
        </div>

        {receipts.length > 1 && (
          <p className="text-xs text-muted-foreground">+ {receipts.length - 1} earlier receipt(s) available in the Documents tab.</p>
        )}
      </CardContent>
    </Card>
  );
}


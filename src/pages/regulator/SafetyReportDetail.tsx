import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SAFETY_STATUS_LABELS, SEVERITY_COLORS } from "@/lib/safetyCategories";
import { toast } from "sonner";
import { ArrowLeft, Phone, MessageSquare, CheckCircle, AlertTriangle, MapPin } from "lucide-react";
import SafetyLocationTrail from "@/components/SafetyLocationTrail";

const ESCALATION_TARGETS = ["nugs", "police", "cid", "campus_security", "rent_control_leadership"];

const SafetyReportDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);
  const [pings, setPings] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [escalationNotes, setEscalationNotes] = useState("");
  const [escalateTo, setEscalateTo] = useState<string[]>([]);

  const load = async () => {
    if (!id) return;
    const [r, n, a, p] = await Promise.all([
      supabase.from("safety_reports").select("*").eq("id", id).maybeSingle(),
      supabase.from("safety_notes").select("*").eq("report_id", id).order("created_at", { ascending: false }),
      supabase.from("safety_audit_log").select("*").eq("report_id", id).order("created_at", { ascending: false }),
      supabase.from("safety_location_pings").select("*").eq("report_id", id).order("recorded_at", { ascending: false }),
    ]);
    setReport(r.data);
    setNotes(n.data ?? []);
    setAudit(a.data ?? []);
    setPings(p.data ?? []);
  };

  useEffect(() => { load(); }, [id]);

  const audit_log = async (action: string, details: any = {}) => {
    await supabase.from("safety_audit_log").insert({
      report_id: id!,
      actor_user_id: user!.id,
      action,
      details,
    });
  };

  const acknowledge = async () => {
    if (!report || report.acknowledged_at) return;
    const responseSeconds = Math.floor((Date.now() - new Date(report.created_at).getTime()) / 1000);
    const { error } = await supabase
      .from("safety_reports")
      .update({
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user!.id,
        response_time_seconds: responseSeconds,
        status: report.status === "submitted" ? "acknowledged" : report.status,
      })
      .eq("id", id!);
    if (error) return toast.error(error.message);
    await audit_log("acknowledged", { response_time_seconds: responseSeconds });
    toast.success("Acknowledged");
    load();
  };

  const updateStatus = async (status: string) => {
    const patch: any = { status };
    if (["resolved", "closed", "false_alert"].includes(status)) {
      patch.closed_at = new Date().toISOString();
      patch.closed_by = user!.id;
      patch.closure_reason = closureReason || status;
    }
    const { error } = await supabase.from("safety_reports").update(patch).eq("id", id!);
    if (error) return toast.error(error.message);
    await audit_log("status_changed", { to: status, reason: closureReason });
    toast.success(`Marked ${status}`);
    load();
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    const { error } = await supabase.from("safety_notes").insert({
      report_id: id!,
      author_user_id: user!.id,
      note: newNote,
    });
    if (error) return toast.error(error.message);
    await audit_log("note_added");
    setNewNote("");
    load();
  };

  const escalate = async () => {
    if (escalateTo.length === 0) return toast.error("Pick at least one target");
    const { error } = await supabase
      .from("safety_reports")
      .update({
        escalated_to: escalateTo,
        escalated_at: new Date().toISOString(),
        escalation_notes: escalationNotes,
        status: "escalated",
      })
      .eq("id", id!);
    if (error) return toast.error(error.message);
    await audit_log("escalated", { to: escalateTo, notes: escalationNotes });
    toast.success("Escalated");
    setEscalateTo([]);
    setEscalationNotes("");
    load();
  };

  if (!report) return <p className="text-sm text-muted-foreground">Loading...</p>;

  return (
    <div className="space-y-4 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/regulator/safety")}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              {report.report_kind === "panic_emergency" && (
                <Badge className="bg-red-600 text-white">🚨 PANIC</Badge>
              )}
              {report.ticket_number}
            </span>
            <div className="flex gap-2 items-center">
              <Badge className={SEVERITY_COLORS[report.severity]}>{report.severity}</Badge>
              <Badge variant="outline">{SAFETY_STATUS_LABELS[report.status]}</Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><strong>User:</strong> {report.user_name_snapshot ?? "—"}</div>
            <div><strong>Phone:</strong> {report.user_phone_snapshot ?? "—"}</div>
            <div><strong>Role:</strong> {report.user_role}</div>
            <div><strong>Category:</strong> {report.category?.replace(/_/g, " ") ?? "—"}</div>
            {report.emergency_type && <div><strong>Emergency Type:</strong> {report.emergency_type}</div>}
            {report.school && <div><strong>School:</strong> {report.school}</div>}
            {report.hostel_or_hall && <div><strong>Hostel/Hall:</strong> {report.hostel_or_hall}</div>}
            <div><strong>Silent:</strong> {report.is_silent ? "Yes" : "No"}</div>
            {report.response_time_seconds !== null && (
              <div><strong>Response time:</strong> {report.response_time_seconds}s</div>
            )}
            {report.false_alert_count_at_time > 0 && (
              <div className="col-span-2">
                <Badge variant="destructive">
                  ⚠ {report.false_alert_count_at_time} prior false alerts
                </Badge>
              </div>
            )}
          </div>

          {report.description && (
            <div>
              <strong>Description:</strong>
              <p className="text-muted-foreground mt-1">{report.description}</p>
            </div>
          )}

          {report.latitude && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <a
                href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                target="_blank" rel="noreferrer"
                className="text-primary underline text-sm"
              >
                {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                {report.location_accuracy && ` (±${Math.round(report.location_accuracy)}m)`}
              </a>
            </div>
          )}

          <div className="flex gap-2 flex-wrap pt-2">
            {report.user_phone_snapshot && (
              <>
                <Button size="sm" variant="outline" onClick={() => { window.open(`tel:${report.user_phone_snapshot}`); audit_log("called_user"); }}>
                  <Phone className="h-4 w-4 mr-1" /> Call User
                </Button>
                <Button size="sm" variant="outline" onClick={() => { window.open(`sms:${report.user_phone_snapshot}`); audit_log("messaged_user"); }}>
                  <MessageSquare className="h-4 w-4 mr-1" /> SMS
                </Button>
              </>
            )}
            {!report.acknowledged_at && (
              <Button size="sm" onClick={acknowledge}>
                <CheckCircle className="h-4 w-4 mr-1" /> Acknowledge
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => updateStatus("under_review")}>Under Review</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus("resolved")}>Resolved</Button>
            <Button size="sm" variant="outline" onClick={() => updateStatus("closed")}>Close</Button>
            <Button size="sm" variant="destructive" onClick={() => updateStatus("false_alert")}>False Alert</Button>
          </div>

          <div>
            <Label>Closure reason</Label>
            <Input value={closureReason} onChange={(e) => setClosureReason(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Escalate</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {ESCALATION_TARGETS.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={escalateTo.includes(t) ? "default" : "outline"}
                onClick={() => setEscalateTo((s) => s.includes(t) ? s.filter(x => x !== t) : [...s, t])}
              >
                {t.replace(/_/g, " ")}
              </Button>
            ))}
          </div>
          <Textarea
            value={escalationNotes}
            onChange={(e) => setEscalationNotes(e.target.value)}
            placeholder="Escalation notes"
            rows={2}
          />
          <Button onClick={escalate}>Escalate</Button>
          {report.escalated_to?.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Already escalated to: {report.escalated_to.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note" rows={2} />
          <Button size="sm" onClick={addNote}>Add Note</Button>
          <div className="space-y-2 pt-2">
            {notes.map((n) => (
              <div key={n.id} className="p-2 rounded bg-muted/30 text-sm">
                <p>{n.note}</p>
                <p className="text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Location Pings ({pings.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs max-h-48 overflow-y-auto">
          {pings.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</span>
              <span className="text-muted-foreground">{new Date(p.recorded_at).toLocaleTimeString()}</span>
            </div>
          ))}
          {pings.length === 0 && <p className="text-muted-foreground">No pings.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Audit Log</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-xs max-h-64 overflow-y-auto">
          {audit.map((a) => (
            <div key={a.id} className="flex justify-between border-b py-1">
              <span><strong>{a.action}</strong> {a.details && Object.keys(a.details).length > 0 && JSON.stringify(a.details)}</span>
              <span className="text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default SafetyReportDetail;

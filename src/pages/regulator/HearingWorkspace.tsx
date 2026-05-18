import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, ChevronLeft, Save, CalendarClock, Users, Paperclip, FileText, Mic } from "lucide-react";
import { signStorageUrl } from "@/lib/signStorageUrl";
import { transitionStage } from "@/lib/complaintAudit";

const HearingWorkspace = () => {
  const { id, hid } = useParams<{ id: string; hid: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [c, setC] = useState<any>(null);
  const [h, setH] = useState<any>(null);
  const [witnesses, setWitnesses] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [prevNotes, setPrevNotes] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [outcome, setOutcome] = useState("");
  const [attendance, setAttendance] = useState<{ complainant: boolean; respondent: boolean; complainant_witness: boolean; respondent_witness: boolean }>({
    complainant: false, respondent: false, complainant_witness: false, respondent_witness: false,
  });
  const [statusVal, setStatusVal] = useState("scheduled");
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef<string>("");

  const load = async () => {
    if (!id || !hid) return;
    setLoading(true);
    const [cRes, hRes, wRes, dRes, prevRes] = await Promise.all([
      supabase.from("complaints").select("*").eq("id", id).maybeSingle(),
      supabase.from("complaint_hearings").select("*").eq("id", hid).maybeSingle(),
      supabase.from("complaint_witnesses").select("*").eq("case_id", id),
      supabase.from("complaint_documents").select("*").eq("case_id", id).order("generated_at", { ascending: false }),
      supabase.from("complaint_notes").select("*").eq("complaint_id", id).order("created_at", { ascending: false }).limit(10),
    ]);
    setC(cRes.data); setH(hRes.data);
    setWitnesses(wRes.data || []); setDocs(dRes.data || []);
    setPrevNotes(prevRes.data || []);
    if (hRes.data) {
      setNotes(hRes.data.notes || "");
      setOutcome(hRes.data.outcome || "");
      setStatusVal(hRes.data.status || "scheduled");
      setAttendance({ ...attendance, ...(hRes.data.attendance || {}) });
      lastSavedRef.current = hRes.data.notes || "";
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, hid]);

  // Autosave notes every 8s when changed
  useEffect(() => {
    const t = setInterval(async () => {
      if (notes !== lastSavedRef.current && hid) {
        await supabase.from("complaint_hearings").update({ notes }).eq("id", hid);
        lastSavedRef.current = notes;
      }
    }, 8000);
    return () => clearInterval(t);
  }, [notes, hid]);

  const saveAll = async (newStatus?: string) => {
    if (!hid || !id) return;
    setSaving(true);
    try {
      const payload: any = { notes, outcome, attendance, status: newStatus || statusVal };
      const { error } = await supabase.from("complaint_hearings").update(payload).eq("id", hid);
      if (error) throw error;
      lastSavedRef.current = notes;
      if (newStatus) {
        setStatusVal(newStatus);
        if (newStatus === "ongoing") await transitionStage({ caseId: id, toStage: "hearing_ongoing", reason: "Hearing started" });
        if (newStatus === "completed") await transitionStage({ caseId: id, toStage: "under_review", reason: "Hearing completed" });
        if (newStatus === "adjourned") await transitionStage({ caseId: id, toStage: "adjourned", reason: outcome || "Adjourned" });
        if (newStatus === "cancelled") await transitionStage({ caseId: id, toStage: "assigned", reason: "Hearing cancelled" });
      }
      toast({ title: "Saved" });
    } catch (e: any) { toast({ title: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  if (loading || !c || !h) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="container max-w-7xl py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`/regulator/complaints/${id}`)}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Back to Case File
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2 mt-1">
            <CalendarClock className="h-5 w-5" /> Hearing Workspace
          </h1>
          <p className="text-xs text-muted-foreground">
            {c.ticket_number} · {new Date(h.scheduled_at).toLocaleString()} ·{" "}
            <Badge variant="outline">{statusVal}</Badge>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => saveAll("ongoing")} disabled={saving}>Start Hearing</Button>
          <Button size="sm" variant="outline" onClick={() => saveAll("adjourned")} disabled={saving}>Adjourn</Button>
          <Button size="sm" variant="outline" onClick={() => saveAll("completed")} disabled={saving}>Complete</Button>
          <Button size="sm" onClick={() => saveAll()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        {/* LEFT — case summary */}
        <div className="lg:col-span-3 space-y-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Case</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1">
              <p><strong>{c.complaint_title || c.complaint_type}</strong></p>
              <p className="text-muted-foreground">{c.property_address}, {c.region}</p>
              {c.rent_amount && <p>Rent: GHS {Number(c.rent_amount).toLocaleString()}</p>}
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Users className="h-4 w-4" /> Parties</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2">
              <div>
                <Badge variant="default">Complainant</Badge>
                <p className="mt-1">{c.placeholder_complainant_name || "Registered"} · {c.placeholder_complainant_phone || "—"}</p>
              </div>
              <div>
                <Badge variant="secondary">Respondent</Badge>
                <p className="mt-1">{c.placeholder_respondent_name || c.landlord_name} · {c.placeholder_respondent_phone || "—"}</p>
              </div>
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Previous Notes</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2 max-h-64 overflow-auto">
              {prevNotes.length === 0 && <p className="text-muted-foreground">None.</p>}
              {prevNotes.map((n) => (
                <div key={n.id} className="border-b pb-1">
                  <p className="text-muted-foreground text-[10px]">{new Date(n.created_at).toLocaleString()}</p>
                  <p className="line-clamp-3">{n.content || n.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* CENTER — live notes & attendance */}
        <div className="lg:col-span-6 space-y-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1"><Mic className="h-4 w-4" /> Live Hearing Notes</CardTitle>
              <span className="text-[10px] text-muted-foreground">Autosaves every 8s</span>
            </CardHeader>
            <CardContent>
              <Textarea
                rows={16}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Record the proceedings, statements, directions..."
                className="font-mono text-sm"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Attendance</CardTitle></CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-3 text-sm">
              <AttRow label="Complainant present" checked={attendance.complainant} onChange={(v) => setAttendance({ ...attendance, complainant: v })} />
              <AttRow label="Respondent present" checked={attendance.respondent} onChange={(v) => setAttendance({ ...attendance, respondent: v })} />
              <AttRow label="Complainant witness" checked={attendance.complainant_witness} onChange={(v) => setAttendance({ ...attendance, complainant_witness: v })} />
              <AttRow label="Respondent witness" checked={attendance.respondent_witness} onChange={(v) => setAttendance({ ...attendance, respondent_witness: v })} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Outcome / Next Steps</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Textarea rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Adjournment reason, settlement terms, directions..." />
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={statusVal} onValueChange={setStatusVal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="ongoing">Ongoing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="adjourned">Adjourned</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — evidence/witnesses/forms */}
        <div className="lg:col-span-3 space-y-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><Paperclip className="h-4 w-4" /> Evidence</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1 max-h-48 overflow-auto">
              {(c.evidence_urls || []).length === 0 && <p className="text-muted-foreground">None.</p>}
              {(c.evidence_urls || []).map((p: string) => (
                <button key={p} className="block text-left text-primary hover:underline truncate w-full" onClick={async () => {
                  const url = await signStorageUrl(`application-evidence/${p}`);
                  if (url) window.open(url, "_blank");
                }}>{p.split("/").pop()}</button>
              ))}
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Witnesses</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-2 max-h-48 overflow-auto">
              {witnesses.length === 0 && <p className="text-muted-foreground">None.</p>}
              {witnesses.map((w) => (
                <div key={w.id} className="border-b pb-1">
                  <p><strong>{w.name}</strong> <Badge variant="outline" className="ml-1 text-[10px]">{w.side}</Badge></p>
                  {w.phone && <p className="text-muted-foreground">{w.phone}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-1"><FileText className="h-4 w-4" /> Forms</CardTitle></CardHeader>
            <CardContent className="text-xs space-y-1 max-h-48 overflow-auto">
              {docs.length === 0 && <p className="text-muted-foreground">No documents.</p>}
              {docs.map((d) => (
                <div key={d.id} className="border-b pb-1">
                  <p><strong>{d.form_type}</strong> v{d.version_number}</p>
                  <p className="text-muted-foreground">{d.status}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const AttRow = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <div className="flex items-center justify-between rounded border p-2">
    <span>{label}</span>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

export default HearingWorkspace;

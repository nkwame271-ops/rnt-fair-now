import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, addYears } from "date-fns";
import { ClipboardCheck, Loader2 } from "lucide-react";
import Seo from "@/components/Seo";

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    paid: "bg-blue-100 text-blue-800",
    scheduled: "bg-purple-100 text-purple-800",
    inspected: "bg-indigo-100 text-indigo-800",
    certified: "bg-success/10 text-success",
    rejected: "bg-destructive/10 text-destructive",
    cancelled: "bg-muted text-muted-foreground",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

const RegulatorAssessments = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [outcome, setOutcome] = useState<string>("pass");
  const [findings, setFindings] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("property_assessment_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setRows(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const schedule = async (id: string) => {
    if (!scheduleAt) { toast.error("Pick a date/time"); return; }
    const { error } = await supabase
      .from("property_assessment_applications")
      .update({ scheduled_at: scheduleAt, status: "scheduled" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Scheduled"); setScheduleAt(""); setSelected(null); load();
  };

  const recordInspection = async () => {
    if (!selected || !user) return;
    const { data: insp, error: e1 } = await supabase
      .from("property_assessment_inspections")
      .insert({
        application_id: selected.id,
        inspector_user_id: user.id,
        outcome,
        findings,
      }).select().single();
    if (e1) { toast.error(e1.message); return; }

    if (outcome === "pass") {
      const { data: numRes } = await supabase.rpc("generate_assessment_certificate_number" as any);
      const certNumber = (numRes as any) || `PAC-${Date.now()}`;
      const { error: e2 } = await supabase
        .from("property_assessment_certificates")
        .insert({
          application_id: selected.id,
          inspection_id: insp.id,
          property_id: selected.property_id,
          landlord_user_id: selected.landlord_user_id,
          certificate_number: certNumber,
          expires_at: addYears(new Date(), 1).toISOString(),
        });
      if (e2) { toast.error(e2.message); return; }
      await supabase.from("property_assessment_applications").update({ status: "certified" }).eq("id", selected.id);
      toast.success(`Certificate ${certNumber} issued`);
    } else {
      await supabase.from("property_assessment_applications").update({ status: "inspected" }).eq("id", selected.id);
      toast.success("Inspection recorded");
    }
    setSelected(null); setFindings(""); setOutcome("pass"); load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Seo title="Property Assessments | Regulator" description="Manage habitability inspections and certificates." canonicalPath="/regulator/assessments" />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <ClipboardCheck className="h-7 w-7 text-primary" /> Property Assessments
        </h1>
        <p className="text-muted-foreground mt-1">Schedule inspections, record outcomes, and issue certificates.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Requested</th>
              <th className="text-left px-4 py-2">Requester</th>
              <th className="text-left px-4 py-2">Fee</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Scheduled</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No applications yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2">{format(new Date(r.created_at), "dd MMM yyyy")}</td>
                <td className="px-4 py-2 capitalize">{r.requester_role}</td>
                <td className="px-4 py-2">GHS {Number(r.fee_amount).toLocaleString()} <span className="text-xs text-muted-foreground">({r.fee_status})</span></td>
                <td className="px-4 py-2"><Badge className={statusBadge(r.status)}>{r.status}</Badge></td>
                <td className="px-4 py-2">{r.scheduled_at ? format(new Date(r.scheduled_at), "dd MMM HH:mm") : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setSelected(r)}>Manage</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Manage application</DialogTitle></DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Schedule inspection</Label>
                          <div className="flex gap-2">
                            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
                            <Button onClick={() => schedule(r.id)}>Save</Button>
                          </div>
                        </div>
                        <div className="pt-3 border-t border-border space-y-2">
                          <Label>Record inspection outcome</Label>
                          <Select value={outcome} onValueChange={setOutcome}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pass">Pass — issue certificate</SelectItem>
                              <SelectItem value="fail">Fail</SelectItem>
                              <SelectItem value="needs_recheck">Needs recheck</SelectItem>
                            </SelectContent>
                          </Select>
                          <Textarea value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Findings & recommendation" rows={3} />
                          <Button onClick={recordInspection} className="w-full">Record</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RegulatorAssessments;

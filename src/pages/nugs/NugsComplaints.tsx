import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Search, ArrowUpRight, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import ComplaintWorkspace from "@/components/ComplaintWorkspace";


interface ComplaintRow {
  id: string;
  complaint_code: string;
  ticket_number?: string;
  complaint_type: string;
  description: string;
  status: string;
  payment_status?: string;
  property_address: string;
  region: string;
  created_at: string;
  tenant_user_id: string;
  escalated_to_rent_control?: boolean;
  escalated_at?: string | null;
  escalation_reason?: string | null;
  studentName?: string;
  school?: string;
}

const statusColor = (s: string) => {
  if (["resolved", "closed"].includes(s)) return "bg-success/10 text-success border-success/30";
  if (["submitted", "under_review", "in_progress"].includes(s)) return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground";
};

const NugsComplaints = () => {
  const { user } = useAuth();
  const [nugsPerms, setNugsPerms] = useState<{ complaints: boolean; rent_card: boolean }>({ complaints: true, rent_card: false });
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignedSchool, setAssignedSchool] = useState<string | null>(null);
  const [escalating, setEscalating] = useState<ComplaintRow | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    // Look up the NUGS admin's assigned school for the header
    if (user?.id) {
      const { data: assignment } = await (supabase
        .from("nugs_staff") as any)
        .select("assigned_school, permissions")
        .eq("user_id", user.id)
        .maybeSingle();
      setAssignedSchool(assignment?.assigned_school ?? null);
      const p = (assignment?.permissions as any) || {};
      setNugsPerms({ complaints: p.complaints !== false, rent_card: !!p.rent_card });
    }

    // RLS automatically scopes to student complaints from this NUGS admin's school
    const { data: complaints } = await supabase
      .from("complaints")
      .select("id, complaint_code, ticket_number, complaint_type, description, status, payment_status, property_address, region, created_at, tenant_user_id, escalated_to_rent_control, escalated_at, escalation_reason")
      .order("created_at", { ascending: false });

    const userIds = [...new Set((complaints || []).map((c: any) => c.tenant_user_id))];

    const [profilesRes, tenantsRes] = await Promise.all([
      userIds.length > 0
        ? supabase.from("profiles_counterparty" as any) as any.select("user_id, full_name").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from("tenants").select("user_id, school").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const nameMap: Record<string, string> = {};
    ((profilesRes as any).data || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
    const schoolMap: Record<string, string> = {};
    ((tenantsRes as any).data || []).forEach((t: any) => { schoolMap[t.user_id] = t.school; });

    setRows(
      (complaints || []).map((c: any) => ({
        ...c,
        studentName: nameMap[c.tenant_user_id],
        school: schoolMap[c.tenant_user_id],
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const submitEscalation = async () => {
    if (!escalating) return;
    if (!reason.trim() || reason.trim().length < 10) {
      toast.error("Please provide a clear reason (at least 10 characters)");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("complaints")
      .update({
        escalated_to_rent_control: true,
        escalated_at: new Date().toISOString(),
        escalated_by: user?.id ?? null,
        escalation_reason: reason.trim(),
      })
      .eq("id", escalating.id);
    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to escalate complaint");
      return;
    }

    toast.success("Complaint escalated to Rent Control");
    setEscalating(null);
    setReason("");
    load();
  };

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.complaint_code.toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.school || "").toLowerCase().includes(q) ||
      r.property_address.toLowerCase().includes(q)
    );
  });

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-warning" /> Student Complaints
        </h1>
        <p className="text-muted-foreground mt-1">
          {filtered.length} complaints
          {assignedSchool ? <> from <span className="font-medium text-foreground">{assignedSchool}</span></> : null}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search complaints..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={filtered.length === 0}
          onClick={() => {
            const headers = ["Complaint Code","Ticket","Type","Status","Payment","Student","School","Property Address","Region","Created","Escalated","Escalation Reason","Description"];
            const escape = (v: any) => {
              const s = (v ?? "").toString().replace(/"/g, '""');
              return /[",\n]/.test(s) ? `"${s}"` : s;
            };
            const rows = filtered.map((c) => [
              c.complaint_code, c.ticket_number ?? "", c.complaint_type, c.status, c.payment_status ?? "",
              c.studentName ?? "", c.school ?? "", c.property_address, c.region,
              format(new Date(c.created_at), "yyyy-MM-dd HH:mm"),
              c.escalated_to_rent_control ? "yes" : "no", c.escalation_reason ?? "", c.description,
            ].map(escape).join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nugs-complaints-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success(`Downloaded ${filtered.length} complaint(s)`);
          }}
        >
          <Download className="h-4 w-4 mr-1.5" /> Download records
        </Button>
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-xs font-bold text-primary">{c.complaint_code}</span>
                  {c.ticket_number && (
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.ticket_number}</span>
                  )}
                  <Badge variant="outline" className="text-xs">{c.complaint_type}</Badge>
                  <Badge className={`text-xs border ${statusColor(c.status)}`}>{c.status.replace(/_/g, " ")}</Badge>
                  {c.payment_status === "paid" && (
                    <Badge className="text-xs bg-success/10 text-success border-success/30">Paid</Badge>
                  )}
                  {c.escalated_to_rent_control && (
                    <Badge className="text-xs bg-primary/10 text-primary border-primary/30 border">
                      Escalated to Rent Control
                    </Badge>
                  )}
                </div>
                <p className="font-semibold text-foreground">{c.studentName || "Unknown student"}</p>
                <p className="text-xs text-muted-foreground">{c.school || "—"} • {c.region}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{format(new Date(c.created_at), "MMM d, yyyy")}</span>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-3">{c.description}</p>
            <p className="text-xs text-muted-foreground mt-2">📍 {c.property_address}</p>

            {c.escalated_to_rent_control ? (
              <div className="mt-3 rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs">
                <p className="font-semibold text-foreground mb-0.5">
                  Escalated{c.escalated_at ? ` on ${format(new Date(c.escalated_at), "MMM d, yyyy")}` : ""}
                </p>
                {c.escalation_reason && (
                  <p className="text-muted-foreground">Reason: {c.escalation_reason}</p>
                )}
              </div>
            ) : (
              !["resolved", "closed"].includes(c.status) && (
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toggleExpand(c.id)}>
                    {expanded.has(c.id) ? <><ChevronUp className="h-4 w-4 mr-1.5" />Hide workspace</> : <><ChevronDown className="h-4 w-4 mr-1.5" />Open workspace</>}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setEscalating(c); setReason(""); }}
                  >
                    <ArrowUpRight className="h-4 w-4 mr-1.5" />
                    Escalate to Rent Control
                  </Button>
                </div>
              )
            )}

            {expanded.has(c.id) && nugsPerms.complaints && !c.escalated_to_rent_control && (
              <div className="mt-4 pt-4 border-t border-border">
                <ComplaintWorkspace
                  complaintId={c.id}
                  currentStatus={c.status}
                  feeScope="nugs"
                  allowPayment
                  allowStatusUpdate
                  onChanged={load}
                />
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 text-center border border-border text-muted-foreground">
            No complaints found.
          </div>
        )}
      </div>

      <Dialog open={!!escalating} onOpenChange={(o) => { if (!o) { setEscalating(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Escalate to Rent Control</DialogTitle>
            <DialogDescription>
              This will transfer the complaint to the Rent Control "Escalated Student Complaints" queue. Rent Control will assume control of the case.
            </DialogDescription>
          </DialogHeader>
          {escalating && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-mono text-xs text-primary">{escalating.complaint_code}</p>
                <p className="font-medium text-foreground">{escalating.studentName}</p>
                <p className="text-xs text-muted-foreground">{escalating.school}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Reason for escalation</label>
                <Textarea
                  placeholder="e.g. Landlord refusing engagement after two NUGS-led meetings; matter requires statutory enforcement."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEscalating(null); setReason(""); }} disabled={submitting}>Cancel</Button>
            <Button onClick={submitEscalation} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm escalation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default NugsComplaints;

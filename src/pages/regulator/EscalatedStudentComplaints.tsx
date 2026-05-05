import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, GraduationCap, Search, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import ComplaintWorkspace from "@/components/ComplaintWorkspace";

interface Row {
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
  escalated_at?: string | null;
  escalated_by?: string | null;
  escalation_reason?: string | null;
  studentName?: string;
  studentPhone?: string;
  school?: string;
}

const statusColor = (s: string) => {
  if (["resolved", "closed"].includes(s)) return "bg-success/10 text-success border-success/30";
  if (["submitted", "under_review", "in_progress", "pending_payment", "scheduled"].includes(s)) return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground";
};

const EscalatedStudentComplaints = () => {
  const { profile } = useAdminProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => setExpanded((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const reload = () => { setLoading(true); load(); };
  const load = async () => {
      const { data: complaints } = await supabase
        .from("complaints")
        .select("id, complaint_code, ticket_number, complaint_type, description, status, payment_status, property_address, region, created_at, tenant_user_id, escalated_at, escalated_by, escalation_reason")
        .eq("escalated_to_rent_control", true)
        .order("escalated_at", { ascending: false });

      const userIds = [...new Set((complaints || []).map((c: any) => c.tenant_user_id))];

      const [profilesRes, tenantsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from("tenants").select("user_id, school").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const nameMap: Record<string, { name: string; phone?: string }> = {};
      ((profilesRes as any).data || []).forEach((p: any) => {
        nameMap[p.user_id] = { name: p.full_name, phone: p.phone };
      });
      const schoolMap: Record<string, string> = {};
      ((tenantsRes as any).data || []).forEach((t: any) => { schoolMap[t.user_id] = t.school; });

      setRows(
        (complaints || []).map((c: any) => ({
          ...c,
          studentName: nameMap[c.tenant_user_id]?.name,
          studentPhone: nameMap[c.tenant_user_id]?.phone,
          school: schoolMap[c.tenant_user_id],
        }))
      );
      setLoading(false);
    };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const allStatuses = Array.from(new Set(rows.map((r) => r.status)));

  const filtered = rows.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.complaint_code.toLowerCase().includes(q) ||
      (r.ticket_number || "").toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.school || "").toLowerCase().includes(q) ||
      r.property_address.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-primary" />
            Escalated Student Complaints
          </h1>
          <p className="text-muted-foreground mt-1">
            Cases transferred from NUGS for Rent Control to handle.
            {!profile?.isSuperAdmin && (
              <span className="block text-xs mt-1">
                Standard administrators only see escalated student cases. Super Admins have full visibility under Complaints → Student.
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filtered.length} case{filtered.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code, student, school..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {allStatuses.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
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
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/30 border">Escalated</Badge>
                </div>
                <p className="font-semibold text-foreground">{c.studentName || "Unknown student"}</p>
                <p className="text-xs text-muted-foreground">
                  {c.school || "—"} • {c.region}
                  {c.studentPhone ? <> • {c.studentPhone}</> : null}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Filed {format(new Date(c.created_at), "MMM d, yyyy")}</p>
                {c.escalated_at && (
                  <p className="text-xs text-foreground font-medium mt-0.5">
                    Escalated {format(new Date(c.escalated_at), "MMM d, yyyy")}
                  </p>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-3">{c.description}</p>
            <p className="text-xs text-muted-foreground mt-2">📍 {c.property_address}</p>

            {c.escalation_reason && (
              <div className="mt-3 rounded-lg bg-warning/5 border border-warning/30 p-3 text-xs">
                <p className="font-semibold text-foreground mb-0.5">NUGS escalation reason</p>
                <p className="text-muted-foreground">{c.escalation_reason}</p>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <Button asChild size="sm" variant="outline">
                <Link to={`/regulator/complaints?tab=tenant&open=${c.id}`}>
                  <Eye className="h-4 w-4 mr-1.5" />
                  Open in Complaints
                </Link>
              </Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 text-center border border-border text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No escalated student complaints yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default EscalatedStudentComplaints;

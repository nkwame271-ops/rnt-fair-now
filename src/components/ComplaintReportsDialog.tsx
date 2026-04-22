import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  downloadCsv,
  generateComplaintReportPdf,
  generateAssignmentReportPdf,
  type ComplaintReportRow,
  type AssignmentReportRow,
} from "@/lib/generateComplaintReports";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ComplaintReportsDialog = ({ open, onOpenChange }: Props) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchComplaintRows = async (): Promise<ComplaintReportRow[]> => {
    const fromIso = from ? new Date(from).toISOString() : null;
    const toIso = to ? new Date(to + "T23:59:59").toISOString() : null;

    const buildQuery = (table: "complaints" | "landlord_complaints") => {
      let q: any = (supabase.from(table) as any).select("*");
      if (fromIso) q = q.gte("created_at", fromIso);
      if (toIso) q = q.lte("created_at", toIso);
      return q.order("created_at", { ascending: false });
    };

    const [tRes, lRes, offRes] = await Promise.all([
      buildQuery("complaints"),
      buildQuery("landlord_complaints"),
      supabase.from("offices").select("id, name"),
    ]);
    const tComps: any[] = tRes.data || [];
    const lComps: any[] = lRes.data || [];
    const officeMap = new Map((offRes.data || []).map((o: any) => [o.id, o.name]));

    const tenantIds = [...new Set(tComps.map((c: any) => c.tenant_user_id))];
    const landlordIds = [...new Set(lComps.map((c: any) => c.landlord_user_id))];
    const userIds = [...new Set([...tenantIds, ...landlordIds])];
    const { data: profs } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };
    const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

    const allIds = [...tComps.map((c) => c.id), ...lComps.map((c) => c.id)];
    const { data: assigns } = allIds.length
      ? await (supabase.from("complaint_assignments") as any)
          .select("complaint_id, complaint_table, assigned_to")
          .in("complaint_id", allIds)
          .is("unassigned_at", null)
      : { data: [] as any[] };
    const assigneeIds = [...new Set((assigns || []).map((a: any) => a.assigned_to))];
    const { data: aProfs } = assigneeIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", assigneeIds)
      : { data: [] as any[] };
    const assigneeName = new Map((aProfs || []).map((p: any) => [p.user_id, p.full_name]));
    const assignByComplaint = new Map<string, string>();
    (assigns || []).forEach((a: any) => assignByComplaint.set(`${a.complaint_table}:${a.complaint_id}`, assigneeName.get(a.assigned_to) || "Staff"));

    const rows: ComplaintReportRow[] = [];
    const now = Date.now();

    tComps.forEach((c: any) => {
      rows.push({
        code: c.complaint_code,
        ticket: c.ticket_number,
        type: c.complaint_type,
        complainant: nameMap.get(c.tenant_user_id) || "—",
        respondent: c.landlord_name || "—",
        region: c.region,
        office: officeMap.get(c.office_id || "") || "—",
        status: c.status,
        paymentStatus: c.payment_status,
        basketTotal: c.basket_total != null ? Number(c.basket_total) : null,
        assignee: assignByComplaint.get(`complaints:${c.id}`) || "Unassigned",
        filedAt: c.created_at,
        resolvedAt: ["resolved", "closed"].includes(c.status) ? c.updated_at : null,
        daysOpen: Math.ceil((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      });
    });
    lComps.forEach((c: any) => {
      rows.push({
        code: c.complaint_code,
        ticket: c.ticket_number,
        type: c.complaint_type,
        complainant: nameMap.get(c.landlord_user_id) || "—",
        respondent: c.tenant_name || "—",
        region: c.region,
        office: officeMap.get(c.office_id || "") || "—",
        status: c.status,
        paymentStatus: c.payment_status,
        basketTotal: c.basket_total != null ? Number(c.basket_total) : null,
        assignee: assignByComplaint.get(`landlord_complaints:${c.id}`) || "Unassigned",
        filedAt: c.created_at,
        resolvedAt: ["resolved", "closed"].includes(c.status) ? c.updated_at : null,
        daysOpen: Math.ceil((now - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      });
    });

    return rows;
  };

  const fetchAssignmentRows = async (): Promise<AssignmentReportRow[]> => {
    const { data: assigns } = await (supabase.from("complaint_assignments") as any).select("*");
    const all: any[] = assigns || [];

    const [tRes, lRes, staffRes] = await Promise.all([
      supabase.from("complaints").select("id, status, created_at, updated_at"),
      supabase.from("landlord_complaints").select("id, status, created_at, updated_at"),
      (supabase.from("admin_staff") as any).select("user_id, office_name"),
    ]);
    const compMap = new Map<string, any>();
    (tRes.data || []).forEach((c: any) => compMap.set(`complaints:${c.id}`, c));
    (lRes.data || []).forEach((c: any) => compMap.set(`landlord_complaints:${c.id}`, c));
    const staffMap = new Map((staffRes.data || []).map((s: any) => [s.user_id, s.office_name]));

    const staffIds = [...new Set(all.map((a) => a.assigned_to))];
    const { data: profs } = staffIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", staffIds)
      : { data: [] as any[] };
    const nameMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

    const byStaff = new Map<string, any[]>();
    all.forEach((a) => {
      const arr = byStaff.get(a.assigned_to) || [];
      arr.push(a);
      byStaff.set(a.assigned_to, arr);
    });

    const rows: AssignmentReportRow[] = [];
    byStaff.forEach((rowsForStaff, staffId) => {
      const total = rowsForStaff.length;
      const active = rowsForStaff.filter((r) => !r.unassigned_at).length;
      let resolved = 0;
      let resolutionDays: number[] = [];
      const complaintsTouched = new Set<string>();
      rowsForStaff.forEach((r) => {
        complaintsTouched.add(`${r.complaint_table}:${r.complaint_id}`);
        const c = compMap.get(`${r.complaint_table}:${r.complaint_id}`);
        if (c && ["resolved", "closed"].includes(c.status)) {
          resolved += 1;
          const days = (new Date(c.updated_at).getTime() - new Date(r.assigned_at).getTime()) / (1000 * 60 * 60 * 24);
          if (days > 0) resolutionDays.push(days);
        }
      });
      // Reassignments = times this staff handed off (rows with unassigned_at)
      const reassignments = rowsForStaff.filter((r) => !!r.unassigned_at).length;

      rows.push({
        staffName: nameMap.get(staffId) || "Staff",
        office: staffMap.get(staffId) || "—",
        totalAssigned: total,
        active,
        resolved,
        reassignments,
        avgResolutionDays: resolutionDays.length ? resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length : null,
      });
    });

    return rows.sort((a, b) => b.totalAssigned - a.totalAssigned);
  };

  const run = async (kind: "complaint_csv" | "complaint_pdf" | "assign_csv" | "assign_pdf") => {
    setBusy(kind);
    try {
      if (kind.startsWith("complaint")) {
        const rows = await fetchComplaintRows();
        if (rows.length === 0) { toast.warning("No complaints in selected range"); return; }
        if (kind === "complaint_csv") {
          downloadCsv(
            `complaint_report_${new Date().toISOString().slice(0, 10)}.csv`,
            ["Code", "Ticket", "Type", "Complainant", "Respondent", "Region", "Office", "Status", "Payment Status", "Basket Total", "Assignee", "Filed", "Resolved", "Days Open"],
            rows.map((r) => [r.code, r.ticket || "", r.type, r.complainant, r.respondent, r.region, r.office, r.status, r.paymentStatus, r.basketTotal ?? "", r.assignee, r.filedAt, r.resolvedAt || "", r.daysOpen])
          );
        } else {
          generateComplaintReportPdf(rows, { from, to });
        }
      } else {
        const rows = await fetchAssignmentRows();
        if (rows.length === 0) { toast.warning("No staff assignments yet"); return; }
        if (kind === "assign_csv") {
          downloadCsv(
            `staff_assignments_${new Date().toISOString().slice(0, 10)}.csv`,
            ["Staff", "Office", "Total Assigned", "Active", "Resolved", "Reassignments", "Avg Resolution Days"],
            rows.map((r) => [r.staffName, r.office, r.totalAssigned, r.active, r.resolved, r.reassignments, r.avgResolutionDays?.toFixed(1) ?? ""])
          );
        } else {
          generateAssignmentReportPdf(rows);
        }
      }
      toast.success("Report generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate report");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Complaint &amp; Staff Reports</DialogTitle>
          <DialogDescription>Filter by date range, then export complaint or staff-assignment reports.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-primary" /> Complaint Report</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("complaint_csv")}>
                {busy === "complaint_csv" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} CSV
              </Button>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("complaint_pdf")}>
                {busy === "complaint_pdf" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} PDF
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-primary" /> Staff Assignment Report</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("assign_csv")}>
                {busy === "assign_csv" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} CSV
              </Button>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => run("assign_pdf")}>
                {busy === "assign_pdf" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />} PDF
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ComplaintReportsDialog;

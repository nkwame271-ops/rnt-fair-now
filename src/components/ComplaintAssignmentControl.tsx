import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { UserPlus, History, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";

interface StaffOption {
  user_id: string;
  full_name: string;
  office_name: string | null;
  admin_type: string;
}

interface AssignmentRow {
  id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  unassigned_at: string | null;
  reason: string | null;
  _assigneeName?: string;
  _assignedByName?: string;
}

interface Props {
  complaintId: string;
  complaintTable: "complaints" | "landlord_complaints";
  onChanged?: () => void;
}

const ComplaintAssignmentControl = ({ complaintId, complaintTable, onChanged }: Props) => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [history, setHistory] = useState<AssignmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedOffice, setSelectedOffice] = useState<string>("");

  const canAssign = !!profile?.isMainAdmin;
  const current = history.find((h) => !h.unassigned_at) || null;

  const load = async () => {
    setLoading(true);
    const [staffRes, histRes] = await Promise.all([
      (supabase.from("admin_staff") as any).select("user_id, office_name, admin_type"),
      (supabase.from("complaint_assignments") as any)
        .select("id, assigned_to, assigned_by, assigned_at, unassigned_at, reason")
        .eq("complaint_id", complaintId)
        .eq("complaint_table", complaintTable)
        .order("assigned_at", { ascending: false }),
    ]);

    const staffRows: any[] = staffRes.data || [];
    const histRows: AssignmentRow[] = histRes.data || [];

    const userIds = [
      ...new Set([
        ...staffRows.map((s) => s.user_id),
        ...histRows.map((h) => h.assigned_to),
        ...histRows.map((h) => h.assigned_by),
      ]),
    ];
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
      : { data: [] as any[] };
    const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

    setStaff(
      staffRows.map((s) => ({
        user_id: s.user_id,
        full_name: nameMap.get(s.user_id) || "Staff member",
        office_name: s.office_name,
        admin_type: s.admin_type,
      }))
    );
    setHistory(
      histRows.map((h) => ({
        ...h,
        _assigneeName: nameMap.get(h.assigned_to) || "Staff",
        _assignedByName: nameMap.get(h.assigned_by) || "Admin",
      }))
    );
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [complaintId, complaintTable]);

  // Sync the office dropdown with the currently-assigned staff member.
  // IMPORTANT: declared BEFORE any conditional return so hook order stays stable.
  const currentAssignment = history.find((h) => !h.unassigned_at) || null;
  useEffect(() => {
    if (currentAssignment) {
      const assignee = staff.find((s) => s.user_id === currentAssignment.assigned_to);
      if (assignee) setSelectedOffice(assignee.office_name || "HQ / Unassigned Office");
    }
  }, [currentAssignment, staff]);

  const handleAssign = async (newAssigneeId: string) => {
    if (!user || !canAssign) return;
    if (current?.assigned_to === newAssigneeId) return;
    setSaving(true);
    try {
      if (current) {
        const { error: closeErr } = await (supabase.from("complaint_assignments") as any)
          .update({ unassigned_at: new Date().toISOString() })
          .eq("id", current.id);
        if (closeErr) throw closeErr;
      }
      const { error: insErr } = await (supabase.from("complaint_assignments") as any).insert({
        complaint_id: complaintId,
        complaint_table: complaintTable,
        assigned_to: newAssigneeId,
        assigned_by: user.id,
        reason: current ? "Reassignment" : "Initial assignment",
      });
      if (insErr) throw insErr;
      toast.success(current ? "Complaint reassigned" : "Complaint assigned");
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Loading assignment…</div>;
  }

  // Group staff by office (organizational hierarchy: Office → Staff)
  const staffByOffice = staff.reduce((acc, s) => {
    const office = s.office_name || "HQ / Unassigned Office";
    if (!acc[office]) acc[office] = [];
    acc[office].push(s);
    return acc;
  }, {} as Record<string, StaffOption[]>);
  const officeNames = Object.keys(staffByOffice).sort();
  const filteredStaff = selectedOffice ? (staffByOffice[selectedOffice] || []) : [];

  // Sync handled by hook above (declared before early return to keep hook order stable).


  return (
    <div className="bg-background border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <UserPlus className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Assigned to:</span>
        {canAssign ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedOffice} onValueChange={(v) => setSelectedOffice(v)} disabled={saving}>
              <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Select office" /></SelectTrigger>
              <SelectContent>
                {officeNames.map((o) => (
                  <SelectItem key={o} value={o}>{o} ({staffByOffice[o].length})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={current?.assigned_to || ""}
              onValueChange={handleAssign}
              disabled={saving || !selectedOffice}
            >
              <SelectTrigger className="h-8 w-56">
                <SelectValue placeholder={selectedOffice ? "Select staff member" : "Pick an office first"} />
              </SelectTrigger>
              <SelectContent>
                {filteredStaff.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">No staff in this office</div>
                ) : (
                  filteredStaff.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.full_name}{s.admin_type === "main_admin" ? " · Main" : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <span className="text-sm text-foreground">
            {current ? (staff.find((s) => s.user_id === current.assigned_to)?.full_name || current._assigneeName || "Staff") : "Unassigned"}
          </span>
        )}
        {current && (
          <span className="text-[10px] text-muted-foreground">
            since {new Date(current.assigned_at).toLocaleDateString("en-GB")}
          </span>
        )}
      </div>

      {history.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <History className="h-3 w-3" /> Assignment history ({history.length})
              <ChevronDown className="h-3 w-3" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="space-y-1.5 text-xs">
              {history.map((h) => (
                <div key={h.id} className="flex items-start gap-2 bg-muted/40 rounded p-2">
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {h._assigneeName}
                      {!h.unassigned_at && <span className="ml-2 text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded">Active</span>}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(h.assigned_at).toLocaleString("en-GB")}
                      {h.unassigned_at && ` → ${new Date(h.unassigned_at).toLocaleString("en-GB")}`}
                    </div>
                    <div className="text-muted-foreground italic">by {h._assignedByName}{h.reason ? ` — ${h.reason}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
};

export default ComplaintAssignmentControl;

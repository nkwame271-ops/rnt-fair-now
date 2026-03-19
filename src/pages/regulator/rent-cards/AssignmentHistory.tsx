import { useState, useEffect } from "react";
import { History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AdminProfile, GHANA_OFFICES } from "@/hooks/useAdminProfile";

interface Assignment {
  id: string;
  purchase_id: string;
  landlord_user_id: string;
  office_name: string;
  assigned_by: string;
  serial_numbers: string[];
  card_count: number;
  created_at: string;
  assignerName?: string;
  landlordName?: string;
}

interface Props {
  profile: AdminProfile | null;
  refreshKey: number;
}

const AssignmentHistory = ({ profile, refreshKey }: Props) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from("serial_assignments" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!profile?.isMainAdmin && profile?.officeName) {
        query = query.eq("office_name", profile.officeName);
      }

      const { data, error } = await query;
      if (error || !data) { setLoading(false); return; }

      const items = data as any[];
      const userIds = [...new Set([
        ...items.map(a => a.assigned_by),
        ...items.map(a => a.landlord_user_id),
      ])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.full_name]));

      setAssignments(items.map(a => ({
        ...a,
        assignerName: nameMap.get(a.assigned_by) || "Unknown",
        landlordName: nameMap.get(a.landlord_user_id) || "Unknown",
      })));
      setLoading(false);
    };
    fetch();
  }, [profile, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Assignment History
        </h2>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && assignments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No assignments recorded yet.</p>
        )}

        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-sm font-medium text-card-foreground">
                    {a.landlordName} — <span className="font-mono text-xs">{a.purchase_id}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned by {a.assignerName} • {a.office_name} • {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <Badge variant="outline">{a.card_count} card{a.card_count !== 1 ? "s" : ""}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(a.serial_numbers || []).map(s => (
                  <Badge key={s} variant="secondary" className="font-mono text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssignmentHistory;

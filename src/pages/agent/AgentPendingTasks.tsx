import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Building2, Loader2 } from "lucide-react";
import Seo from "@/components/Seo";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type TaskRow = {
  id: string;
  property_id: string;
  task_type: string;
  status: string;
  notes: string | null;
  created_at: string;
};

const labels: Record<string, string> = {
  landlord_request: "Landlord request",
  buy_rent_card: "Buy rent card",
  rent_card_delivery: "Rent card delivery",
  onboard_new_tenant: "Onboard new tenant",
  inquiry: "Inquiry",
  other_request: "Other request",
};

const AgentPendingTasks = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [properties, setProperties] = useState<Record<string, any>>({});

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("management_task_assignments")
      .select("id, property_id, task_type, status, notes, created_at")
      .eq("assigned_staff_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data || []) as TaskRow[];
    const propertyIds = Array.from(new Set(rows.map((t) => t.property_id).filter(Boolean)));
    let map: Record<string, any> = {};
    if (propertyIds.length) {
      const { data: propRows } = await supabase
        .from("properties")
        .select("id, property_name, property_code, address, area, region")
        .in("id", propertyIds);
      map = Object.fromEntries((propRows || []).map((p: any) => [p.id, p]));
    }
    setProperties(map);
    setTasks(rows);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const openTasks = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);

  const updateStatus = async (task: TaskRow, status: "in_progress" | "done") => {
    const { error } = await (supabase as any)
      .from("management_task_assignments")
      .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
      .eq("id", task.id)
      .eq("assigned_staff_id", user?.id);
    if (error) { toast.error(error.message); return; }
    try {
      await (supabase as any).from("agent_action_log").insert({
        agent_user_id: user?.id,
        target_table: "management_task_assignments",
        target_record_id: task.id,
        action: `task_${status}`,
        payload: { task_type: task.task_type, property_id: task.property_id },
      });
    } catch { /* audit is non-blocking */ }
    toast.success(status === "done" ? "Task completed" : "Task started");
    load();
  };

  return (
    <div className="space-y-6">
      <Seo title="Pending Tasks | Agent" description="Inspections, reminders, and follow-ups assigned to you." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> Pending Tasks</h1>
        <p className="text-muted-foreground mt-1">Inspections, maintenance follow-ups, rent reminders, tenant visits, and unresolved complaints.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : openTasks.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No pending tasks" description="Tasks assigned by admins or triggered by landlord requests will appear here." />
      ) : (
        <div className="space-y-3">
          {openTasks.map((task) => {
            const property = properties[task.property_id];
            return (
              <Card key={task.id}>
                <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-semibold">{property?.property_name || property?.property_code || "Assigned property"}</span>
                      <Badge variant="outline" className="capitalize">{task.status.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{labels[task.task_type] || task.task_type}</p>
                    {property && <p className="text-xs text-muted-foreground">{property.address}, {property.area}, {property.region}</p>}
                    {task.notes && <p className="text-sm pt-1">{task.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {task.status === "open" && <Button size="sm" variant="outline" onClick={() => updateStatus(task, "in_progress")}>Start</Button>}
                    <Button size="sm" onClick={() => updateStatus(task, "done")}>Complete</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentPendingTasks;
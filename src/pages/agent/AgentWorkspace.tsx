import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Building2, ClipboardList, ShieldAlert, Users } from "lucide-react";
import Seo from "@/components/Seo";
import LogoLoader from "@/components/LogoLoader";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

/**
 * Agent workspace for a single assigned landlord/tenant.
 * Read-only client overview + approved task actions. Sensitive account
 * settings (payments, payouts, passwords, PINs, contacts) are never exposed.
 */
const AgentWorkspace = () => {
  const { ownerUserId } = useParams<{ ownerUserId: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [owner, setOwner] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenancies, setTenancies] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  const logAction = async (action: string, payload: Record<string, any> = {}) => {
    if (!user || !ownerUserId) return;
    await (supabase as any).from("agent_action_log").insert({
      agent_user_id: user.id,
      target_user_id: ownerUserId,
      action,
      payload,
    });
  };

  const load = async () => {
    if (!user || !ownerUserId) return;
    setLoading(true);
    try {
      const { data: assign } = await (supabase as any)
        .from("agent_assignments")
        .select("*")
        .eq("agent_user_id", user.id)
        .eq("owner_user_id", ownerUserId)
        .eq("active", true)
        .maybeSingle();

      if (!assign) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      setAssignment(assign);

      const [{ data: prof }, { data: props }, { data: tens }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, email").eq("user_id", ownerUserId).maybeSingle(),
        supabase.from("properties").select("id, property_name, address, region, status").eq("landlord_user_id", ownerUserId),
        (supabase as any)
          .from("tenancies")
          .select("id, unit_id, tenant_user_id, placeholder_tenant_name, monthly_rent, status, end_date")
          .eq("landlord_user_id", ownerUserId)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);
      setOwner(prof);
      setProperties(props || []);
      setTenancies(tens || []);

      const propIds = (props || []).map((p: any) => p.id);
      if (propIds.length) {
        const { data: taskRows } = await (supabase as any)
          .from("management_task_assignments")
          .select("*")
          .in("property_id", propIds)
          .order("assigned_at", { ascending: false })
          .limit(100);
        setTasks(taskRows || []);
      } else {
        setTasks([]);
      }

      await logAction("workspace_opened");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [user, ownerUserId]);

  const completeTask = async (taskId: string) => {
    const { error } = await (supabase as any)
      .from("management_task_assignments")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", taskId);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAction("task_completed", { task_id: taskId });
    toast.success("Task marked complete");
    load();
  };

  if (loading) return <LogoLoader message="Opening workspace…" />;

  if (!allowed) {
    return (
      <div className="max-w-2xl mx-auto">
        <EmptyState
          icon={ShieldAlert}
          title="Not authorised"
          description="You do not have an active assignment for this client. Ask an administrator to assign them to you."
        />
        <div className="text-center mt-4">
          <Link to="/agent/properties" className="text-sm text-primary font-semibold hover:underline">
            Back to assignments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Seo
        title="Client Workspace | Agent"
        description="Manage an assigned landlord's properties, tenancies and service tasks."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/agent/properties" className="text-xs text-muted-foreground inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="h-3 w-3" /> Assignments
          </Link>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-1">{owner?.full_name || "Client workspace"}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {owner?.phone || ownerUserId?.slice(0, 8)} · {assignment?.owner_role || "landlord"}
          </p>
          {assignment?.scope_notes && <p className="text-xs mt-1">{assignment.scope_notes}</p>}
        </div>
        <Badge variant="outline">Read-only account · Actions logged</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" /> Properties ({properties.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">No properties registered for this client.</p>
          ) : (
            properties.map((p) => (
              <div key={p.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{p.property_name || p.address}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.region || p.address}</p>
                </div>
                <Badge variant="secondary">{p.status || "—"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" /> Tenancies ({tenancies.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenancies.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tenancies yet.</p>
          ) : (
            tenancies.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.placeholder_tenant_name || "Tenant"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.monthly_rent != null ? `GHS ${Number(t.monthly_rent).toLocaleString()}` : "—"} · ends{" "}
                    {t.end_date ? new Date(t.end_date).toLocaleDateString() : "—"}
                  </p>
                </div>
                <Badge variant="secondary">{t.status || "—"}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-4 w-4" /> Service tasks ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No service requests for this client.</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.task_type}</p>
                  <p className="text-xs text-muted-foreground truncate">{t.notes || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={t.status === "completed" ? "default" : "secondary"}>{t.status}</Badge>
                  {t.status !== "completed" && (
                    <Button size="sm" variant="outline" onClick={() => completeTask(t.id)}>
                      Complete
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentWorkspace;

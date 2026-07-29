import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Sparkles, Users, UserCheck, MapPin, Eye, UserPlus, MessageCircle, Shield, Wallet, ClipboardList, SlidersHorizontal, BarChart3, History, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface ManagedProperty {
  id: string;
  property_name: string | null;
  property_code: string;
  address: string;
  area: string;
  region: string;
  landlord_user_id: string;
  management_enabled: boolean;
  management_assigned_staff_id: string | null;
  management_assigned_office_id: string | null;
  management_enabled_at: string | null;
  landlord_name?: string;
  landlord_phone?: string | null;
  landlord_email?: string | null;
}

interface Staff {
  user_id: string;
  full_name: string | null;
  office_id: string | null;
  office_name: string | null;
  type?: "staff" | "agent";
  status?: string;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  operating_area?: string | null;
  professional_photo_url?: string | null;
  active_assignments?: number;
  pending_tasks?: number;
  completed_tasks?: number;
  audit_count?: number;
}

interface PremiumSubscription {
  id: string;
  property_id: string;
  subscriber_user_id: string;
  subscriber_role: string;
  assigned_agent_user_id: string | null;
  starts_at: string;
  expires_at: string;
  status: string;
  property_name?: string | null;
  property_code?: string | null;
  client_name?: string | null;
}

interface Task {
  id: string;
  property_id: string;
  task_type: string;
  status: string;
  assigned_staff_id: string | null;
  created_at: string;
  source_id: string | null;
  notes: string | null;
}

const taskIcons: Record<string, any> = {
  viewing_request: Eye,
  tenant_onboarding: UserPlus,
  inquiry: MessageCircle,
  compliance: Shield,
  rent_followup: Wallet,
  landlord_request: Sparkles,
  buy_rent_card: Sparkles,
  rent_card_delivery: Sparkles,
  onboard_new_tenant: UserPlus,
  other_request: MessageCircle,
};

const taskLabels: Record<string, string> = {
  viewing_request: "Viewing Requests",
  tenant_onboarding: "Tenant Onboarding",
  inquiry: "Inquiries",
  compliance: "Compliance",
  rent_followup: "Rent Follow-ups",
  landlord_request: "Landlord Requests",
  buy_rent_card: "Buy Rent Card",
  rent_card_delivery: "Card Delivery",
  onboard_new_tenant: "Onboard Tenant",
  other_request: "Other Requests",
};

const RegulatorPropertyManagement = () => {
  const { user } = useAuth();
  const [props, setProps] = useState<ManagedProperty[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [premiumSubs, setPremiumSubs] = useState<PremiumSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [assignFor, setAssignFor] = useState<ManagedProperty | null>(null);
  const [pickStaff, setPickStaff] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: agents }, { data: subs }, { data: t }] = await Promise.all([
      supabase.from("properties")
        .select("id, property_name, property_code, address, area, region, landlord_user_id, management_enabled, management_assigned_staff_id, management_assigned_office_id, management_enabled_at" as any)
        .eq("management_enabled", true as any)
        .order("management_enabled_at", { ascending: false } as any),
      supabase.from("admin_staff").select("user_id, office_id, office_name"),
      (supabase.from("agent_staff") as any)
        .select("user_id, full_name, email, phone, region, operating_area, professional_photo_url, status")
        .in("status", ["active", "suspended", "revoked"]),
      (supabase.from("premium_subscriptions") as any)
        .select("id, property_id, subscriber_user_id, subscriber_role, assigned_agent_user_id, starts_at, expires_at, status")
        .order("created_at", { ascending: false })
        .limit(300),
      supabase.from("management_task_assignments" as any).select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    const propsArr = (p || []) as any as ManagedProperty[];
    // pull landlord names + contact
    const landlordIds = Array.from(new Set(propsArr.map(x => x.landlord_user_id)));
    let nameMap = new Map<string, { full_name?: string; phone?: string; email?: string }>();
    if (landlordIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name, phone, email").in("user_id", landlordIds);
      nameMap = new Map((profs || []).map((x: any) => [x.user_id, x]));
    }
    setProps(propsArr.map(x => {
      const prof = nameMap.get(x.landlord_user_id);
      return { ...x, landlord_name: prof?.full_name || "—", landlord_phone: prof?.phone || null, landlord_email: prof?.email || null };
    }));

    // staff names
    const staffIds = [...(s || []).map((x: any) => x.user_id), ...(agents || []).map((x: any) => x.user_id)];
    let staffNameMap = new Map<string, string>();
    if (staffIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", staffIds);
      staffNameMap = new Map((profs || []).map((x: any) => [x.user_id, x.full_name]));
    }
    const agentIds = ((agents || []) as any[]).map(x => x.user_id);
    const [{ data: assignmentCounts }, { data: taskRows }, { data: auditRows }] = await Promise.all([
      agentIds.length ? (supabase.from("agent_assignments" as any) as any).select("agent_user_id, active").in("agent_user_id", agentIds) : Promise.resolve({ data: [] as any[] }),
      agentIds.length ? (supabase.from("management_task_assignments" as any) as any).select("assigned_staff_id, status").in("assigned_staff_id", agentIds) : Promise.resolve({ data: [] as any[] }),
      agentIds.length ? (supabase.from("agent_action_log" as any) as any).select("agent_user_id").in("agent_user_id", agentIds).limit(1000) : Promise.resolve({ data: [] as any[] }),
    ]);
    const countFor = (rows: any[], key: string, id: string, pred: (row: any) => boolean = () => true) => rows.filter((row) => row[key] === id && pred(row)).length;
    const adminStaff = ((s || []) as any[]).map(x => ({ ...x, type: "staff" as const, full_name: staffNameMap.get(x.user_id) || "Staff" }));
    const agentStaff = ((agents || []) as any[]).map(x => ({
      user_id: x.user_id,
      full_name: x.full_name || staffNameMap.get(x.user_id) || "Agent",
      office_id: x.operating_area || x.region || null,
      office_name: x.operating_area || x.region || "Agent",
      type: "agent" as const,
      status: x.status,
      email: x.email,
      phone: x.phone,
      region: x.region,
      operating_area: x.operating_area,
      professional_photo_url: x.professional_photo_url,
      active_assignments: countFor(assignmentCounts || [], "agent_user_id", x.user_id, (row) => row.active === true),
      pending_tasks: countFor(taskRows || [], "assigned_staff_id", x.user_id, (row) => row.status !== "done"),
      completed_tasks: countFor(taskRows || [], "assigned_staff_id", x.user_id, (row) => row.status === "done"),
      audit_count: countFor(auditRows || [], "agent_user_id", x.user_id),
    }));
    setStaff([...adminStaff, ...agentStaff]);

    const subRows = ((subs || []) as any[]) as PremiumSubscription[];
    const subPropertyIds = Array.from(new Set(subRows.map(x => x.property_id).filter(Boolean)));
    const subClientIds = Array.from(new Set(subRows.map(x => x.subscriber_user_id).filter(Boolean)));
    const [{ data: subProps }, { data: subProfiles }] = await Promise.all([
      subPropertyIds.length ? supabase.from("properties").select("id, property_name, property_code").in("id", subPropertyIds) : Promise.resolve({ data: [] as any[] }),
      subClientIds.length ? supabase.from("profiles").select("user_id, full_name").in("user_id", subClientIds) : Promise.resolve({ data: [] as any[] }),
    ]);
    const subPropMap = new Map((subProps || []).map((x: any) => [x.id, x]));
    const subProfileMap = new Map((subProfiles || []).map((x: any) => [x.user_id, x.full_name]));
    setPremiumSubs(subRows.map((x: any) => ({
      ...x,
      property_name: subPropMap.get(x.property_id)?.property_name,
      property_code: subPropMap.get(x.property_id)?.property_code,
      client_name: subProfileMap.get(x.subscriber_user_id) || x.subscriber_role,
    })));
    setTasks((t || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const regions = useMemo(() => Array.from(new Set(props.map(p => p.region))).filter(Boolean), [props]);
  const staffById = useMemo(() => new Map(staff.map(s => [s.user_id, s])), [staff]);
  const propById = useMemo(() => new Map(props.map(p => [p.id, p])), [props]);
  const agents = useMemo(() => staff.filter(s => s.type === "agent"), [staff]);

  const filteredProps = props.filter(p => {
    if (search && !(`${p.property_name || ""} ${p.property_code} ${p.address} ${p.area}`).toLowerCase().includes(search.toLowerCase())) return false;
    if (regionFilter !== "all" && p.region !== regionFilter) return false;
    if (staffFilter === "unassigned" && p.management_assigned_staff_id) return false;
    if (staffFilter !== "all" && staffFilter !== "unassigned" && p.management_assigned_staff_id !== staffFilter) return false;
    return true;
  });

  const tasksByType = useMemo(() => {
    const grouped: Record<string, Task[]> = { viewing_request: [], tenant_onboarding: [], inquiry: [], compliance: [], rent_followup: [], landlord_request: [], buy_rent_card: [], rent_card_delivery: [], onboard_new_tenant: [], other_request: [] };
    tasks.forEach(t => { if (grouped[t.task_type]) grouped[t.task_type].push(t); });
    return grouped;
  }, [tasks]);

  const assignProperty = async () => {
    if (!assignFor || !pickStaff) return;
    const s = staffById.get(pickStaff);
    const { error } = await supabase.rpc("assign_property_to_staff" as any, {
      p_property_id: assignFor.id,
      p_staff_user_id: pickStaff,
      p_office_id: s?.office_id || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Property assigned");
    setAssignFor(null); setPickStaff("");
    fetchAll();
  };

  const assignTask = async (taskId: string, staffId: string) => {
    const { error } = await supabase.from("management_task_assignments" as any).update({
      assigned_staff_id: staffId,
      assigned_at: new Date().toISOString(),
      status: "in_progress",
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    toast.success("Task assigned");
    fetchAll();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const { error } = await supabase.from("management_task_assignments" as any).update({
      status,
      completed_at: status === "done" ? new Date().toISOString() : null,
    }).eq("id", taskId);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };

  const assignPremiumAgent = async (subscriptionId: string, agentId: string) => {
    const { error } = await supabase.rpc("assign_premium_property_to_agent" as any, {
      p_subscription_id: subscriptionId,
      p_agent_user_id: agentId === "unassigned" ? null : agentId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(agentId === "unassigned" ? "Agent removed" : "Premium agent assigned");
    fetchAll();
  };

  const updatePremiumStatus = async (sub: PremiumSubscription, status: "active" | "cancelled" | "suspended") => {
    const label = status === "active" ? "approve/reactivate" : status;
    const reason = window.prompt(`Reason to ${label} this Premium Service assignment:`) || "Updated by admin";
    const { error } = await (supabase.from("premium_subscriptions") as any)
      .update({ status, notes: reason })
      .eq("id", sub.id);
    if (error) { toast.error(error.message); return; }
    if (status !== "active" && sub.assigned_agent_user_id) {
      await (supabase.from("agent_assignments" as any) as any)
        .update({ active: false, scope_notes: reason })
        .eq("agent_user_id", sub.assigned_agent_user_id)
        .eq("owner_user_id", sub.subscriber_user_id);
    }
    toast.success(`Premium Service ${status}`);
    fetchAll();
  };

  const revokePremiumAgent = async (sub: PremiumSubscription) => {
    if (!sub.assigned_agent_user_id) { toast.error("No assigned agent to revoke"); return; }
    const reason = window.prompt("Reason to revoke this agent assignment:") || "Agent assignment revoked by admin";
    const { error } = await (supabase.from("premium_subscriptions") as any)
      .update({ assigned_agent_user_id: null, notes: reason })
      .eq("id", sub.id);
    if (error) { toast.error(error.message); return; }
    await (supabase.from("agent_assignments" as any) as any)
      .update({ active: false, scope_notes: reason })
      .eq("agent_user_id", sub.assigned_agent_user_id)
      .eq("owner_user_id", sub.subscriber_user_id);
    toast.success("Agent assignment revoked");
    fetchAll();
  };

  const configurePremiumPermissions = async (sub: PremiumSubscription) => {
    const scope = window.prompt("Configure this agent's permitted scope for the property:", "Property visits, tenant follow-up, rent card support, complaint follow-up");
    if (!scope?.trim()) return;
    const { error } = await (supabase.from("premium_subscriptions") as any)
      .update({ notes: `Agent permissions: ${scope.trim()}` })
      .eq("id", sub.id);
    if (error) { toast.error(error.message); return; }
    if (sub.assigned_agent_user_id) {
      await (supabase.from("agent_assignments" as any) as any)
        .update({ scope_notes: scope.trim() })
        .eq("agent_user_id", sub.assigned_agent_user_id)
        .eq("owner_user_id", sub.subscriber_user_id)
        .eq("active", true);
    }
    toast.success("Permissions configured");
    fetchAll();
  };

  const setAgentStatus = async (agentId: string, status: "active" | "suspended" | "revoked") => {
    const reason = window.prompt(`Reason for ${status}:`) || "Updated from Property Management";
    const { error } = await supabase.rpc("regulator_set_agent_status" as any, {
      p_agent_user_id: agentId,
      p_status: status,
      p_reason: reason,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Agent ${status}`);
    fetchAll();
  };

  const kpis = {
    managed: props.length,
    unassigned: props.filter(p => !p.management_assigned_staff_id).length,
    openTasks: tasks.filter(t => t.status === "open" || t.status === "in_progress").length,
    viewings: tasksByType.viewing_request.filter(t => t.status !== "done").length,
    onboarding: tasksByType.tenant_onboarding.filter(t => t.status !== "done").length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600" /> Property Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage landlord-delegated properties, assign staff, and run task queues.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Managed properties</div><div className="text-2xl font-bold">{kpis.managed}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Unassigned</div><div className="text-2xl font-bold text-amber-600">{kpis.unassigned}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Open tasks</div><div className="text-2xl font-bold">{kpis.openTasks}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Open viewings</div><div className="text-2xl font-bold">{kpis.viewings}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pending onboarding</div><div className="text-2xl font-bold">{kpis.onboarding}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="properties" className="w-full">
        <TabsList>
          <TabsTrigger value="properties"><Building2 className="h-4 w-4 mr-1" /> Managed Properties</TabsTrigger>
          <TabsTrigger value="premium"><Sparkles className="h-4 w-4 mr-1" /> Premium Assignments</TabsTrigger>
          <TabsTrigger value="agents"><UserCheck className="h-4 w-4 mr-1" /> Agents</TabsTrigger>
          <TabsTrigger value="tasks"><Users className="h-4 w-4 mr-1" /> Task Queues</TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input placeholder="Search property…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Region" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All regions</SelectItem>
                {regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={staffFilter} onValueChange={setStaffFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Assigned staff" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name} {s.office_name ? `• ${s.office_name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && filteredProps.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No managed properties match.</CardContent></Card>}
          {filteredProps.map(p => {
            const assigned = p.management_assigned_staff_id ? staffById.get(p.management_assigned_staff_id) : null;
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{p.property_name || p.property_code}</span>
                      <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Managed</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {p.address}, {p.area}, {p.region}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Landlord: <strong>{p.landlord_name}</strong>
                      {p.landlord_phone && (
                        <>
                          {" · "}
                          <a href={`tel:${p.landlord_phone}`} className="underline">{p.landlord_phone}</a>
                          {" · "}
                          <a href={`https://wa.me/${(p.landlord_phone || "").replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener" className="text-primary underline">WhatsApp</a>
                        </>
                      )}
                      {p.landlord_email && <> {" · "}<a href={`mailto:${p.landlord_email}`} className="underline">{p.landlord_email}</a></>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> {assigned ? <>Assigned to <strong>{assigned.full_name}</strong> {assigned.office_name && <span>• {assigned.office_name}</span>}</> : <span className="text-amber-600">Unassigned</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setAssignFor(p); setPickStaff(p.management_assigned_staff_id || ""); }}>
                    {assigned ? "Reassign" : "Assign staff"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="premium" className="space-y-3">
          {premiumSubs.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No Premium Service subscriptions found.</CardContent></Card>}
          {premiumSubs.map(sub => {
            const assigned = sub.assigned_agent_user_id ? staffById.get(sub.assigned_agent_user_id) : null;
            return (
              <Card key={sub.id}>
                <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium">{sub.property_name || sub.property_code || "Premium property"}</div>
                    <div className="text-xs text-muted-foreground">Client: {sub.client_name} · {sub.subscriber_role}</div>
                    <div className="flex gap-1 flex-wrap">
                      <Badge variant="outline" className="capitalize">{sub.status}</Badge>
                      {assigned && <Badge variant="outline">Agent: {assigned.full_name}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Select value={sub.assigned_agent_user_id || "unassigned"} onValueChange={(v) => assignPremiumAgent(sub.id, v)}>
                      <SelectTrigger className="w-64"><SelectValue placeholder="Assign agent" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {agents.filter(a => a.status === "active").map(a => <SelectItem key={a.user_id} value={a.user_id}>{a.full_name} {a.office_name ? `• ${a.office_name}` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {sub.status !== "active" && <Button size="sm" variant="outline" onClick={() => updatePremiumStatus(sub, "active")}><CheckCircle2 className="h-3 w-3 mr-1" /> Approve</Button>}
                    {sub.status === "active" && <Button size="sm" variant="outline" onClick={() => updatePremiumStatus(sub, "suspended")}><XCircle className="h-3 w-3 mr-1" /> Suspend</Button>}
                    <Button size="sm" variant="outline" onClick={() => configurePremiumPermissions(sub)}><SlidersHorizontal className="h-3 w-3 mr-1" /> Permissions</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.info(`${sub.property_name || sub.property_code}: ${assigned?.full_name || "No agent"} · Status ${sub.status}`)}><BarChart3 className="h-3 w-3 mr-1" /> Reports</Button>
                    <Button size="sm" variant="outline" onClick={() => toast.info(`Latest activity is visible in the Agent Profiles tab audit counters.`)}><History className="h-3 w-3 mr-1" /> Activity Log</Button>
                    {sub.assigned_agent_user_id && <Button size="sm" variant="outline" onClick={() => revokePremiumAgent(sub)}>Revoke</Button>}
                    {sub.status !== "cancelled" && <Button size="sm" variant="destructive" onClick={() => updatePremiumStatus(sub, "cancelled")}>Reject</Button>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="agents" className="space-y-3">
          {agents.length === 0 && <Card><CardContent className="p-6 text-sm text-muted-foreground">No registered agents found.</CardContent></Card>}
          {agents.map(agent => (
            <Card key={agent.user_id}>
              <CardContent className="p-4 flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {agent.professional_photo_url ? <img src={agent.professional_photo_url} alt={`${agent.full_name || "Agent"} profile`} className="h-full w-full object-cover" loading="lazy" /> : <UserCheck className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium">{agent.full_name}</div>
                      <Badge variant="outline" className="capitalize">{agent.status || "active"}</Badge>
                      <Badge variant="outline" className="font-mono">ID {agent.user_id.slice(0, 8).toUpperCase()}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <div>Contact: {agent.phone || "—"}</div>
                      <div>Email: {agent.email || "—"}</div>
                      <div>Area: {agent.operating_area || agent.region || "—"}</div>
                      <div>Ratings: Not rated</div>
                      <div>Assigned properties: {agent.active_assignments || 0}</div>
                      <div>Pending tasks: {agent.pending_tasks || 0}</div>
                      <div>Completed tasks: {agent.completed_tasks || 0}</div>
                      <div>Audit history: {agent.audit_count || 0} actions</div>
                      <div>Complaints: {tasks.filter(t => t.assigned_staff_id === agent.user_id && t.task_type === "compliance" && t.status !== "done").length} open</div>
                      <div className="sm:col-span-2">Permissions: Premium property support, assigned task handling, landlord/tenant follow-up only</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {agent.status !== "active" && <Button size="sm" variant="outline" onClick={() => setAgentStatus(agent.user_id, "active")}>Reactivate</Button>}
                  {agent.status === "active" && <Button size="sm" variant="outline" onClick={() => setAgentStatus(agent.user_id, "suspended")}>Suspend</Button>}
                  {agent.status !== "revoked" && <Button size="sm" variant="destructive" onClick={() => setAgentStatus(agent.user_id, "revoked")}>Revoke</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="tasks">
          <Tabs defaultValue="viewing_request" className="w-full">
            <TabsList className="flex-wrap h-auto">
              {Object.keys(taskLabels).map(k => {
                const Icon = taskIcons[k];
                const open = tasksByType[k].filter(t => t.status !== "done").length;
                return (
                  <TabsTrigger key={k} value={k}>
                    <Icon className="h-4 w-4 mr-1" /> {taskLabels[k]}
                    {open > 0 && <Badge className="ml-2 bg-amber-500 hover:bg-amber-500 text-white text-[10px]">{open}</Badge>}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {Object.keys(taskLabels).map(k => (
              <TabsContent key={k} value={k} className="space-y-2">
                {tasksByType[k].length === 0 && (
                  <Card><CardContent className="p-6 text-sm text-muted-foreground">No {taskLabels[k].toLowerCase()} yet.</CardContent></Card>
                )}
                {tasksByType[k].map(t => {
                  const prop = propById.get(t.property_id);
                  const assignee = t.assigned_staff_id ? staffById.get(t.assigned_staff_id) : null;
                  return (
                    <Card key={t.id}>
                      <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{prop?.property_name || prop?.property_code || "Property"}</div>
                          <div className="text-xs text-muted-foreground">{prop?.address}, {prop?.area}, {prop?.region}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Status: <Badge variant="outline" className="text-[10px] capitalize">{t.status.replace("_", " ")}</Badge>
                            {assignee && <span className="ml-2">Assigned: <strong>{assignee.full_name}</strong></span>}
                          </div>
                          {t.notes && <div className="text-xs mt-1">{t.notes}</div>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Select value={t.assigned_staff_id || ""} onValueChange={v => assignTask(t.id, v)}>
                            <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Assign staff" /></SelectTrigger>
                            <SelectContent>
                              {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {t.status !== "done" && (
                            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => updateTaskStatus(t.id, "done")}>Mark done</Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>
        </TabsContent>
      </Tabs>

      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign property to staff</DialogTitle></DialogHeader>
          {assignFor && (
            <div className="space-y-3">
              <div className="text-sm">
                <strong>{assignFor.property_name || assignFor.property_code}</strong>
                <div className="text-xs text-muted-foreground">{assignFor.address}, {assignFor.area}, {assignFor.region}</div>
              </div>
              <Select value={pickStaff} onValueChange={setPickStaff}>
                <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
                <SelectContent>
                  {staff.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name} {s.office_name ? `• ${s.office_name}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAssignFor(null)}>Cancel</Button>
                <Button onClick={assignProperty} disabled={!pickStaff}>Assign</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegulatorPropertyManagement;

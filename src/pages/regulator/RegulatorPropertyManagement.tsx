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
import { Building2, Sparkles, Users, UserCheck, MapPin, Eye, UserPlus, MessageCircle, Shield, Wallet } from "lucide-react";
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
};

const taskLabels: Record<string, string> = {
  viewing_request: "Viewing Requests",
  tenant_onboarding: "Tenant Onboarding",
  inquiry: "Inquiries",
  compliance: "Compliance",
  rent_followup: "Rent Follow-ups",
};

const RegulatorPropertyManagement = () => {
  const { user } = useAuth();
  const [props, setProps] = useState<ManagedProperty[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [staffFilter, setStaffFilter] = useState<string>("all");
  const [assignFor, setAssignFor] = useState<ManagedProperty | null>(null);
  const [pickStaff, setPickStaff] = useState<string>("");

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: p }, { data: s }, { data: t }] = await Promise.all([
      supabase.from("properties")
        .select("id, property_name, property_code, address, area, region, landlord_user_id, management_enabled, management_assigned_staff_id, management_assigned_office_id, management_enabled_at" as any)
        .eq("management_enabled", true as any)
        .order("management_enabled_at", { ascending: false } as any),
      supabase.from("admin_staff").select("user_id, office_id, office_name"),
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
    const staffIds = (s || []).map((x: any) => x.user_id);
    let staffNameMap = new Map<string, string>();
    if (staffIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", staffIds);
      staffNameMap = new Map((profs || []).map((x: any) => [x.user_id, x.full_name]));
    }
    setStaff(((s || []) as any[]).map(x => ({ ...x, full_name: staffNameMap.get(x.user_id) || "Staff" })));
    setTasks((t || []) as any);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const regions = useMemo(() => Array.from(new Set(props.map(p => p.region))).filter(Boolean), [props]);
  const staffById = useMemo(() => new Map(staff.map(s => [s.user_id, s])), [staff]);
  const propById = useMemo(() => new Map(props.map(p => [p.id, p])), [props]);

  const filteredProps = props.filter(p => {
    if (search && !(`${p.property_name || ""} ${p.property_code} ${p.address} ${p.area}`).toLowerCase().includes(search.toLowerCase())) return false;
    if (regionFilter !== "all" && p.region !== regionFilter) return false;
    if (staffFilter === "unassigned" && p.management_assigned_staff_id) return false;
    if (staffFilter !== "all" && staffFilter !== "unassigned" && p.management_assigned_staff_id !== staffFilter) return false;
    return true;
  });

  const tasksByType = useMemo(() => {
    const grouped: Record<string, Task[]> = { viewing_request: [], tenant_onboarding: [], inquiry: [], compliance: [], rent_followup: [] };
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
                    <div className="text-xs text-muted-foreground mt-1">Landlord: <strong>{p.landlord_name}</strong></div>
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

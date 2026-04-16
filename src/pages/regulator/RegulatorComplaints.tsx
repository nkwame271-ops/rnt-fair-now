import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Download, Search, ChevronDown, ChevronUp, Clock, User, MapPin, FileText, CalendarDays, Plus, X, Trash2, FileDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import ScheduleComplainantDialog from "@/components/ScheduleComplainantDialog";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { generateProfilePdf } from "@/lib/generateProfilePdf";

interface SchedulingTarget {
  id: string;
  type: "tenant" | "landlord";
  userId: string;
  name: string;
  phone?: string;
  complaintCode?: string;
  officeName?: string;
}

const allStatuses = ["submitted", "under_review", "in_progress", "schedule_complainant", "resolved", "closed"];

const RegulatorComplaints = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [schedulingComplaint, setSchedulingComplaint] = useState<SchedulingTarget | null>(null);
  const [scheduleMap, setScheduleMap] = useState<Record<string, any>>({});
  const [deletingId, setDeletingId] = useState<{ id: string; type: "tenant" | "landlord" } | null>(null);
  const [officeMap, setOfficeMap] = useState<Record<string, string>>({});
  const [downloadingProfile, setDownloadingProfile] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("offices").select("id, name");
      if (data) {
        const m: Record<string, string> = {};
        data.forEach((o: any) => { m[o.id] = o.name; });
        setOfficeMap(m);
      }
    })();
  }, []);

  const downloadComplainantProfile = async (
    role: "tenant" | "landlord",
    userId: string,
    name: string,
  ) => {
    setDownloadingProfile(userId);
    try {
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("user_id", userId).maybeSingle();

      const roleTable = role === "tenant" ? "tenants" : "landlords";
      const roleIdCol = role === "tenant" ? "tenant_id" : "landlord_id";
      const { data: roleRow } = await (supabase
        .from(roleTable).select("*") as any).eq("user_id", userId).maybeSingle();

      const { data: kyc } = await supabase
        .from("kyc_verifications")
        .select("status, ghana_card_number, ai_match_score, ai_match_result, reviewer_notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const tenancyFilter = role === "tenant" ? "tenant_user_id" : "landlord_user_id";
      const { data: tenancies } = await (supabase
        .from("tenancies")
        .select("registration_code, status, agreed_rent, start_date, end_date, tenant_user_id, landlord_user_id, unit_id") as any)
        .eq(tenancyFilter, userId);

      const enrichedTenancies: any[] = [];
      for (const t of tenancies || []) {
        const { data: unit } = t.unit_id
          ? await supabase.from("units").select("unit_name, property_id").eq("id", t.unit_id).maybeSingle()
          : { data: null };
        const { data: prop } = unit?.property_id
          ? await supabase.from("properties").select("property_name, region").eq("id", unit.property_id).maybeSingle()
          : { data: null };
        const { data: lProf } = await supabase.from("profiles").select("full_name, phone").eq("user_id", t.landlord_user_id).maybeSingle();
        const { data: tProf } = await supabase.from("profiles").select("full_name, phone").eq("user_id", t.tenant_user_id).maybeSingle();
        enrichedTenancies.push({
          ...t,
          _propertyName: prop?.property_name,
          _unitName: unit?.unit_name,
          _region: prop?.region,
          _landlordName: lProf?.full_name,
          _landlordPhone: lProf?.phone,
          _tenantName: tProf?.full_name,
          _tenantPhone: tProf?.phone,
        });
      }

      const cTable = role === "tenant" ? "complaints" : "landlord_complaints";
      const cFilter = role === "tenant" ? "tenant_user_id" : "landlord_user_id";
      const { data: comps } = await (supabase
        .from(cTable)
        .select("complaint_code, complaint_type, status, created_at") as any)
        .eq(cFilter, userId);

      let properties: any[] = [];
      if (role === "landlord") {
        const { data: props } = await supabase
          .from("properties")
          .select("id, property_code, property_name, address, region, gps_location, ghana_post_gps, property_condition, room_count, bathroom_count")
          .eq("landlord_user_id", userId);
        for (const p of props || []) {
          const { data: units } = await supabase
            .from("units")
            .select("unit_name, monthly_rent, status, unit_type, has_toilet_bathroom, has_kitchen, water_available, electricity_available, has_borehole, has_polytank, amenities")
            .eq("property_id", p.id);
          properties.push({ ...p, units: units || [] });
        }
      }

      generateProfilePdf({
        role,
        roleId: roleRow?.[roleIdCol] || "—",
        status: roleRow?.status || "—",
        registrationDate: roleRow?.registration_date || null,
        expiryDate: roleRow?.expiry_date || null,
        registrationFeePaid: !!roleRow?.registration_fee_paid,
        profile: prof ? {
          full_name: prof.full_name,
          phone: prof.phone,
          email: prof.email,
          nationality: prof.nationality,
          is_citizen: prof.is_citizen,
          ghana_card_no: prof.ghana_card_no,
          residence_permit_no: prof.residence_permit_no,
          occupation: prof.occupation,
          work_address: prof.work_address,
          emergency_contact_name: prof.emergency_contact_name,
          emergency_contact_phone: prof.emergency_contact_phone,
          delivery_address: prof.delivery_address,
          delivery_region: prof.delivery_region,
        } : undefined,
        kyc: kyc || null,
        tenancies: enrichedTenancies,
        complaints: comps || [],
        properties: role === "landlord" ? properties : undefined,
      });
      toast.success(`${name}'s profile downloaded`);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate profile PDF");
    } finally {
      setDownloadingProfile(null);
    }
  };

  const handleDeleteComplaint = async (password: string, reason: string) => {
    if (!deletingId) return;
    const action = deletingId.type === "tenant" ? "delete_complaint" : "delete_landlord_complaint";
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action, target_id: deletingId.id, reason, password },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    if (deletingId.type === "tenant") {
      setComplaints(prev => prev.filter(c => c.id !== deletingId.id));
    } else {
      setLandlordComplaints(prev => prev.filter(c => c.id !== deletingId.id));
    }
    toast.success("Complaint permanently deleted");
  };

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const tenantIds = [...new Set(data.map((c: any) => c.tenant_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email, ghana_card_no, nationality, occupation")
        .in("user_id", tenantIds);

      // Also fetch tenant registration info
      const { data: tenantRecords } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, status, registration_date")
        .in("user_id", tenantIds);

      // Fetch tenancies for these tenants to show their current residence
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("tenant_user_id, landlord_user_id, status, agreed_rent, start_date, end_date, unit_id, registration_code")
        .in("tenant_user_id", tenantIds)
        .eq("status", "active");

      // Fetch unit/property details for active tenancies
      const unitIds = (tenancies || []).map(t => t.unit_id);
      const { data: units } = unitIds.length > 0
        ? await supabase.from("units").select("id, unit_name, property_id").in("id", unitIds)
        : { data: [] };

      const propertyIds = (units || []).map(u => u.property_id);
      const { data: properties } = propertyIds.length > 0
        ? await supabase.from("properties").select("id, property_name, address, region").in("id", propertyIds)
        : { data: [] };

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const tenantMap = new Map((tenantRecords || []).map((t: any) => [t.user_id, t]));
      const unitMap = new Map((units || []).map((u: any) => [u.id, u]));
      const propMap = new Map((properties || []).map((p: any) => [p.id, p]));

      const tenancyByTenant = new Map<string, any>();
      (tenancies || []).forEach(t => {
        const unit = unitMap.get(t.unit_id);
        const prop = unit ? propMap.get(unit.property_id) : null;
        tenancyByTenant.set(t.tenant_user_id, { ...t, _unit: unit, _property: prop });
      });

      setComplaints(data.map((c: any) => ({
        ...c,
        _tenantProfile: profileMap.get(c.tenant_user_id),
        _tenantRecord: tenantMap.get(c.tenant_user_id),
        _activeTenancy: tenancyByTenant.get(c.tenant_user_id),
      })));
    } else {
      setComplaints([]);
    }
    setLoading(false);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from("complaint_schedules")
      .select("*")
      .in("status", ["pending_selection", "confirmed"])
      .order("created_at", { ascending: false });
    if (data) {
      const map: Record<string, any> = {};
      data.forEach((s: any) => { map[s.complaint_id] = s; });
      setScheduleMap(map);
    }
  };

  useEffect(() => { fetchComplaints(); fetchSchedules(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("complaints").update({ status: newStatus }).eq("id", id);
    toast.success(`Status updated to ${newStatus}`);
    fetchComplaints();
  };

  const filtered = complaints.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.complaint_code?.toLowerCase().includes(s) || c.landlord_name?.toLowerCase().includes(s) || c.complaint_type?.toLowerCase().includes(s) || c._tenantProfile?.full_name?.toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const headers = ["Code", "Tenant", "Phone", "Type", "Landlord", "Address", "Region", "Status", "Filed", "Description"];
    const rows = filtered.map((c: any) => [
      c.complaint_code, c._tenantProfile?.full_name || "", c._tenantProfile?.phone || "",
      c.complaint_type, c.landlord_name, c.property_address, c.region, c.status,
      new Date(c.created_at).toLocaleDateString(), `"${(c.description || "").replace(/"/g, '""')}"`,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "complaints_export.csv"; a.click();
  };

  const [activeTab, setActiveTab] = useState<"tenant" | "landlord">("tenant");
  const [landlordComplaints, setLandlordComplaints] = useState<any[]>([]);

  const fetchLandlordComplaints = async () => {
    const { data } = await supabase
      .from("landlord_complaints")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const landlordIds = [...new Set(data.map((c: any) => c.landlord_user_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone, email").in("user_id", landlordIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      setLandlordComplaints(data.map((c: any) => ({ ...c, _landlordProfile: profileMap.get(c.landlord_user_id) })));
    } else {
      setLandlordComplaints([]);
    }
  };

  useEffect(() => { fetchLandlordComplaints(); }, []);

  const updateLandlordComplaintStatus = async (id: string, newStatus: string) => {
    await supabase.from("landlord_complaints").update({ status: newStatus } as any).eq("id", id);
    toast.success(`Status updated to ${newStatus}`);
    fetchLandlordComplaints();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const statusColors: Record<string, string> = {
    submitted: "bg-info/10 text-info",
    under_review: "bg-warning/10 text-warning",
    in_progress: "bg-primary/10 text-primary",
    schedule_complainant: "bg-accent/10 text-accent-foreground",
    resolved: "bg-success/10 text-success",
    closed: "bg-muted text-muted-foreground",
  };

  const statusCounts = complaints.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-warning" /> Complaints Management
          </h1>
          <p className="text-muted-foreground mt-1">{filtered.length} tenant complaints • {landlordComplaints.length} landlord complaints</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-muted rounded-lg p-0.5 w-fit">
        <button onClick={() => setActiveTab("tenant")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "tenant" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Tenant Complaints ({complaints.length})
        </button>
        <button onClick={() => setActiveTab("landlord")} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === "landlord" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          Landlord Complaints ({landlordComplaints.length})
        </button>
      </div>

      {activeTab === "tenant" && (
        <>
          {/* Status summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {allStatuses.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={`rounded-xl p-3 border text-left transition-all ${
                  statusFilter === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <div className="text-2xl font-bold text-foreground">{statusCounts[s] || 0}</div>
                <div className="text-xs text-muted-foreground capitalize">{s.replace(/_/g, " ")}</div>
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by code, name, landlord, type..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {allStatuses.map(s => (
                  <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No complaints found</div>
            ) : filtered.map((c: any) => {
              const isExpanded = expandedId === c.id;
              return (
                <div key={c.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
                  {/* Summary row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : c.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-6 gap-2 items-center">
                      <div>
                        <span className="font-mono text-sm font-bold text-primary">{c.complaint_code}</span>
                        <div className="text-xs text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="font-medium text-sm text-foreground">{c._tenantProfile?.full_name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{c._tenantProfile?.phone}</div>
                      </div>
                      <div className="text-sm text-foreground">{c.complaint_type}</div>
                      <div className="text-sm text-foreground">{c.landlord_name}</div>
                      <div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[c.status] || ""}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">{c.region}</div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-border p-5 bg-muted/10 space-y-5">
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" /> Complaint Details
                          </h3>
                          <div className="text-sm space-y-2">
                            <div><span className="text-muted-foreground">Type:</span> <span className="font-medium text-foreground">{c.complaint_type}</span></div>
                            <div><span className="text-muted-foreground">Against:</span> <span className="font-medium text-foreground">{c.landlord_name}</span></div>
                            <div><span className="text-muted-foreground">Property:</span> <span className="text-foreground">{c.property_address}</span></div>
                            <div><span className="text-muted-foreground">Region:</span> <span className="text-foreground">{c.region}</span></div>
                            <div><span className="text-muted-foreground">Filed:</span> <span className="text-foreground">{new Date(c.created_at).toLocaleString()}</span></div>
                          </div>
                          <div className="pt-2">
                            <div className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTION</div>
                             <div className="text-sm text-foreground bg-background rounded-lg p-3 border border-border whitespace-pre-wrap">{c.description}</div>
                          </div>
                          {c.audio_url && (
                            <div className="pt-2">
                              <div className="text-xs font-semibold text-muted-foreground mb-1">AUDIO RECORDING</div>
                              <audio controls className="w-full h-10" src={c.audio_url} preload="metadata">
                                Your browser does not support audio playback.
                              </audio>
                            </div>
                          )}
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <User className="h-4 w-4 text-primary" /> Complainant (Tenant)
                          </h3>
                          <div className="text-sm space-y-2">
                            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium text-foreground">{c._tenantProfile?.full_name || "—"}</span></div>
                            <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{c._tenantProfile?.phone || "—"}</span></div>
                            <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{c._tenantProfile?.email || "—"}</span></div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" /> Current Residence
                          </h3>
                          {c._activeTenancy ? (
                            <div className="text-sm space-y-2">
                              <div><span className="text-muted-foreground">Property:</span> <span className="text-foreground">{c._activeTenancy._property?.property_name || "—"}</span></div>
                              <div><span className="text-muted-foreground">Unit:</span> <span className="text-foreground">{c._activeTenancy._unit?.unit_name || "—"}</span></div>
                              <div><span className="text-muted-foreground">Rent:</span> <span className="font-medium text-foreground">GH₵ {c._activeTenancy.agreed_rent?.toLocaleString()}</span></div>
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground italic">No active tenancy on record</div>
                          )}
                        </div>
                      </div>
                      {/* Appointment Schedule Info */}
                      {scheduleMap[c.id] && (
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-1">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" /> Appointment
                          </h3>
                          {scheduleMap[c.id].status === "confirmed" && scheduleMap[c.id].selected_slot ? (
                            <div className="text-sm">
                              <span className="text-muted-foreground">Date:</span>{" "}
                              <span className="font-medium text-foreground">
                                {new Date(scheduleMap[c.id].selected_slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              <span className="text-muted-foreground ml-3">Time:</span>{" "}
                              <span className="font-medium text-foreground">
                                {scheduleMap[c.id].selected_slot.time_start} — {scheduleMap[c.id].selected_slot.time_end}
                              </span>
                              <span className="ml-2 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Confirmed</span>
                            </div>
                          ) : (
                            <div className="text-sm">
                              <span className="text-warning font-medium">Awaiting complainant selection</span>
                              <span className="text-muted-foreground ml-2">
                                ({(scheduleMap[c.id].available_slots || []).length} slot(s) offered)
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-3 pt-3 border-t border-border">
                        <span className="text-sm font-medium text-muted-foreground">Update status:</span>
                        <Select value={c.status} onValueChange={(v) => {
                          if (v === "schedule_complainant") {
                            setSchedulingComplaint({ id: c.id, type: "tenant", userId: c.tenant_user_id, name: c._tenantProfile?.full_name || "Unknown", phone: c._tenantProfile?.phone, complaintCode: c.complaint_code, officeName: officeMap[c.office_id] });
                          } else {
                            updateStatus(c.id, v);
                          }
                        }}>
                          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {allStatuses.map((s) => (
                              <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                          <Clock className="h-3 w-3" />
                          {Math.ceil((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))} days since filed
                        </div>
                        {profile?.isMainAdmin && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive ml-2" onClick={() => setDeletingId({ id: c.id, type: "tenant" })}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Landlord complaints tab */}
      {activeTab === "landlord" && (
        <div className="space-y-3">
          {landlordComplaints.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No landlord complaints found</div>
          ) : landlordComplaints.map((c: any) => (
            <div key={c.id} className="bg-card rounded-xl border border-border shadow-card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{c.complaint_code}</span>
                    <span className="text-sm text-foreground">{c.complaint_type}</span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    By: {c._landlordProfile?.full_name || "Unknown"} ({c._landlordProfile?.phone || "—"})
                  </div>
                  <div className="text-sm text-muted-foreground">{c.property_address}, {c.region} • {new Date(c.created_at).toLocaleDateString()}</div>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[c.status] || ""}`}>{c.status.replace("_", " ")}</span>
              </div>
              <div className="text-sm text-foreground">{c.description}</div>
              {c.audio_url && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Audio Recording</div>
                  <audio controls className="w-full h-10" src={c.audio_url} preload="metadata">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              {c.tenant_name && <div className="text-sm text-muted-foreground">Regarding tenant: <strong className="text-foreground">{c.tenant_name}</strong></div>}
              {/* Appointment Schedule Info */}
              {scheduleMap[c.id] && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
                  <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" /> Appointment
                  </div>
                  {scheduleMap[c.id].status === "confirmed" && scheduleMap[c.id].selected_slot ? (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">
                        {new Date(scheduleMap[c.id].selected_slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </span>{" "}
                      <span className="text-muted-foreground">{scheduleMap[c.id].selected_slot.time_start} — {scheduleMap[c.id].selected_slot.time_end}</span>
                      <span className="ml-2 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Confirmed</span>
                    </div>
                  ) : (
                    <div className="text-sm text-warning font-medium">Awaiting complainant selection</div>
                  )}
                </div>
              )}
              {c.evidence_urls?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {c.evidence_urls.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt={`Evidence ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border hover:opacity-80" />
                    </a>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 pt-2 border-t border-border">
                <span className="text-sm font-medium text-muted-foreground">Status:</span>
                <Select value={c.status} onValueChange={(v) => {
                  if (v === "schedule_complainant") {
                    setSchedulingComplaint({ id: c.id, type: "landlord", userId: c.landlord_user_id, name: c._landlordProfile?.full_name || "Unknown", phone: c._landlordProfile?.phone, complaintCode: c.complaint_code, officeName: officeMap[c.office_id] });
                  } else {
                    updateLandlordComplaintStatus(c.id, v);
                  }
                }}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {allStatuses.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {profile?.isMainAdmin && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingId({ id: c.id, type: "landlord" })}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {schedulingComplaint && (
        <ScheduleComplainantDialog
          open={!!schedulingComplaint}
          onOpenChange={(open) => { if (!open) setSchedulingComplaint(null); }}
          complaintId={schedulingComplaint.id}
          complaintType={schedulingComplaint.type}
          complainantUserId={schedulingComplaint.userId}
          complainantName={schedulingComplaint.name}
          complainantPhone={schedulingComplaint.phone}
          complaintCode={schedulingComplaint.complaintCode}
          officeName={schedulingComplaint.officeName}
          onScheduled={() => {
            setSchedulingComplaint(null);
            fetchComplaints();
            fetchLandlordComplaints();
            fetchSchedules();
          }}
        />
      )}

      <AdminPasswordConfirm
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
        title="Delete Complaint Permanently"
        description="This will permanently delete this complaint record. This cannot be undone."
        actionLabel="Delete Permanently"
        onConfirm={handleDeleteComplaint}
      />
    </div>
  );
};

export default RegulatorComplaints;

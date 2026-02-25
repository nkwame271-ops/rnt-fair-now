import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Download, Search, ChevronDown, ChevronUp, Clock, User, MapPin, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const RegulatorComplaints = () => {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  useEffect(() => { fetchComplaints(); }, []);

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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const statusColors: Record<string, string> = {
    submitted: "bg-info/10 text-info",
    under_review: "bg-warning/10 text-warning",
    in_progress: "bg-primary/10 text-primary",
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
          <p className="text-muted-foreground mt-1">{filtered.length} complaints total</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {["submitted", "under_review", "in_progress", "resolved", "closed"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`rounded-xl p-3 border text-left transition-all ${
              statusFilter === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40"
            }`}
          >
            <div className="text-2xl font-bold text-foreground">{statusCounts[s] || 0}</div>
            <div className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by code, name, landlord, type..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="submitted">Submitted</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
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
                    {/* Complaint details */}
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
                        <div><span className="text-muted-foreground">Last Updated:</span> <span className="text-foreground">{new Date(c.updated_at).toLocaleString()}</span></div>
                      </div>
                      <div className="pt-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTION</div>
                        <div className="text-sm text-foreground bg-background rounded-lg p-3 border border-border whitespace-pre-wrap">
                          {c.description}
                        </div>
                      </div>
                    </div>

                    {/* Complainant info */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <User className="h-4 w-4 text-primary" /> Complainant (Tenant)
                      </h3>
                      <div className="text-sm space-y-2">
                        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium text-foreground">{c._tenantProfile?.full_name || "—"}</span></div>
                        <div><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{c._tenantProfile?.phone || "—"}</span></div>
                        <div><span className="text-muted-foreground">Email:</span> <span className="text-foreground">{c._tenantProfile?.email || "—"}</span></div>
                        <div><span className="text-muted-foreground">Nationality:</span> <span className="text-foreground">{c._tenantProfile?.nationality || "—"}</span></div>
                        <div><span className="text-muted-foreground">Occupation:</span> <span className="text-foreground">{c._tenantProfile?.occupation || "—"}</span></div>
                        {c._tenantRecord && (
                          <>
                            <div><span className="text-muted-foreground">Tenant ID:</span> <span className="font-mono text-xs text-primary">{c._tenantRecord.tenant_id}</span></div>
                            <div><span className="text-muted-foreground">Reg. Status:</span> <span className="text-foreground">{c._tenantRecord.status}</span></div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Current residence */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Current Residence
                      </h3>
                      {c._activeTenancy ? (
                        <div className="text-sm space-y-2">
                          <div><span className="text-muted-foreground">Property:</span> <span className="text-foreground">{c._activeTenancy._property?.property_name || "—"}</span></div>
                          <div><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{c._activeTenancy._property?.address || "—"}</span></div>
                          <div><span className="text-muted-foreground">Unit:</span> <span className="text-foreground">{c._activeTenancy._unit?.unit_name || "—"}</span></div>
                          <div><span className="text-muted-foreground">Rent:</span> <span className="font-medium text-foreground">GH₵ {c._activeTenancy.agreed_rent?.toLocaleString()}</span></div>
                          <div><span className="text-muted-foreground">Lease:</span> <span className="text-foreground">{new Date(c._activeTenancy.start_date).toLocaleDateString()} — {new Date(c._activeTenancy.end_date).toLocaleDateString()}</span></div>
                          <div><span className="text-muted-foreground">Reg. Code:</span> <span className="font-mono text-xs text-primary">{c._activeTenancy.registration_code}</span></div>
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground italic">No active tenancy on record</div>
                      )}
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-3 pt-3 border-t border-border">
                    <span className="text-sm font-medium text-muted-foreground">Update status:</span>
                    <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                      <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["submitted", "under_review", "in_progress", "resolved", "closed"].map((s) => (
                          <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                      <Clock className="h-3 w-3" />
                      {Math.ceil((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24))} days since filed
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegulatorComplaints;

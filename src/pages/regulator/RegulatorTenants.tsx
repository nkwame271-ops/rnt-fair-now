import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link, useSearchParams } from "react-router-dom";
import { Users, Download, Search, ChevronDown, ChevronUp, Home, FileText, Calendar, User, Phone, Mail, MessageSquare, FileBadge, AlertCircle } from "lucide-react";
import { SkeletonCardList } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { generateProfilePdf } from "@/lib/generateProfilePdf";
import { toast } from "sonner";

interface TenantFull {
  tenant_id: string;
  user_id: string;
  status: string;
  account_status: string;
  registration_date: string | null;
  expiry_date: string | null;
  registration_fee_paid: boolean;
  is_student?: boolean;
  school?: string | null;
  hostel_or_hall?: string | null;
  profile?: {
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string;
    is_citizen: boolean;
    ghana_card_no: string | null;
    residence_permit_no: string | null;
    occupation: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    work_address: string | null;
    delivery_address: string | null;
    delivery_region: string | null;
  };
  tenancies?: Array<{
    id: string;
    status: string;
    agreed_rent: number;
    start_date: string;
    end_date: string;
    move_in_date: string;
    registration_code: string;
    advance_months: number;
    landlord_user_id: string;
    _landlordName?: string;
    _landlordPhone?: string;
    _propertyName?: string;
    _propertyAddress?: string;
    _unitName?: string;
    _region?: string;
    _propertyId?: string;
  }>;
  complaints?: Array<{
    complaint_code: string;
    complaint_type: string;
    status: string;
    created_at: string;
  }>;
}

// Helpers
const initials = (name?: string) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[parts.length - 1]?.[0] || "")).toUpperCase();
};

const NotProvided = () => <span className="italic text-muted-foreground/70">Not provided</span>;

const FieldRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-[12px] text-muted-foreground">{label}</span>
    <span className="text-[13px] font-medium text-foreground text-right max-w-[60%] break-words">{value}</span>
  </div>
);

const TenantIdPill = ({ id }: { id: string }) => (
  <span className="inline-flex items-center font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">{id}</span>
);

const IconButton = ({ children, onClick, title }: { children: React.ReactNode; onClick?: () => void; title?: string }) => (
  <button
    type="button"
    onClick={onClick}
    title={title}
    className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-border bg-background hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
  >
    {children}
  </button>
);

const SectionHeader = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex items-center gap-1.5 mb-3">
    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
    <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
  </div>
);

const ExpiryValue = ({ date }: { date: string | null }) => {
  if (!date) return <NotProvided />;
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  let cls = "text-foreground";
  if (diffDays < 0) cls = "text-destructive";
  else if (diffDays <= 30) cls = "text-warning";
  return <span className={`font-medium ${cls}`}>{d.toLocaleDateString()}</span>;
};

const RegulatorTenants = () => {
  const [tenants, setTenants] = useState<TenantFull[]>([]);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("tenant_id, user_id, status, account_status, registration_date, expiry_date, registration_fee_paid, is_student, school, hostel_or_hall")
        .order("created_at", { ascending: false });

      if (!tenantData || tenantData.length === 0) { setLoading(false); return; }

      const userIds = tenantData.map(t => t.user_id);

      const [profilesRes, tenanciesRes, complaintsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name, phone, email, nationality, is_citizen, ghana_card_no, residence_permit_no, occupation, emergency_contact_name, emergency_contact_phone, work_address, delivery_address, delivery_region").in("user_id", userIds),
        supabase.from("tenancies").select("id, tenant_user_id, landlord_user_id, status, agreed_rent, start_date, end_date, move_in_date, registration_code, advance_months, unit_id").in("tenant_user_id", userIds).order("start_date", { ascending: false }),
        supabase.from("complaints").select("tenant_user_id, complaint_code, complaint_type, status, created_at").in("tenant_user_id", userIds),
      ]);

      const landlordIds = [...new Set((tenanciesRes.data || []).map(t => t.landlord_user_id))];
      const unitIds = [...new Set((tenanciesRes.data || []).map(t => t.unit_id))];

      const [landlordProfiles, unitsRes] = await Promise.all([
        landlordIds.length > 0 ? supabase.from("profiles").select("user_id, full_name, phone").in("user_id", landlordIds) : { data: [] },
        unitIds.length > 0 ? supabase.from("units").select("id, unit_name, property_id").in("id", unitIds) : { data: [] },
      ]);

      const propertyIds = [...new Set((unitsRes.data || []).map(u => u.property_id))];
      const { data: properties } = propertyIds.length > 0
        ? await supabase.from("properties").select("id, property_name, address, region").in("id", propertyIds)
        : { data: [] };

      const profileMap = new Map((profilesRes.data || []).map(p => [p.user_id, p]));
      const landlordProfileMap = new Map(((landlordProfiles as any).data || []).map((p: any) => [p.user_id, { full_name: p.full_name, phone: p.phone }]));
      const unitMap = new Map((unitsRes.data || []).map(u => [u.id, u]));
      const propMap = new Map((properties || []).map(p => [p.id, p]));

      const tenancyMap = new Map<string, any[]>();
      (tenanciesRes.data || []).forEach(t => {
        const unit = unitMap.get(t.unit_id);
        const prop = unit ? propMap.get(unit.property_id) : null;
        const landlordProfile = landlordProfileMap.get(t.landlord_user_id) as any;
        const enriched = {
          ...t,
          _landlordName: (landlordProfile?.full_name as string) || "Unknown",
          _landlordPhone: (landlordProfile?.phone as string) || "",
          _propertyName: prop?.property_name || null,
          _propertyAddress: prop?.address || null,
          _unitName: unit?.unit_name || null,
          _region: prop?.region || null,
          _propertyId: prop?.id || null,
        };
        const arr = tenancyMap.get(t.tenant_user_id) || [];
        arr.push(enriched);
        tenancyMap.set(t.tenant_user_id, arr);
      });

      const complaintMap = new Map<string, any[]>();
      (complaintsRes.data || []).forEach(c => {
        const arr = complaintMap.get(c.tenant_user_id) || [];
        arr.push(c);
        complaintMap.set(c.tenant_user_id, arr);
      });

      setTenants(tenantData.map(t => ({
        ...t,
        profile: profileMap.get(t.user_id) || undefined,
        tenancies: tenancyMap.get(t.user_id) || [],
        complaints: complaintMap.get(t.user_id) || [],
      })));
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = tenants.filter((t) => {
    if (statusFilter === "deactivated" && t.account_status !== "deactivated") return false;
    else if (statusFilter === "archived" && t.account_status !== "archived") return false;
    else if (statusFilter === "students" && !t.is_student) return false;
    else if (statusFilter !== "all" && statusFilter !== "deactivated" && statusFilter !== "archived" && statusFilter !== "students" && t.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.tenant_id.toLowerCase().includes(s) ||
      t.profile?.full_name?.toLowerCase().includes(s) ||
      t.profile?.phone?.includes(s) ||
      t.profile?.email?.toLowerCase().includes(s)
    );
  });

  const studentCount = tenants.filter(t => t.is_student).length;

  const exportCSV = () => {
    const headers = ["Tenant ID", "Name", "Phone", "Email", "Nationality", "Citizen", "ID Number", "Occupation", "Status", "Account Status", "Active Tenancies", "Complaints", "Registered", "Expires"];
    const rows = filtered.map((t) => [
      t.tenant_id, t.profile?.full_name || "", t.profile?.phone || "", t.profile?.email || "",
      t.profile?.nationality || "", t.profile?.is_citizen ? "Yes" : "No",
      t.profile?.is_citizen ? t.profile?.ghana_card_no || "" : t.profile?.residence_permit_no || "",
      t.profile?.occupation || "", t.status, t.account_status,
      t.tenancies?.filter(tc => tc.status === "active").length || 0,
      t.complaints?.length || 0,
      t.registration_date ? new Date(t.registration_date).toLocaleDateString() : "",
      t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "tenants_export.csv"; a.click();
  };

  const downloadPdf = async (t: TenantFull) => {
    const { data: kyc } = await supabase.from("kyc_verifications").select("status, ghana_card_number, ai_match_score, ai_match_result, reviewer_notes").eq("user_id", t.user_id).maybeSingle();
    generateProfilePdf({
      role: "tenant",
      roleId: t.tenant_id,
      status: t.status,
      registrationDate: t.registration_date,
      expiryDate: t.expiry_date,
      registrationFeePaid: t.registration_fee_paid,
      profile: t.profile as any,
      kyc: kyc as any,
      tenancies: t.tenancies,
      complaints: t.complaints,
    });
    toast.success("Profile PDF downloaded");
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Tenant Database</h1>
        <p className="text-muted-foreground mt-1">Loading tenants…</p>
      </div>
      <SkeletonCardList count={5} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Tenant Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered tenants</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, ID, phone, or email..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="deactivated">Deactivated</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="students">Students ({studentCount})</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No tenants found</div>
        ) : filtered.map((t) => {
          const isExpanded = expandedId === t.tenant_id;
          const activeTenancies = t.tenancies?.filter(tc => tc.status === "active") || [];
          const profile = t.profile;
          const idNumber = profile?.is_citizen ? profile?.ghana_card_no : profile?.residence_permit_no;

          return (
            <div key={t.tenant_id} className="bg-card rounded-xl border border-border overflow-hidden">
              <div
                onClick={() => setExpandedId(isExpanded ? null : t.tenant_id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#f9fafb] dark:hover:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-7 gap-2 items-center">
                  <div><TenantIdPill id={t.tenant_id} /></div>
                  <div className="text-[14px] font-medium text-foreground flex items-center gap-1.5">
                    {profile?.full_name || <NotProvided />}
                    {t.is_student && <Badge variant="info" className="text-[10px]">Student</Badge>}
                  </div>
                  <div className="text-[13px] text-muted-foreground">{profile?.phone || "—"}</div>
                  <div className="text-[13px] text-muted-foreground">{profile?.is_citizen ? "🇬🇭 Citizen" : "Permit"}</div>
                  <div className="text-[13px] text-muted-foreground truncate">{t.is_student && t.school ? t.school : (profile?.occupation || "—")}</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant={t.status === "active" ? "success" : "destructive"} className="capitalize">{t.status}</Badge>
                    {t.account_status !== "active" && <Badge variant="destructive" className="capitalize">{t.account_status}</Badge>}
                    {activeTenancies.length > 0 && <span className="text-[11px] text-primary font-medium self-center">{activeTenancies.length} active</span>}
                  </div>
                  <div className="text-[13px] text-muted-foreground">{t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "—"}</div>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : t.tenant_id); }}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border bg-background hover:bg-muted/60 transition-colors text-muted-foreground shrink-0"
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-muted/20 space-y-5">
                  {/* Section 1 — Profile Hero */}
                  <div className="bg-card rounded-2xl border border-border p-5 flex flex-col sm:flex-row gap-5 items-start justify-between">
                    <div className="flex gap-4 items-start">
                      <div className="h-[52px] w-[52px] rounded-full bg-primary text-primary-foreground flex items-center justify-center text-base font-semibold shrink-0">
                        {initials(profile?.full_name)}
                      </div>
                      <div className="space-y-1.5">
                        <div className="text-[18px] font-semibold text-foreground leading-tight">{profile?.full_name || <NotProvided />}</div>
                        <div><TenantIdPill id={t.tenant_id} /></div>
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <Badge variant={t.status === "active" ? "success" : "secondary"} className="capitalize">{t.status === "active" ? "Active" : "Inactive"}</Badge>
                          <span className="text-[12px] text-muted-foreground inline-flex items-center gap-1.5">
                            {profile?.is_citizen ? "🇬🇭" : "🌍"} {profile?.nationality || "—"}
                          </span>
                          <Badge variant={profile?.is_citizen ? "success" : "secondary"} className="text-[10px]">
                            {profile?.is_citizen ? "Citizen" : "Non-Citizen"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <div className="flex items-center gap-2">
                        <IconButton title="Download profile PDF" onClick={() => downloadPdf(t)}>
                          <Download className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="Email tenant" onClick={() => profile?.email && (window.location.href = `mailto:${profile.email}`)}>
                          <Mail className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="View agreements">
                          <FileBadge className="h-4 w-4" />
                        </IconButton>
                        <IconButton title="View complaints">
                          <MessageSquare className="h-4 w-4" />
                        </IconButton>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => downloadPdf(t)}>
                        <Download className="h-4 w-4 mr-1.5" /> Download Full Profile PDF
                      </Button>
                    </div>
                  </div>

                  {/* Section 2 — 3-column info cards */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Personal */}
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <SectionHeader icon={User} label="Personal information" />
                      <div className="divide-y divide-border/60">
                        <FieldRow label="Full Name" value={profile?.full_name || <NotProvided />} />
                        <FieldRow label="Phone" value={profile?.phone || <NotProvided />} />
                        <FieldRow label="Email" value={profile?.email || <NotProvided />} />
                        <FieldRow label="Nationality" value={profile?.nationality || <NotProvided />} />
                        <FieldRow label="Citizen" value={profile?.is_citizen ? "Yes" : "No"} />
                        <FieldRow label="ID Number" value={idNumber ? <span className="font-mono text-[12px]">{idNumber}</span> : <NotProvided />} />
                        <FieldRow label="Occupation" value={profile?.occupation || <NotProvided />} />
                        <FieldRow label="Work Address" value={profile?.work_address || <NotProvided />} />
                      </div>
                    </div>

                    {/* Emergency & Contact */}
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <SectionHeader icon={Phone} label="Emergency & contact" />
                      <div className="divide-y divide-border/60">
                        <FieldRow label="Emergency Contact" value={profile?.emergency_contact_name || <NotProvided />} />
                        <FieldRow label="Emergency Phone" value={profile?.emergency_contact_phone || <NotProvided />} />
                        <FieldRow label="Delivery Address" value={profile?.delivery_address || <NotProvided />} />
                        <FieldRow label="Delivery Region" value={profile?.delivery_region || <NotProvided />} />
                      </div>
                    </div>

                    {/* Registration */}
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <SectionHeader icon={FileText} label="Registration details" />
                      <div className="divide-y divide-border/60">
                        <FieldRow label="Tenant ID" value={<TenantIdPill id={t.tenant_id} />} />
                        <FieldRow label="Fee Paid" value={
                          <Badge variant={t.registration_fee_paid ? "success" : "destructive"}>
                            {t.registration_fee_paid ? "Yes" : "No"}
                          </Badge>
                        } />
                        <FieldRow label="Registered" value={t.registration_date ? new Date(t.registration_date).toLocaleDateString() : <NotProvided />} />
                        <FieldRow label="Expires" value={<ExpiryValue date={t.expiry_date} />} />
                      </div>
                    </div>
                  </div>

                  {/* Section 3 — Complaints */}
                  {(t.complaints?.length || 0) === 0 ? (
                    <div className="flex items-center gap-2 text-[13px] text-muted-foreground italic px-1">
                      <AlertCircle className="h-4 w-4" />
                      No complaints filed
                    </div>
                  ) : (
                    <div className="bg-card rounded-2xl border border-border p-5">
                      <SectionHeader icon={FileText} label={`Complaints (${t.complaints?.length || 0})`} />
                      <div className="space-y-2">
                        {t.complaints?.slice(0, 5).map(c => (
                          <div key={c.complaint_code} className="flex items-center justify-between gap-3 py-2 border-b border-border/60 last:border-0">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary shrink-0">{c.complaint_code}</span>
                              <span className="text-[13px] text-foreground truncate">{c.complaint_type}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <Badge variant={c.status === "resolved" ? "success" : c.status === "pending" ? "warning" : "info"} className="capitalize">{c.status}</Badge>
                              <span className="text-[12px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end mt-3">
                        <Link to="/regulator/complaints" className="text-[12px] text-primary hover:underline">View all complaints →</Link>
                      </div>
                    </div>
                  )}

                  {/* Tenancy history (kept) */}
                  <div className="bg-card rounded-2xl border border-border p-5">
                    <SectionHeader icon={Home} label={`Tenancy history (${t.tenancies?.length || 0})`} />
                    {(t.tenancies?.length || 0) === 0 ? (
                      <div className="text-[13px] text-muted-foreground italic">No tenancies on record</div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-3">
                        {t.tenancies?.map(tc => (
                          <div key={tc.id} className={`text-sm rounded-xl p-3 border ${tc.status === "active" ? "border-primary/30 bg-primary/5" : "border-border bg-background"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-[11px] text-primary font-semibold">{tc.registration_code}</span>
                              <Badge variant={tc.status === "active" ? "success" : "secondary"} className="capitalize">{tc.status}</Badge>
                            </div>
                            <div className="font-medium text-foreground">
                              {tc._propertyId ? (
                                <Link to={`/regulator/properties?id=${tc._propertyId}`} className="text-primary hover:underline">{tc._propertyName || "Property"}</Link>
                              ) : (tc._propertyName || <NotProvided />)}
                            </div>
                            <div className="text-muted-foreground text-[12px]">{tc._propertyAddress || "—"} {tc._unitName ? `• ${tc._unitName}` : ""}</div>
                            <div className="text-muted-foreground text-[12px]">{tc._region || ""}</div>
                            <div className="mt-1.5 flex justify-between text-[12px]">
                              <span className="text-muted-foreground">Landlord: <Link to={`/regulator/landlords?search=${encodeURIComponent(tc._landlordName || "")}`} className="text-primary hover:underline">{tc._landlordName}</Link></span>
                              <span className="font-medium text-foreground">GH₵ {tc.agreed_rent?.toLocaleString()}/mo</span>
                            </div>
                            <div className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(tc.start_date).toLocaleDateString()} — {new Date(tc.end_date).toLocaleDateString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default RegulatorTenants;

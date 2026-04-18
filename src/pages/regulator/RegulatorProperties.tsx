import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Download, Search, MapPin, Map, List, CheckCircle2, Clock, Eye, Loader2, ClipboardCheck, AlertTriangle, ShieldAlert, Ban, GitCompare, Trash2 } from "lucide-react";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SkeletonCardList } from "@/components/ui/skeleton";
import PropertyMap, { MapMarker } from "@/components/PropertyMap";
import { parseGPS } from "@/lib/gpsUtils";
import { toast } from "sonner";
import { PropertyMatchBadge, PropertySimilarityMatches } from "@/components/PropertySimilarityMatches";

const RegulatorProperties = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [detailProperty, setDetailProperty] = useState<any | null>(null);
  const [detailImages, setDetailImages] = useState<any[]>([]);
  const [approving, setApproving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteProperty = async (password: string, reason: string) => {
    if (!deletingId) return;
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action: "delete_property", target_id: deletingId, reason, password },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setProperties(prev => prev.filter(p => p.id !== deletingId));
    toast.success("Property permanently deleted");
  };

  // Assessment form state
  const [showAssessment, setShowAssessment] = useState(false);
  const [assessmentPropertyId, setAssessmentPropertyId] = useState("");
  const [assessCondition, setAssessCondition] = useState("good");
  const [assessRecommendedRent, setAssessRecommendedRent] = useState("");
  const [assessAmenities, setAssessAmenities] = useState("");
  const [assessNotes, setAssessNotes] = useState("");
  const [submittingAssessment, setSubmittingAssessment] = useState(false);

  // Track which property IDs have pending existing tenancies
  const [pendingExistingMap, setPendingExistingMap] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      const { data } = await supabase
        .from("properties")
        .select("*, units(id, unit_name, unit_type, monthly_rent, status, has_toilet_bathroom, has_kitchen, water_available, electricity_available, has_borehole, has_polytank, amenities)")
        .order("created_at", { ascending: false });
      setProperties(data || []);

      // Fetch existing_declared tenancies that haven't been accepted
      const { data: pendingTenancies } = await supabase
        .from("tenancies")
        .select("id, unit_id, tenant_accepted")
        .eq("tenancy_type", "existing_migration")
        .eq("tenant_accepted", false);

      if (pendingTenancies && pendingTenancies.length > 0) {
        const unitIds = pendingTenancies.map(t => t.unit_id);
        const { data: unitRows } = await supabase.from("units").select("id, property_id").in("id", unitIds);
        const propIds = new Set((unitRows || []).map(u => u.property_id));
        setPendingExistingMap(propIds);
      }

      setLoading(false);
    };
    fetchAll();
  }, []);

  const openDetail = async (p: any) => {
    setDetailProperty(p);
    const { data } = await supabase.from("property_images").select("*").eq("property_id", p.id);
    setDetailImages(data || []);
  };

  const handleApprove = async (propertyId: string) => {
    setApproving(true);
    const { error } = await supabase
      .from("properties")
      .update({
        assessment_status: "approved",
        property_status: "approved",
        assessed_at: new Date().toISOString(),
        assessed_by: user?.id,
      } as any)
      .eq("id", propertyId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Property approved — Fully Assessed / Tenantable");
      setProperties((prev) =>
        prev.map((p) => p.id === propertyId ? { ...p, assessment_status: "approved", property_status: "approved", assessed_at: new Date().toISOString() } : p)
      );
      if (detailProperty?.id === propertyId) {
        setDetailProperty({ ...detailProperty, assessment_status: "approved", property_status: "approved" });
      }
    }
    setApproving(false);
  };

  const openAssessmentForm = (propertyId: string) => {
    setAssessmentPropertyId(propertyId);
    setAssessCondition("good");
    setAssessRecommendedRent("");
    setAssessAmenities("");
    setAssessNotes("");
    setShowAssessment(true);
  };

  const handleSubmitAssessment = async () => {
    if (!user) return;
    setSubmittingAssessment(true);
    try {
      const prop = properties.find(p => p.id === assessmentPropertyId);
      const { data: assessment, error } = await supabase.from("property_assessments").insert({
        property_id: assessmentPropertyId,
        inspector_user_id: user.id,
        gps_location: prop?.gps_location || null,
        amenities: assessAmenities ? assessAmenities.split(",").map((a: string) => a.trim()) : [],
        property_condition: assessCondition,
        recommended_rent: parseFloat(assessRecommendedRent) || null,
        status: "completed",
      } as any).select().single();

      if (error) throw error;

      toast.success("Property assessment recorded!");
      setShowAssessment(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit assessment");
    } finally {
      setSubmittingAssessment(false);
    }
  };

  const handleApproveAssessment = async (propertyId: string, approvedRent: number, assessmentId: string) => {
    setApproving(true);
    try {
      await supabase.from("property_assessments").update({
        approved_rent: approvedRent,
        approved_by: user?.id,
        approved_at: new Date().toISOString(),
        status: "approved",
      } as any).eq("id", assessmentId);

      await supabase.from("properties").update({
        assessment_status: "approved",
        property_status: "approved",
        assessed_at: new Date().toISOString(),
        assessed_by: user?.id,
        approved_rent: approvedRent,
        last_assessment_id: assessmentId,
      } as any).eq("id", propertyId);

      toast.success(`Property approved with rent GH₵ ${approvedRent.toLocaleString()}`);
      setProperties((prev) =>
        prev.map((p) => p.id === propertyId ? { ...p, assessment_status: "approved", property_status: "approved", approved_rent: approvedRent } : p)
      );
      if (detailProperty?.id === propertyId) {
        setDetailProperty({ ...detailProperty, assessment_status: "approved", property_status: "approved", approved_rent: approvedRent });
      }
    } catch (err: any) {
      toast.error(err.message);
    }
    setApproving(false);
  };

  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "student_housing">("all");

  const filtered = properties.filter((p) => {
    if (statusFilter !== "all" && (p.property_status || "pending_assessment") !== statusFilter) return false;
    if (categoryFilter === "student_housing" && p.property_category !== "student_housing") return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.property_name?.toLowerCase().includes(s) || p.address?.toLowerCase().includes(s) || p.region?.toLowerCase().includes(s) || p.property_code?.toLowerCase().includes(s);
  });

  const studentHousingCount = properties.filter(p => p.property_category === "student_housing").length;

  const mapMarkers: MapMarker[] = filtered
    .map((p) => {
      const gps = parseGPS(p.gps_location);
      if (!gps) return null;
      const occupied = p.units?.filter((u: any) => u.status === "occupied").length || 0;
      const total = p.units?.length || 0;
      return {
        lat: gps.lat, lng: gps.lng,
        label: p.property_name || p.property_code,
        detail: `${p.address}, ${p.region} • ${occupied}/${total} occupied`,
        color: occupied === total && total > 0 ? "green" as const : occupied > 0 ? "blue" as const : "gold" as const,
      };
    })
    .filter(Boolean) as MapMarker[];

  const exportCSV = () => {
    const headers = ["Property Code", "Name", "Address", "Region", "Area", "Units", "Assessment", "GPS", "Approved Rent"];
    const rows = filtered.map((p: any) => [
      p.property_code, p.property_name || "", p.address, p.region, p.area, p.units?.length || 0, p.assessment_status || "pending", p.gps_location || "", p.approved_rent || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "properties_export.csv"; a.click();
  };

  const assessmentBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-success/10 text-success border-success/20 text-xs">Approved</Badge>;
    return <Badge variant="outline" className="text-warning border-warning/30 text-xs"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  // Suggest Relisting state
  const [showSuggestRelist, setShowSuggestRelist] = useState(false);
  const [suggestPropertyId, setSuggestPropertyId] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [suggestNotes, setSuggestNotes] = useState("");
  const [submittingSuggest, setSubmittingSuggest] = useState(false);

  // Duplicate comparison state
  const [showCompare, setShowCompare] = useState(false);
  const [compareProperty, setCompareProperty] = useState<any>(null);
  const [originalProperty, setOriginalProperty] = useState<any>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);

  const openCompare = async (property: any) => {
    setCompareProperty(property);
    setShowCompare(true);
    setLoadingCompare(true);
    try {
      const { data: original } = await supabase
        .from("properties")
        .select("*, units(id, unit_name, unit_type, monthly_rent, status)")
        .eq("id", property.duplicate_of_property_id)
        .single();
      setOriginalProperty(original);
    } catch {
      setOriginalProperty(null);
    }
    setLoadingCompare(false);
  };

  const handleSuggestRelisting = async () => {
    if (!suggestedPrice || !suggestPropertyId) return;
    setSubmittingSuggest(true);
    try {
      const { error } = await supabase.from("properties").update({
        property_status: "needs_update",
        suggested_price: parseFloat(suggestedPrice),
      } as any).eq("id", suggestPropertyId);
      if (error) throw error;

      await supabase.from("property_events").insert({
        property_id: suggestPropertyId,
        event_type: "status_change",
        old_value: { status: properties.find(p => p.id === suggestPropertyId)?.property_status },
        new_value: { status: "needs_update", suggested_price: parseFloat(suggestedPrice) },
        performed_by: user?.id,
        reason: suggestNotes || "Admin suggested relisting with price guidance",
      } as any);

      // Get landlord user_id for notification
      const prop = properties.find(p => p.id === suggestPropertyId);
      if (prop) {
        const { data: profile } = await supabase.from("profiles").select("phone, email, full_name").eq("user_id", prop.landlord_user_id).maybeSingle();
        if (profile) {
          await supabase.functions.invoke("send-notification", {
            body: {
              event: "contact_changed",
              phone: profile.phone,
              email: profile.email,
              user_id: prop.landlord_user_id,
              data: {
                name: profile.full_name,
                message: `Your property needs a pricing update. Suggested rent: GH₵ ${parseFloat(suggestedPrice).toLocaleString()}. Please edit and resubmit.`,
              },
            },
          });
        }
      }

      setProperties(prev => prev.map(p => p.id === suggestPropertyId ? { ...p, property_status: "needs_update", suggested_price: parseFloat(suggestedPrice) } : p));
      toast.success("Property sent back for pricing update");
      setShowSuggestRelist(false);
      setSuggestedPrice("");
      setSuggestNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to suggest relisting");
    }
    setSubmittingSuggest(false);
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    pending_identity_review: "bg-orange-100 text-orange-700 border-orange-200",
    pending_assessment: "bg-warning/10 text-warning border-warning/30",
    approved: "bg-success/10 text-success border-success/20",
    live: "bg-primary/10 text-primary border-primary/20",
    occupied: "bg-info/10 text-info border-info/20",
    off_market: "bg-muted text-muted-foreground border-border",
    pending_rent_review: "bg-warning/10 text-warning border-warning/30",
    suspended: "bg-destructive/10 text-destructive border-destructive/20",
    archived: "bg-muted text-muted-foreground border-border",
    needs_update: "bg-orange-100 text-orange-700 border-orange-200",
  };

  const statusLabels: Record<string, string> = {
    draft: "Draft",
    pending_identity_review: "Identity Review",
    pending_assessment: "Under Assessment",
    approved: "Approved",
    live: "Live",
    occupied: "Occupied",
    off_market: "Off Market",
    pending_rent_review: "Rent Review",
    suspended: "Suspended",
    archived: "Archived",
    needs_update: "Needs Update",
  };

  const handleChangeStatus = async (propertyId: string, newStatus: string) => {
    const { error } = await supabase.from("properties").update({
      property_status: newStatus,
      ...(newStatus === "live" ? { listed_on_marketplace: true } : {}),
      ...(newStatus === "suspended" || newStatus === "off_market" ? { listed_on_marketplace: false } : {}),
    } as any).eq("id", propertyId);
    if (error) { toast.error(error.message); return; }

    await supabase.from("property_events").insert({
      property_id: propertyId,
      event_type: "status_change",
      old_value: { status: properties.find(p => p.id === propertyId)?.property_status },
      new_value: { status: newStatus },
      performed_by: user?.id,
      reason: `Admin changed status to ${newStatus}`,
    } as any);

    setProperties(prev => prev.map(p => p.id === propertyId ? { ...p, property_status: newStatus } : p));
    toast.success(`Property status changed to ${statusLabels[newStatus] || newStatus}`);
  };

  if (loading) return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Property Database</h1>
        <p className="text-muted-foreground mt-1">Loading properties…</p>
      </div>
      <SkeletonCardList count={5} />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Property Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered properties{mapMarkers.length > 0 && ` • ${mapMarkers.length} with GPS`}</p>
        </div>
        <div className="flex gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")} className="gap-1.5">
              <List className="h-4 w-4" /> List
            </Button>
            <Button variant={view === "map" ? "default" : "ghost"} size="sm" onClick={() => setView("map")} className="gap-1.5">
              <Map className="h-4 w-4" /> Map
            </Button>
          </div>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, code, or region..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as "all" | "student_housing")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="student_housing">Student Housing ({studentHousingCount})</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses ({properties.length})</SelectItem>
            {Object.entries(statusLabels).map(([key, label]) => {
              const count = properties.filter(p => (p.property_status || "pending_assessment") === key).length;
              return count > 0 ? (
                <SelectItem key={key} value={key}>{label} ({count})</SelectItem>
              ) : null;
            })}
          </SelectContent>
        </Select>
      </div>

      {view === "map" ? (
        <div className="space-y-3">
          {mapMarkers.length === 0 ? (
            <div className="bg-card rounded-xl p-12 text-center border border-border">
              <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No properties have GPS coordinates yet.</p>
            </div>
          ) : (
            <>
              <PropertyMap markers={mapMarkers} height="500px" />
              <div className="flex gap-4 text-xs text-muted-foreground justify-center">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[hsl(152,55%,38%)]" /> Fully Occupied</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[hsl(210,60%,50%)]" /> Partially Occupied</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[hsl(43,85%,55%)]" /> Vacant</span>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
          <div className="responsive-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No properties found</TableCell></TableRow>
              ) : (
                filtered.map((p: any) => {
                  const pStatus = p.property_status || "pending_assessment";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm font-semibold text-primary">{p.property_code}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{p.property_name || "—"}</span>
                          <PropertyMatchBadge propertyId={p.id} />
                        </div>
                        {(p as any).duplicate_of_property_id && (
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20 gap-0.5">
                              <AlertTriangle className="h-2.5 w-2.5" /> Duplicate Risk
                            </Badge>
                            {(p as any).duplicate_old_rent && (
                              <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                                Old Rent: GH₵ {Number((p as any).duplicate_old_rent).toLocaleString()}
                              </Badge>
                            )}
                            <Button size="sm" variant="ghost" className="h-5 px-1.5 text-[10px] gap-0.5 text-primary" onClick={(e) => { e.stopPropagation(); openCompare(p); }}>
                              <GitCompare className="h-2.5 w-2.5" /> Compare
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <a
                            href={(() => { const gps = parseGPS(p.gps_location); return gps ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}` : `https://www.google.com/maps/search/${encodeURIComponent(p.address)}`; })()}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline hover:text-primary/80 truncate max-w-[150px]"
                          >
                            {p.address}
                          </a>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{p.region}, {p.area}</TableCell>
                      <TableCell>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{p.units?.length || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className={`text-xs ${statusColors[pStatus] || "text-muted-foreground"}`}>
                            {statusLabels[pStatus] || pStatus}
                          </Badge>
                          {pStatus === "occupied" && pendingExistingMap.has(p.id) && (
                            <div>
                              <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
                                Pending Tenancy Agreement Completion
                              </Badge>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{assessmentBadge(p.assessment_status || "pending")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openDetail(p)} className="gap-1">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Button>
                          {((p.assessment_status || "pending") !== "approved" || pStatus === "pending_assessment") && (
                            <Button size="sm" variant="ghost" onClick={() => openAssessmentForm(p.id)} className="gap-1 text-primary">
                              <ClipboardCheck className="h-3.5 w-3.5" /> Assess
                            </Button>
                          )}
                          {["pending_assessment", "pending_identity_review"].includes(pStatus) && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              setSuggestPropertyId(p.id);
                              setSuggestedPrice("");
                              setSuggestNotes("");
                              setShowSuggestRelist(true);
                            }} className="gap-1 text-orange-600">
                              <AlertTriangle className="h-3.5 w-3.5" /> Suggest Relist
                            </Button>
                          )}
                          {pStatus === "pending_identity_review" && (
                            <Button size="sm" variant="ghost" onClick={() => handleChangeStatus(p.id, "pending_assessment")} className="gap-1 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Clear
                            </Button>
                          )}
                          {pStatus === "live" && (
                            <Button size="sm" variant="ghost" onClick={() => handleChangeStatus(p.id, "suspended")} className="gap-1 text-destructive">
                              <Ban className="h-3.5 w-3.5" /> Suspend
                            </Button>
                          )}
                          {pStatus === "suspended" && (
                            <Button size="sm" variant="ghost" onClick={() => handleChangeStatus(p.id, "approved")} className="gap-1 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Reinstate
                            </Button>
                          )}
                          {profile?.isMainAdmin && (
                            <Button size="sm" variant="ghost" className="gap-1 text-destructive hover:text-destructive" onClick={() => setDeletingId(p.id)}>
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailProperty} onOpenChange={(open) => !open && setDetailProperty(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {detailProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  {detailProperty.property_name || detailProperty.property_code}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {detailImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {detailImages.map((img: any) => (
                      <img key={img.id} src={img.image_url} alt="Property" className="rounded-lg w-full h-40 object-cover" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-semibold">{detailProperty.property_code}</span></div>
                  <div><span className="text-muted-foreground">Category:</span> <span className="font-semibold capitalize">{(detailProperty as any).property_category || "residential"}</span></div>
                  <div><span className="text-muted-foreground">Region:</span> <span className="font-semibold">{detailProperty.region}, {detailProperty.area}</span></div>
                  <div><span className="text-muted-foreground">Address:</span>{" "}
                    <a
                      href={(() => { const gps = parseGPS(detailProperty.gps_location); return gps ? `https://www.google.com/maps?q=${gps.lat},${gps.lng}` : `https://www.google.com/maps/search/${encodeURIComponent(detailProperty.address)}`; })()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-primary underline hover:text-primary/80"
                    >
                      {detailProperty.address}
                    </a>
                  </div>
                  <div><span className="text-muted-foreground">Condition:</span> <span className="font-semibold">{detailProperty.property_condition || "—"}</span></div>
                  <div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold">{detailProperty.gps_location || "—"}</span></div>
                  <div><span className="text-muted-foreground">Ghana Post GPS:</span> <span className="font-semibold">{detailProperty.ghana_post_gps || "—"}</span></div>
                  <div><span className="text-muted-foreground">Assessment:</span> {assessmentBadge(detailProperty.assessment_status || "pending")}</div>
                  <div><span className="text-muted-foreground">Property Status:</span>{" "}
                    <Badge variant="outline" className={`text-xs ${statusColors[detailProperty.property_status || "pending_assessment"] || ""}`}>
                      {statusLabels[detailProperty.property_status || "pending_assessment"] || detailProperty.property_status}
                    </Badge>
                  </div>
                  {(detailProperty as any).approved_rent && (
                    <div><span className="text-muted-foreground">Approved Rent:</span> <span className="font-semibold text-success">GH₵ {Number((detailProperty as any).approved_rent).toLocaleString()}</span></div>
                  )}
                  {(detailProperty as any).duplicate_of_property_id && (
                    <div className="col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                        <AlertTriangle className="h-4 w-4" /> Duplicate Property Detected
                      </div>
                      {(detailProperty as any).duplicate_old_rent && (
                        <div className="text-sm mt-1 text-orange-600">
                          Previous listing rent: <span className="font-bold">GH₵ {Number((detailProperty as any).duplicate_old_rent).toLocaleString()}/mo</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-card-foreground mb-2">Units ({detailProperty.units?.length || 0})</h3>
                  <div className="space-y-2">
                    {(detailProperty.units || []).map((u: any) => (
                      <div key={u.id} className="bg-muted/50 rounded-lg p-3 border border-border/50">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{u.unit_name} <span className="text-muted-foreground">({u.unit_type})</span></span>
                          <span className="font-bold">GH₵ {u.monthly_rent?.toLocaleString()}/mo</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {u.water_available && <Badge variant="secondary" className="text-xs">Water</Badge>}
                          {u.electricity_available && <Badge variant="secondary" className="text-xs">Electricity</Badge>}
                          {u.has_kitchen && <Badge variant="secondary" className="text-xs">Kitchen</Badge>}
                          {u.has_toilet_bathroom && <Badge variant="secondary" className="text-xs">Toilet/Bath</Badge>}
                          {u.has_borehole && <Badge variant="secondary" className="text-xs">Borehole</Badge>}
                          {u.has_polytank && <Badge variant="secondary" className="text-xs">Polytank</Badge>}
                          {(u.amenities || []).map((a: string) => <Badge key={a} variant="outline" className="text-xs">{a}</Badge>)}
                        </div>
                        <div className="mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === "occupied" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                            {u.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {((detailProperty.assessment_status || "pending") !== "approved" || (detailProperty as any).property_status === "pending_assessment") && (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setDetailProperty(null); openAssessmentForm(detailProperty.id); }}>
                      <ClipboardCheck className="h-4 w-4 mr-2" /> Assess Property
                    </Button>
                    <Button
                      className="bg-success hover:bg-success/90 text-success-foreground flex-1"
                      onClick={() => handleApprove(detailProperty.id)}
                      disabled={approving}
                    >
                      {approving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Quick Approve
                    </Button>
                  </div>
                )}
                {detailProperty.assessment_status === "approved" && (detailProperty as any).property_status !== "pending_assessment" && (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2 text-success text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> This property has been assessed and approved.
                    {(detailProperty as any).approved_rent && <span className="ml-auto font-bold">GH₵ {Number((detailProperty as any).approved_rent).toLocaleString()}/mo</span>}
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <h3 className="font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" /> Similarity Matches
                  </h3>
                  <PropertySimilarityMatches propertyId={detailProperty.id} />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assessment Dialog */}
      <Dialog open={showAssessment} onOpenChange={setShowAssessment}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" /> Property Assessment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property Condition</Label>
              <Select value={assessCondition} onValueChange={setAssessCondition}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">Excellent</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="dilapidated">Dilapidated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recommended Monthly Rent (GH₵)</Label>
              <Input type="number" value={assessRecommendedRent} onChange={(e) => setAssessRecommendedRent(e.target.value)} placeholder="e.g. 500" />
            </div>
            <div className="space-y-2">
              <Label>Amenities (comma-separated)</Label>
              <Input value={assessAmenities} onChange={(e) => setAssessAmenities(e.target.value)} placeholder="e.g. Water, Electricity, Kitchen" />
            </div>
            <div className="space-y-2">
              <Label>Inspector Notes</Label>
              <Textarea value={assessNotes} onChange={(e) => setAssessNotes(e.target.value)} placeholder="Additional observations..." />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowAssessment(false)}>Cancel</Button>
              <Button onClick={handleSubmitAssessment} disabled={submittingAssessment}>
                {submittingAssessment ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ClipboardCheck className="h-4 w-4 mr-1" />}
                Submit Assessment
              </Button>
              {assessRecommendedRent && (
                <Button
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={async () => {
                    setSubmittingAssessment(true);
                    try {
                      const prop = properties.find(p => p.id === assessmentPropertyId);
                      const { data: assessment } = await supabase.from("property_assessments").insert({
                        property_id: assessmentPropertyId,
                        inspector_user_id: user?.id,
                        gps_location: prop?.gps_location || null,
                        amenities: assessAmenities ? assessAmenities.split(",").map((a: string) => a.trim()) : [],
                        property_condition: assessCondition,
                        recommended_rent: parseFloat(assessRecommendedRent),
                        approved_rent: parseFloat(assessRecommendedRent),
                        approved_by: user?.id,
                        approved_at: new Date().toISOString(),
                        status: "approved",
                      } as any).select().single();

                      if (assessment) {
                        await handleApproveAssessment(assessmentPropertyId, parseFloat(assessRecommendedRent), assessment.id);
                      }
                      setShowAssessment(false);
                    } catch (err: any) {
                      toast.error(err.message);
                    }
                    setSubmittingAssessment(false);
                  }}
                  disabled={submittingAssessment}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Assess & Approve
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Suggest Relisting Dialog */}
      <Dialog open={showSuggestRelist} onOpenChange={setShowSuggestRelist}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" /> Suggest Relisting with Price Guidance
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will send the property back to the landlord with your suggested price. They can edit and resubmit.
            </p>
            <div className="space-y-2">
              <Label>Suggested Monthly Rent (GH₵) *</Label>
              <Input type="number" value={suggestedPrice} onChange={(e) => setSuggestedPrice(e.target.value)} placeholder="e.g. 800" />
            </div>
            <div className="space-y-2">
              <Label>Notes to Landlord</Label>
              <Textarea value={suggestNotes} onChange={(e) => setSuggestNotes(e.target.value)} placeholder="e.g. Rent is above benchmark for this area..." rows={3} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowSuggestRelist(false)}>Cancel</Button>
              <Button onClick={handleSuggestRelisting} disabled={submittingSuggest || !suggestedPrice} className="bg-orange-600 hover:bg-orange-700 text-white">
                {submittingSuggest ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-1" />}
                Send for Update
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Comparison Dialog */}
      <Dialog open={showCompare} onOpenChange={(open) => { if (!open) { setShowCompare(false); setCompareProperty(null); setOriginalProperty(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-primary" /> Duplicate Property Comparison
            </DialogTitle>
          </DialogHeader>
          {loadingCompare ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* New (Flagged) Property */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> New (Flagged)</h3>
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-2 text-sm">
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-semibold">{compareProperty?.property_code}</span></div>
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{compareProperty?.property_name || "—"}</span></div>
                  <div><span className="text-muted-foreground">Address:</span> <span className="font-semibold">{compareProperty?.address}</span></div>
                  <div><span className="text-muted-foreground">Region:</span> <span className="font-semibold">{compareProperty?.region}, {compareProperty?.area}</span></div>
                  <div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold">{compareProperty?.gps_location || "—"}</span></div>
                  <div><span className="text-muted-foreground">Category:</span> <span className="font-semibold capitalize">{compareProperty?.property_category || "residential"}</span></div>
                  <div><span className="text-muted-foreground">Approved Rent:</span> <span className="font-semibold">{compareProperty?.approved_rent ? `GH₵ ${Number(compareProperty.approved_rent).toLocaleString()}` : "—"}</span></div>
                  {compareProperty?.units?.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <span className="text-muted-foreground text-xs font-medium">Units:</span>
                      {compareProperty.units.map((u: any) => (
                        <div key={u.id} className="flex justify-between text-xs mt-1">
                          <span>{u.unit_name} ({u.unit_type})</span>
                          <span className="font-semibold">GH₵ {Number(u.monthly_rent).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Original Property */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-success flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> Original (On Record)</h3>
                {originalProperty ? (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-4 space-y-2 text-sm">
                    <div><span className="text-muted-foreground">Code:</span> <span className="font-semibold">{originalProperty.property_code}</span></div>
                    <div><span className="text-muted-foreground">Name:</span> <span className="font-semibold">{originalProperty.property_name || "—"}</span></div>
                    <div><span className="text-muted-foreground">Address:</span> <span className="font-semibold">{originalProperty.address}</span></div>
                    <div><span className="text-muted-foreground">Region:</span> <span className="font-semibold">{originalProperty.region}, {originalProperty.area}</span></div>
                    <div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold">{originalProperty.gps_location || "—"}</span></div>
                    <div><span className="text-muted-foreground">Category:</span> <span className="font-semibold capitalize">{originalProperty.property_category || "residential"}</span></div>
                    <div><span className="text-muted-foreground">Approved Rent:</span> <span className="font-semibold">{originalProperty.approved_rent ? `GH₵ ${Number(originalProperty.approved_rent).toLocaleString()}` : "—"}</span></div>
                    {originalProperty.units?.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-muted-foreground text-xs font-medium">Units:</span>
                        {originalProperty.units.map((u: any) => (
                          <div key={u.id} className="flex justify-between text-xs mt-1">
                            <span>{u.unit_name} ({u.unit_type})</span>
                            <span className="font-semibold">GH₵ {Number(u.monthly_rent).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-muted rounded-lg p-4 text-center text-sm text-muted-foreground">Original property not found</div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdminPasswordConfirm
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
        title="Delete Property Permanently"
        description="This will permanently delete this property and all associated data. This cannot be undone."
        actionLabel="Delete Permanently"
        onConfirm={handleDeleteProperty}
      />
    </div>
  );
};

export default RegulatorProperties;

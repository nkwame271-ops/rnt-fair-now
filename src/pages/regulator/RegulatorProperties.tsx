import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Download, Search, MapPin, Map, List, CheckCircle2, Clock, Eye, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import LogoLoader from "@/components/LogoLoader";
import PropertyMap, { MapMarker } from "@/components/PropertyMap";
import { parseGPS } from "@/lib/gpsUtils";
import { toast } from "sonner";

const RegulatorProperties = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");
  const [detailProperty, setDetailProperty] = useState<any | null>(null);
  const [detailImages, setDetailImages] = useState<any[]>([]);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("properties")
        .select("*, units(id, unit_name, unit_type, monthly_rent, status, has_toilet_bathroom, has_kitchen, water_available, electricity_available, has_borehole, has_polytank, amenities)")
        .order("created_at", { ascending: false });
      setProperties(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const openDetail = async (p: any) => {
    setDetailProperty(p);
    const { data } = await supabase
      .from("property_images")
      .select("*")
      .eq("property_id", p.id);
    setDetailImages(data || []);
  };

  const handleApprove = async (propertyId: string) => {
    setApproving(true);
    const { error } = await supabase
      .from("properties")
      .update({
        assessment_status: "approved",
        assessed_at: new Date().toISOString(),
        assessed_by: user?.id,
      } as any)
      .eq("id", propertyId);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Property approved — Fully Assessed / Tenantable");
      setProperties((prev) =>
        prev.map((p) => p.id === propertyId ? { ...p, assessment_status: "approved", assessed_at: new Date().toISOString() } : p)
      );
      if (detailProperty?.id === propertyId) {
        setDetailProperty({ ...detailProperty, assessment_status: "approved" });
      }
    }
    setApproving(false);
  };

  const filtered = properties.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.property_name?.toLowerCase().includes(s) || p.address?.toLowerCase().includes(s) || p.region?.toLowerCase().includes(s) || p.property_code?.toLowerCase().includes(s);
  });

  const mapMarkers: MapMarker[] = filtered
    .map((p) => {
      const gps = parseGPS(p.gps_location);
      if (!gps) return null;
      const occupied = p.units?.filter((u: any) => u.status === "occupied").length || 0;
      const total = p.units?.length || 0;
      return {
        lat: gps.lat,
        lng: gps.lng,
        label: p.property_name || p.property_code,
        detail: `${p.address}, ${p.region} • ${occupied}/${total} occupied`,
        color: occupied === total && total > 0 ? "green" as const : occupied > 0 ? "blue" as const : "gold" as const,
      };
    })
    .filter(Boolean) as MapMarker[];

  const exportCSV = () => {
    const headers = ["Property Code", "Name", "Address", "Region", "Area", "Units", "Assessment", "GPS"];
    const rows = filtered.map((p: any) => [
      p.property_code, p.property_name || "", p.address, p.region, p.area, p.units?.length || 0, p.assessment_status || "pending", p.gps_location || "",
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

  if (loading) return <LogoLoader message="Loading properties..." />;

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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, code, or region..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No properties found</TableCell></TableRow>
              ) : (
                filtered.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-sm font-semibold text-primary">{p.property_code}</TableCell>
                    <TableCell className="font-medium">{p.property_name || "—"}</TableCell>
                    <TableCell className="flex items-center gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground" />{p.address}</TableCell>
                    <TableCell>{p.region}, {p.area}</TableCell>
                    <TableCell>
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-semibold">{p.units?.length || 0}</span>
                    </TableCell>
                    <TableCell>{assessmentBadge(p.assessment_status || "pending")}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => openDetail(p)} className="gap-1">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
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
                {/* Images */}
                {detailImages.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {detailImages.map((img: any) => (
                      <img key={img.id} src={img.image_url} alt="Property" className="rounded-lg w-full h-40 object-cover" />
                    ))}
                  </div>
                )}

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Code:</span> <span className="font-semibold">{detailProperty.property_code}</span></div>
                  <div><span className="text-muted-foreground">Region:</span> <span className="font-semibold">{detailProperty.region}, {detailProperty.area}</span></div>
                  <div><span className="text-muted-foreground">Address:</span> <span className="font-semibold">{detailProperty.address}</span></div>
                  <div><span className="text-muted-foreground">Condition:</span> <span className="font-semibold">{detailProperty.property_condition || "—"}</span></div>
                  <div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold">{detailProperty.gps_location || "—"}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> {assessmentBadge(detailProperty.assessment_status || "pending")}</div>
                </div>

                {/* Units */}
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

                {/* Approve button */}
                {(detailProperty.assessment_status || "pending") !== "approved" && (
                  <Button
                    className="w-full bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => handleApprove(detailProperty.id)}
                    disabled={approving}
                  >
                    {approving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                    Approve Assessment — Fully Assessed / Tenantable
                  </Button>
                )}
                {detailProperty.assessment_status === "approved" && (
                  <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2 text-success text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" /> This property has been assessed and approved as tenantable.
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegulatorProperties;

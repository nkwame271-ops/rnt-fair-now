import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Download, Search, MapPin, Map, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import LogoLoader from "@/components/LogoLoader";
import PropertyMap, { MapMarker } from "@/components/PropertyMap";
import { parseGPS } from "@/lib/gpsUtils";

const RegulatorProperties = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"table" | "map">("table");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("properties")
        .select("*, units(id, unit_name, unit_type, monthly_rent, status)")
        .order("created_at", { ascending: false });
      setProperties(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

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
    const headers = ["Property Code", "Name", "Address", "Region", "Area", "Units", "GPS"];
    const rows = filtered.map((p: any) => [
      p.property_code, p.property_name || "", p.address, p.region, p.area, p.units?.length || 0, p.gps_location || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "properties_export.csv"; a.click();
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
            <Button
              variant={view === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("table")}
              className="gap-1.5"
            >
              <List className="h-4 w-4" /> List
            </Button>
            <Button
              variant={view === "map" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("map")}
              className="gap-1.5"
            >
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
              <p className="text-xs text-muted-foreground mt-1">GPS locations are recorded when landlords register properties.</p>
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
                <TableHead>GPS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No properties found</TableCell></TableRow>
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
                    <TableCell className="text-xs text-muted-foreground">
                      {p.gps_location ? (
                        <span className="text-success flex items-center gap-1"><MapPin className="h-3 w-3" /> Set</span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default RegulatorProperties;

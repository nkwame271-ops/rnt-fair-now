import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Download, Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const RegulatorProperties = () => {
  const [properties, setProperties] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

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

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Property Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered properties</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, code, or region..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

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
                  <TableCell className="text-xs text-muted-foreground">{p.gps_location || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RegulatorProperties;

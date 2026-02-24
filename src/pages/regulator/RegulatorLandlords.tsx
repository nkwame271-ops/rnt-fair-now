import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const RegulatorLandlords = () => {
  const [landlords, setLandlords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("landlords")
        .select("landlord_id, status, registration_date, expiry_date, profiles(full_name, phone, email, nationality)")
        .order("created_at", { ascending: false });
      setLandlords(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = landlords.filter((l) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.landlord_id.toLowerCase().includes(s) || l.profiles?.full_name?.toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const headers = ["Landlord ID", "Name", "Phone", "Email", "Status", "Registered", "Expires"];
    const rows = filtered.map((l: any) => [
      l.landlord_id, l.profiles?.full_name || "", l.profiles?.phone || "", l.profiles?.email || "",
      l.status, l.registration_date ? new Date(l.registration_date).toLocaleDateString() : "",
      l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "landlords_export.csv"; a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Building2 className="h-7 w-7 text-primary" /> Landlord Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered landlords</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or ID..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Landlord ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No landlords found</TableCell></TableRow>
            ) : (
              filtered.map((l: any) => (
                <TableRow key={l.landlord_id}>
                  <TableCell className="font-mono text-sm font-semibold text-primary">{l.landlord_id}</TableCell>
                  <TableCell className="font-medium">{l.profiles?.full_name}</TableCell>
                  <TableCell>{l.profiles?.phone}</TableCell>
                  <TableCell>{l.profiles?.email || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${l.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>{l.status}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.expiry_date ? new Date(l.expiry_date).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RegulatorLandlords;

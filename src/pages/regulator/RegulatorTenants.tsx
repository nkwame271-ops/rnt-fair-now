import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

interface TenantRecord {
  tenant_id: string;
  status: string;
  registration_date: string | null;
  expiry_date: string | null;
  profiles: {
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string;
    is_citizen: boolean;
    ghana_card_no: string | null;
    residence_permit_no: string | null;
    occupation: string | null;
  } | null;
}

const RegulatorTenants = () => {
  const [tenants, setTenants] = useState<TenantRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("tenant_id, status, registration_date, expiry_date, profiles(full_name, phone, email, nationality, is_citizen, ghana_card_no, residence_permit_no, occupation)")
        .order("created_at", { ascending: false });
      setTenants((data as any) || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filtered = tenants.filter((t) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      t.tenant_id.toLowerCase().includes(s) ||
      t.profiles?.full_name?.toLowerCase().includes(s) ||
      t.profiles?.phone?.includes(s)
    );
  });

  const exportCSV = () => {
    const headers = ["Tenant ID", "Name", "Phone", "Email", "Nationality", "Citizen", "ID Number", "Occupation", "Status", "Registered", "Expires"];
    const rows = filtered.map((t) => [
      t.tenant_id,
      t.profiles?.full_name || "",
      t.profiles?.phone || "",
      t.profiles?.email || "",
      t.profiles?.nationality || "",
      t.profiles?.is_citizen ? "Yes" : "No",
      t.profiles?.is_citizen ? t.profiles?.ghana_card_no || "" : t.profiles?.residence_permit_no || "",
      t.profiles?.occupation || "",
      t.status,
      t.registration_date ? new Date(t.registration_date).toLocaleDateString() : "",
      t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tenants_export.csv";
    a.click();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Users className="h-7 w-7 text-primary" /> Tenant Database</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} registered tenants</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, ID, or phone..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Citizen</TableHead>
              <TableHead>Occupation</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tenants found</TableCell></TableRow>
            ) : (
              filtered.map((t) => (
                <TableRow key={t.tenant_id}>
                  <TableCell className="font-mono text-sm font-semibold text-primary">{t.tenant_id}</TableCell>
                  <TableCell className="font-medium">{t.profiles?.full_name}</TableCell>
                  <TableCell>{t.profiles?.phone}</TableCell>
                  <TableCell>{t.profiles?.is_citizen ? "🇬🇭 Yes" : "Permit"}</TableCell>
                  <TableCell>{t.profiles?.occupation || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      t.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                    }`}>{t.status}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.expiry_date ? new Date(t.expiry_date).toLocaleDateString() : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default RegulatorTenants;

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";

const RegulatorComplaints = () => {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from("complaints")
      .select("*")
      .order("created_at", { ascending: false });
    setComplaints(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchComplaints(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from("complaints").update({ status: newStatus }).eq("id", id);
    toast.success(`Complaint status updated to ${newStatus}`);
    fetchComplaints();
  };

  const filtered = complaints.filter((c) => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return c.complaint_code?.toLowerCase().includes(s) || c.landlord_name?.toLowerCase().includes(s) || c.complaint_type?.toLowerCase().includes(s);
  });

  const exportCSV = () => {
    const headers = ["Code", "Type", "Landlord", "Address", "Region", "Status", "Filed"];
    const rows = filtered.map((c: any) => [
      c.complaint_code, c.complaint_type, c.landlord_name, c.property_address, c.region, c.status,
      new Date(c.created_at).toLocaleDateString(),
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

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><AlertTriangle className="h-7 w-7 text-warning" /> Complaints</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} complaints</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
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

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Landlord</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Filed</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No complaints found</TableCell></TableRow>
            ) : (
              filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm font-semibold">{c.complaint_code}</TableCell>
                  <TableCell>{c.complaint_type}</TableCell>
                  <TableCell className="font-medium">{c.landlord_name}</TableCell>
                  <TableCell>{c.region}</TableCell>
                  <TableCell>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColors[c.status] || ""}`}>{c.status.replace("_", " ")}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Select value={c.status} onValueChange={(v) => updateStatus(c.id, v)}>
                      <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["submitted", "under_review", "in_progress", "resolved", "closed"].map((s) => (
                          <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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

export default RegulatorComplaints;

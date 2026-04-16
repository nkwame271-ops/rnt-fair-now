import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ComplaintRow {
  id: string;
  complaint_code: string;
  complaint_type: string;
  description: string;
  status: string;
  property_address: string;
  region: string;
  created_at: string;
  tenant_user_id: string;
  studentName?: string;
  school?: string;
}

const statusColor = (s: string) => {
  if (["resolved", "closed"].includes(s)) return "bg-success/10 text-success border-success/30";
  if (["submitted", "under_review", "in_progress"].includes(s)) return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground";
};

const NugsComplaints = () => {
  const [rows, setRows] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      // RLS automatically scopes to student complaints for NUGS admins
      const { data: complaints } = await supabase
        .from("complaints")
        .select("id, complaint_code, complaint_type, description, status, property_address, region, created_at, tenant_user_id")
        .order("created_at", { ascending: false });

      const userIds = [...new Set((complaints || []).map((c: any) => c.tenant_user_id))];

      const [profilesRes, tenantsRes] = await Promise.all([
        userIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
        userIds.length > 0
          ? supabase.from("tenants").select("user_id, school").in("user_id", userIds)
          : Promise.resolve({ data: [] }),
      ]);

      const nameMap: Record<string, string> = {};
      ((profilesRes as any).data || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      const schoolMap: Record<string, string> = {};
      ((tenantsRes as any).data || []).forEach((t: any) => { schoolMap[t.user_id] = t.school; });

      setRows(
        (complaints || []).map((c: any) => ({
          ...c,
          studentName: nameMap[c.tenant_user_id],
          school: schoolMap[c.tenant_user_id],
        }))
      );
      setLoading(false);
    };
    load();
  }, []);

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.complaint_code.toLowerCase().includes(q) ||
      (r.studentName || "").toLowerCase().includes(q) ||
      (r.school || "").toLowerCase().includes(q) ||
      r.property_address.toLowerCase().includes(q)
    );
  });

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-7 w-7 text-warning" /> Student Complaints
        </h1>
        <p className="text-muted-foreground mt-1">{filtered.length} complaints filed by students</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search complaints..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card rounded-xl border border-border p-5 hover:shadow-elevated transition-shadow">
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-muted-foreground">{c.complaint_code}</span>
                  <Badge variant="outline" className="text-xs">{c.complaint_type}</Badge>
                  <Badge className={`text-xs border ${statusColor(c.status)}`}>{c.status.replace(/_/g, " ")}</Badge>
                </div>
                <p className="font-semibold text-foreground">{c.studentName || "Unknown student"}</p>
                <p className="text-xs text-muted-foreground">{c.school || "—"} • {c.region}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{format(new Date(c.created_at), "MMM d, yyyy")}</span>
            </div>
            <p className="text-sm text-foreground/80 line-clamp-3">{c.description}</p>
            <p className="text-xs text-muted-foreground mt-2">📍 {c.property_address}</p>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-card rounded-xl p-8 text-center border border-border text-muted-foreground">
            No complaints found.
          </div>
        )}
      </div>
    </div>
  );
};

export default NugsComplaints;

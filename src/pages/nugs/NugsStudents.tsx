import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, GraduationCap } from "lucide-react";
import { Input } from "@/components/ui/input";

interface StudentRow {
  user_id: string;
  tenant_id: string;
  school: string | null;
  hostel_or_hall: string | null;
  room_or_bed_space: string | null;
  full_name?: string;
  phone?: string;
}

const NugsStudents = () => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: tenants } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, school, hostel_or_hall, room_or_bed_space")
        .eq("is_student", true);

      const userIds = (tenants || []).map((t: any) => t.user_id);
      let profiles: Record<string, { full_name: string; phone: string }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => {
          profiles[p.user_id] = { full_name: p.full_name, phone: p.phone };
        });
      }
      setRows(
        (tenants || []).map((t: any) => ({
          ...t,
          full_name: profiles[t.user_id]?.full_name,
          phone: profiles[t.user_id]?.phone,
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
      (r.full_name || "").toLowerCase().includes(q) ||
      (r.school || "").toLowerCase().includes(q) ||
      (r.hostel_or_hall || "").toLowerCase().includes(q) ||
      r.tenant_id.toLowerCase().includes(q)
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
          <GraduationCap className="h-7 w-7 text-primary" /> Registered Students
        </h1>
        <p className="text-muted-foreground mt-1">{filtered.length} students on the platform</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, school, hostel..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Tenant ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">School</th>
                <th className="px-4 py-3 text-left">Hostel / Hall</th>
                <th className="px-4 py-3 text-left">Room / Bed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">{r.tenant_id}</td>
                  <td className="px-4 py-3">{r.full_name || "—"}</td>
                  <td className="px-4 py-3">{r.school || "—"}</td>
                  <td className="px-4 py-3">{r.hostel_or_hall || "—"}</td>
                  <td className="px-4 py-3">{r.room_or_bed_space || "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default NugsStudents;

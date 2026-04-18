import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2 } from "lucide-react";

interface InstitutionRow {
  school: string;
  studentCount: number;
  hostels: Set<string>;
}

const NugsInstitutions = () => {
  const [rows, setRows] = useState<InstitutionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("school, hostel_or_hall")
        .eq("is_student", true);

      const map = new Map<string, { count: number; hostels: Set<string> }>();
      (data || []).forEach((t: any) => {
        const school = (t.school || "Unspecified").trim();
        if (!map.has(school)) map.set(school, { count: 0, hostels: new Set() });
        const entry = map.get(school)!;
        entry.count++;
        if (t.hostel_or_hall) entry.hostels.add(t.hostel_or_hall);
      });

      const out: InstitutionRow[] = Array.from(map.entries())
        .map(([school, v]) => ({ school, studentCount: v.count, hostels: v.hostels }))
        .sort((a, b) => b.studentCount - a.studentCount);
      setRows(out);
      setLoading(false);
    };
    load();
  }, []);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-7 w-7 text-primary" /> Institutions Represented
        </h1>
        <p className="text-muted-foreground mt-1">{rows.length} institutions on the platform</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => (
          <div key={r.school} className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-2 truncate">{r.school}</h3>
            <p className="text-3xl font-bold text-primary">{r.studentCount}</p>
            <p className="text-xs text-muted-foreground">students</p>
            <p className="text-xs text-muted-foreground mt-3">{r.hostels.size} hostels / halls</p>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="col-span-full bg-card rounded-xl p-8 text-center border border-border text-muted-foreground">
            No institutions registered yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default NugsInstitutions;

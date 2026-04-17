import { useEffect, useState } from "react";
import { Loader2, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ResidenceRow {
  id: string;
  school: string | null;
  hostel_or_hall: string | null;
  room_or_bed_space: string | null;
  effective_from: string;
  effective_to: string | null;
  change_reason: string | null;
}

interface Props {
  tenantUserId: string;
  compact?: boolean;
}

const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Present";

const StudentResidenceTrail = ({ tenantUserId, compact }: Props) => {
  const [rows, setRows] = useState<ResidenceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await (supabase.from("student_residence_history") as any)
        .select("id, school, hostel_or_hall, room_or_bed_space, effective_from, effective_to, change_reason")
        .eq("tenant_user_id", tenantUserId)
        .order("effective_from", { ascending: false });
      if (!active) return;
      setRows((data || []) as ResidenceRow[]);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [tenantUserId]);

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading residence history…</div>;
  if (rows.length === 0) return <p className="text-xs text-muted-foreground italic">No residence history on record.</p>;

  return (
    <ol className={`relative border-l border-border ${compact ? "pl-4 space-y-2" : "pl-5 space-y-3"}`}>
      {rows.map((r, idx) => {
        const current = r.effective_to == null;
        return (
          <li key={r.id} className="relative">
            <span className={`absolute -left-[7px] top-1.5 h-3 w-3 rounded-full border-2 border-background ${current ? "bg-success" : "bg-muted-foreground/40"}`} />
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <MapPin className={`h-3.5 w-3.5 ${current ? "text-success" : "text-muted-foreground"}`} />
              <span className="font-semibold text-foreground">{r.hostel_or_hall || "—"}</span>
              {r.room_or_bed_space && <span className="text-muted-foreground">· {r.room_or_bed_space}</span>}
              {current && <span className="text-[10px] font-semibold uppercase tracking-wide bg-success/10 text-success px-1.5 py-0.5 rounded">Current</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {r.school || "Institution not set"}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" /> {fmt(r.effective_from)} – {fmt(r.effective_to)}
              {r.change_reason && <span className="ml-2 italic">— {r.change_reason}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default StudentResidenceTrail;

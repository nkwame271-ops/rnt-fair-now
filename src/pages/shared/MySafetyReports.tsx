import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SAFETY_STATUS_LABELS, SEVERITY_COLORS } from "@/lib/safetyCategories";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

const MySafetyReports = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("safety_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setReports(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const markSafe = async (id: string) => {
    const { error } = await supabase
      .from("safety_reports")
      .update({ user_marked_safe_at: new Date().toISOString(), status: "resolved" })
      .eq("id", id);
    if (error) return toast.error("Failed to update");
    await supabase.from("safety_audit_log").insert({
      report_id: id,
      actor_user_id: user!.id,
      action: "marked_safe",
    });
    toast.success("Marked safe — thank you");
    load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Safety Reports</h1>
      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && reports.length === 0 && (
        <p className="text-sm text-muted-foreground">No reports submitted.</p>
      )}
      <div className="space-y-3">
        {reports.map((r) => (
          <Card key={r.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span>{r.ticket_number}</span>
                <Badge className={SEVERITY_COLORS[r.severity] ?? ""}>
                  {r.severity}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>{r.report_kind === "panic_emergency" ? "🚨 Panic Emergency" : "Safety Report"}</strong>
                {r.category && <> · {r.category.replace(/_/g, " ")}</>}
                {r.emergency_type && <> · {r.emergency_type}</>}
              </p>
              {r.description && <p className="text-muted-foreground">{r.description}</p>}
              <p className="text-xs text-muted-foreground">
                Status: <Badge variant="outline">{SAFETY_STATUS_LABELS[r.status] ?? r.status}</Badge>
              </p>
              {!r.user_marked_safe_at && ["submitted", "acknowledged", "under_review", "escalated"].includes(r.status) && (
                <Button size="sm" onClick={() => markSafe(r.id)}>
                  <ShieldCheck className="h-4 w-4 mr-1" /> I Am Safe Now
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MySafetyReports;

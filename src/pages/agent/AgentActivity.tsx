import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollText } from "lucide-react";
import Seo from "@/components/Seo";
import EmptyState from "@/components/EmptyState";

const AgentActivity = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("agent_action_log")
      .select("*")
      .eq("agent_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }: any) => {
        setRows(data || []);
        setLoading(false);
      });
  }, [user]);

  return (
    <div className="space-y-6">
      <Seo title="My Activity | Agent" description="Every action you take on assigned accounts is logged here for transparency." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><ScrollText className="h-6 w-6" /> My Activity Log</h1>
        <p className="text-muted-foreground mt-1">Every action you take on behalf of a landlord or tenant appears here, with timestamp and target.</p>
      </div>
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Once you start acting on assigned accounts, entries will appear here." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {rows.map((r) => (
            <div key={r.id} className="p-4 text-sm">
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.action}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    Target: {r.target_table || "—"} {r.target_record_id ? `· ${r.target_record_id.slice(0, 8)}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentActivity;

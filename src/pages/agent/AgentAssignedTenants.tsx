import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";
import Seo from "@/components/Seo";
import EmptyState from "@/components/EmptyState";

const AgentAssignedTenants = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("agent_assignments")
        .select("owner_user_id, scope_notes")
        .eq("agent_user_id", user.id)
        .eq("owner_role", "tenant")
        .eq("active", true);
      const owners = data || [];
      if (owners.length) {
        const { data: profiles } = await supabase
          .from("profiles").select("user_id, full_name, phone")
          .in("user_id", owners.map((o: any) => o.owner_user_id));
        const map = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        setRows(owners.map((o: any) => ({ ...o, profile: map.get(o.owner_user_id) })));
      }
      setLoading(false);
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <Seo title="Assigned Tenants | Agent" description="Tenants you manage on their behalf." />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><Users className="h-6 w-6" /> Assigned Students / Tenants</h1>
        <p className="text-muted-foreground mt-1">Tenancy information, payments, complaints, and documents for tenants you support.</p>
      </div>
      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="No tenants assigned yet" description="An admin will assign tenants who opt in to your Premium Service support." />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.owner_user_id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{r.profile?.full_name || "Tenant"}</p>
                <p className="text-xs text-muted-foreground">{r.profile?.phone || r.owner_user_id.slice(0, 8)}</p>
              </div>
              <button className="text-xs text-primary font-semibold hover:underline" disabled>
                Open workspace →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AgentAssignedTenants;

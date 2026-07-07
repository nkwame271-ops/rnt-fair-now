import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Building2, Users, ClipboardCheck, ShieldCheck } from "lucide-react";
import Seo from "@/components/Seo";

const AgentDashboard = () => {
  const { user } = useAuth();
  const [name, setName] = useState<string>("");
  const [stats, setStats] = useState({ landlords: 0, tenants: 0, tasks: 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: staff } = await (supabase as any)
        .from("agent_staff").select("full_name").eq("user_id", user.id).maybeSingle();
      if (staff?.full_name) setName(staff.full_name);

      const { data: assignments } = await (supabase as any)
        .from("agent_assignments")
        .select("owner_role")
        .eq("agent_user_id", user.id)
        .eq("active", true);
      const list = assignments || [];
      setStats({
        landlords: list.filter((a: any) => a.owner_role === "landlord").length,
        tenants: list.filter((a: any) => a.owner_role === "tenant").length,
        tasks: 0,
      });
    })();
  }, [user]);

  const firstName = name.split(" ")[0] || "Agent";
  const cards = [
    { label: "Assigned Hostels / Landlords", value: stats.landlords, icon: Building2 },
    { label: "Assigned Students / Tenants", value: stats.tenants, icon: Users },
    { label: "Pending Tasks", value: stats.tasks, icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-6">
      <Seo title="Agent Portal | Rent Control" description="Manage hostels and tenants assigned to you under Premium Service." />
      <div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Welcome, {firstName}</h1>
        <p className="text-muted-foreground mt-2">Manage the hostels and tenants assigned to you under Premium Service.</p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{c.label}</p>
              <p className="text-4xl font-extrabold mt-2">{c.value}</p>
            </div>
            <c.icon className="h-8 w-8 text-destructive/70" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Getting started</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Select <strong>Assigned Hostels</strong> or <strong>Assigned Students</strong> to enter a controlled account workspace. All actions you perform are recorded for audit and appear normally in the account holder's dashboard.
        </p>
      </div>
    </div>
  );
};

export default AgentDashboard;

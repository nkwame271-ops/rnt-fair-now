import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle } from "lucide-react";
import Seo from "@/components/Seo";

const AgentProfile = () => {
  const { user } = useAuth();
  const [staff, setStaff] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("agent_staff").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }: any) => setStaff(data));
  }, [user]);

  return (
    <div className="space-y-6">
      <Seo title="Agent Profile" description="Your Premium Service Agent profile." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2"><UserCircle className="h-6 w-6" /> My Profile</h1>
      </div>
      {!staff ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 flex gap-4 items-start">
          <div className="w-20 h-20 rounded-full bg-muted overflow-hidden flex items-center justify-center">
            {staff.professional_photo_url ? (
              <img src={staff.professional_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <UserCircle className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-lg font-bold">{staff.full_name}</p>
            <p className="text-sm text-muted-foreground">{staff.email} · {staff.phone}</p>
            <p className="text-sm">Region: {staff.region || "—"}</p>
            <p className="text-sm">Operating area: {staff.operating_area || "—"}</p>
            <span className="inline-block mt-2 text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-semibold uppercase">
              {staff.status}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentProfile;

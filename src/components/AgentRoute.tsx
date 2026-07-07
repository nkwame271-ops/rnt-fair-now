import { Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import LogoLoader from "@/components/LogoLoader";

interface AgentRouteProps {
  children: React.ReactNode;
}

/** Gate for the Premium Service Agent Portal. Requires an active agent_staff row. */
const AgentRoute = ({ children }: AgentRouteProps) => {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isAgent, setIsAgent] = useState(false);

  useEffect(() => {
    if (!user) {
      setChecking(false);
      return;
    }
    (supabase as any)
      .from("agent_staff")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        setIsAgent(!!data && data.status === "active");
        setChecking(false);
      });
  }, [user]);

  if (loading || checking) return <LogoLoader message="Loading agent portal..." />;
  if (!user) return <Navigate to="/login?redirect=/agent" replace />;
  if (!isAgent) return <Navigate to="/agent/register" replace />;
  return <>{children}</>;
};

export default AgentRoute;

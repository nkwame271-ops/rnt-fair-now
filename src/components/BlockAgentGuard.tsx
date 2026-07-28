import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import LogoLoader from "@/components/LogoLoader";
import { toast } from "sonner";

interface Props {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Blocks users who are active agents from accessing sensitive landlord
 * account settings (payment settings, payout accounts, password/PIN changes,
 * verified phone/email). Agents managing a landlord's property must not be
 * able to alter the landlord's own account or payment destinations.
 */
const BlockAgentGuard = ({ children, redirectTo = "/landlord/dashboard" }: Props) => {
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
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }: any) => {
        const blocked = !!data;
        setIsAgent(blocked);
        setChecking(false);
        if (blocked) {
          toast.error("Agents cannot modify landlord account or payment settings.");
        }
      });
  }, [user]);

  if (loading || checking) return <LogoLoader message="Checking access..." />;
  if (isAgent) return <Navigate to={redirectTo} replace />;
  return <>{children}</>;
};

export default BlockAgentGuard;

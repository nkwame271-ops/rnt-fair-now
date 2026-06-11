import { Navigate, useLocation, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ShieldOff } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DeveloperRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ["developer-route-org", user?.id],
    enabled: !!user?.id && role === "developer",
    queryFn: async () => {
      const { data } = await supabase
        .from("developer_organizations")
        .select("account_status, status_reason, name")
        .eq("owner_user_id", user!.id)
        .maybeSingle();
      return data as { account_status: string; status_reason: string | null; name: string } | null;
    },
  });

  if (loading || (role === "developer" && orgLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/developers/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (role !== "developer" && role !== "regulator") {
    return <Navigate to="/developers" replace />;
  }

  if (role === "developer" && org && org.account_status !== "active") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Alert className="max-w-lg">
          <ShieldOff className="h-4 w-4" />
          <AlertTitle>
            Account {org.account_status === "suspended" ? "suspended" : "revoked"}
          </AlertTitle>
          <AlertDescription className="space-y-2">
            <p>
              Your developer account ({org.name}) has been {org.account_status} by an administrator.
              All API keys have been disabled.
            </p>
            {org.status_reason && <p className="text-sm"><strong>Reason:</strong> {org.status_reason}</p>}
            <p className="text-sm">
              Contact <a className="underline" href="mailto:api@rentcontrolghana.com">api@rentcontrolghana.com</a> to appeal.
            </p>
            <p className="pt-2"><Link to="/developers" className="text-sm underline">Back to developer home</Link></p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
}

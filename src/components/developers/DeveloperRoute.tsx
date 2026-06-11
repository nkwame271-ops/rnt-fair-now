import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export default function DeveloperRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
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

  return <>{children}</>;
}

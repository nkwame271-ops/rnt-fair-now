import { useLocation, useNavigate } from "react-router-dom";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAdminProfile, getFeatureKeyForRoute } from "@/hooks/useAdminProfile";

/**
 * Wraps the regulator outlet to enforce per-route feature access for Sub Admins.
 * Super Admins, Main Admins (and unscoped legacy users) bypass.
 * Sub Admins must have the route's feature key in `allowedFeatures` (dashboard always allowed).
 */
const FeatureGuard = ({ children }: { children: React.ReactNode }) => {
  const { profile, loading } = useAdminProfile();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading || !profile) return <>{children}</>;
  if (profile.isSuperAdmin || profile.isMainAdmin) return <>{children}</>;

  // Match route — strip trailing segments to find the base nav route
  const path = location.pathname;
  const featureKey = getFeatureKeyForRoute(path)
    || getFeatureKeyForRoute("/" + path.split("/").slice(1, 3).join("/"));

  if (featureKey === "dashboard") return <>{children}</>;

  if (!featureKey) {
    // Unknown sub-route — allow if any parent matches an allowed feature
    const allowed = profile.allowedFeatures.some(k => {
      const routes = (k && (path.includes(k.replace(/_/g, "-")) || path.includes(k))) || false;
      return routes;
    });
    if (allowed) return <>{children}</>;
  } else if (profile.allowedFeatures.includes(featureKey) && !profile.mutedFeatures.includes(featureKey)) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-card-foreground">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-1">
            This feature isn't enabled for your account. Contact your Main Admin to request access.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/regulator/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default FeatureGuard;

import { useKycStatus } from "@/hooks/useKycStatus";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface KycGateProps {
  children: React.ReactNode;
  action?: string; // e.g. "list a property", "apply for viewing"
}

const KycGate = ({ children, action = "perform this action" }: KycGateProps) => {
  const { role } = useAuth();
  const { kycStatus, loading } = useKycStatus();

  // Regulators bypass KYC
  if (role === "regulator") return <>{children}</>;

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (kycStatus !== "verified") {
    const profilePath = role === "tenant" ? "/tenant/profile" : "/landlord/profile";
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
          <Shield className="h-8 w-8 text-warning" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Ghana Card Verification Required</h2>
        <p className="text-muted-foreground">
          You must verify your Ghana Card before you can {action}. 
          {kycStatus === "pending" && " Your verification is currently being reviewed."}
          {kycStatus === "rejected" && " Your previous submission was rejected. Please resubmit."}
        </p>
        <Button asChild>
          <Link to={profilePath}>
            <Shield className="h-4 w-4 mr-2" />
            {kycStatus === "none" ? "Verify Ghana Card" : kycStatus === "pending" ? "Check Status" : "Resubmit Verification"}
          </Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
};

export default KycGate;

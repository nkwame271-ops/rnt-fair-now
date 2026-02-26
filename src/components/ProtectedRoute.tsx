import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CreditCard, Shield, FileText, Store, AlertTriangle, CheckCircle2, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "tenant" | "landlord" | "regulator";
}

const registrationBenefits = [
  { icon: Store, label: "Marketplace access" },
  { icon: IdCard, label: "Tenant or Landlord ID card" },
  { icon: CreditCard, label: "Rent card" },
  { icon: AlertTriangle, label: "Complaint system" },
  { icon: FileText, label: "Tenancy agreement management" },
  { icon: Shield, label: "12-month platform access" },
];

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth();
  const [checkingFee, setCheckingFee] = useState(true);
  const [feePaid, setFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);

  useEffect(() => {
    if (!user || !role || role === "regulator") {
      setCheckingFee(false);
      return;
    }

    const checkRegistration = async () => {
      const table = role === "tenant" ? "tenants" : "landlords";
      const { data } = await supabase
        .from(table)
        .select("registration_fee_paid")
        .eq("user_id", user.id)
        .maybeSingle();

      setFeePaid(data?.registration_fee_paid ?? false);
      setCheckingFee(false);
    };

    checkRegistration();

    // Check on return from payment
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      toast.success("Payment processing! It may take a moment to confirm.");
      window.history.replaceState({}, "", window.location.pathname);
      // Re-check after delay
      setTimeout(() => checkRegistration(), 3000);
    }
  }, [user, role]);

  if (loading || checkingFee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Block dashboard access if registration fee not paid (except regulators)
  if (role !== "regulator" && !feePaid) {
    const paymentType = role === "tenant" ? "tenant_registration" : "landlord_registration";
    const roleLabel = role === "tenant" ? "Tenant" : "Landlord";

    const handlePay = async () => {
      setPayingFee(true);
      try {
        const { data, error } = await supabase.functions.invoke("paystack-checkout", {
          body: { type: paymentType },
        });
        if (error) throw new Error(error.message || "Payment initiation failed");
        if (data?.error) throw new Error(data.error);
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error("No checkout URL received");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to initiate payment");
        setPayingFee(false);
      }
    };

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-warning" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Registration Payment Required</h1>
            <p className="text-muted-foreground mt-2">
              Complete your {roleLabel} registration by paying the annual fee to access the platform.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Registration Fee</p>
              <p className="text-3xl font-extrabold text-primary">GH₵ 2.00</p>
              <p className="text-xs text-muted-foreground">Per year</p>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Registration Fee Covers:</p>
              <ul className="space-y-2">
                {registrationBenefits.map((b) => (
                  <li key={b.label} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    {b.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Button onClick={handlePay} disabled={payingFee} className="w-full h-12 text-base font-semibold">
            <CreditCard className="mr-2 h-5 w-5" />
            {payingFee ? "Redirecting to payment..." : "Pay GH₵ 2 & Activate Account"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your account will be fully activated once payment is confirmed.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

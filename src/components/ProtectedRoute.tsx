import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFeeConfig } from "@/hooks/useFeatureFlag";
import { Loader2, CreditCard, Shield, CheckCircle2, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "tenant" | "landlord" | "regulator";
}

const registrationBenefits = [
  { icon: IdCard, label: "Tenant or Landlord ID card" },
  { icon: Shield, label: "12-month platform access" },
];

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { user, loading, role } = useAuth();
  const feeKey = role === "tenant" ? "tenant_registration_fee" : "landlord_registration_fee";
  const { amount: regFee, enabled: regFeeEnabled } = useFeeConfig(feeKey);
  const [checkingFee, setCheckingFee] = useState(true);
  const [feePaid, setFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [accountStatus, setAccountStatus] = useState<string>("active");
  const [verifying, setVerifying] = useState(false);

  const [hasRegistrationDate, setHasRegistrationDate] = useState(false);

  const checkRegistration = useCallback(async (userId: string, userRole: string) => {
    const table = userRole === "tenant" ? "tenants" : "landlords";
    const { data } = await supabase
      .from(table)
      .select("registration_fee_paid, registration_date, account_status")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.registration_date) setHasRegistrationDate(true);
    if (data?.account_status) setAccountStatus(data.account_status);
    return data?.registration_fee_paid ?? false;
  }, []);

  useEffect(() => {
    if (!user || !role || role === "regulator") {
      setCheckingFee(false);
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("trxref") || params.get("reference");
    const isPaymentReturn = !!ref || params.get("status") === "success";

    const run = async () => {
      // Quick check first
      const paid = await checkRegistration(user.id, role);
      if (paid) {
        setFeePaid(true);
        setCheckingFee(false);
        if (isPaymentReturn) {
          toast.success("Payment confirmed! Welcome.");
          window.history.replaceState({}, "", window.location.pathname);
        }
        return;
      }

      // If returning from payment with a reference, verify server-side
      if (ref) {
        setVerifying(true);
        setCheckingFee(false);
        window.history.replaceState({}, "", window.location.pathname);

        try {
          const { data: verifyResult } = await supabase.functions.invoke("verify-payment", {
            body: { reference: ref },
          });

          if (verifyResult?.verified) {
            setFeePaid(true);
            setVerifying(false);
            toast.success("Payment confirmed! Welcome.");
            return;
          }
        } catch (e) {
          console.error("Verify payment error:", e);
        }

        // Fallback: poll DB a few times in case webhook arrives
        let attempts = 0;
        const interval = setInterval(async () => {
          attempts++;
          const nowPaid = await checkRegistration(user.id, role);
          if (nowPaid) {
            clearInterval(interval);
            setFeePaid(true);
            setVerifying(false);
            toast.success("Payment confirmed! Welcome.");
          } else if (attempts >= 6) {
            clearInterval(interval);
            setVerifying(false);
            setFeePaid(false);
          }
        }, 3000);

        return () => clearInterval(interval);
      }

      // No payment return — just show paywall
      if (isPaymentReturn) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      setFeePaid(false);
      setCheckingFee(false);
    };

    run();
  }, [user, role, checkRegistration]);

  if (loading || checkingFee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  if (requiredRole && role !== requiredRole) return <Navigate to="/" replace />;

  // Verifying payment with server
  if (verifying) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verifying Your Payment</h1>
          <p className="text-muted-foreground">
            We're confirming your registration payment with the payment provider. This usually takes a few seconds...
          </p>
          <div className="h-2 bg-muted rounded-full overflow-hidden max-w-xs mx-auto">
            <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: "60%" }} />
          </div>
        </div>
      </div>
    );
  }

  // Block dashboard if fee not paid (but skip if fee is disabled)
  if (role !== "regulator" && !feePaid && !hasRegistrationDate && regFeeEnabled) {
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
        if (data?.skipped) {
          setFeePaid(true);
          toast.success("Registration fee waived! Welcome.");
          return;
        }
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
              <p className="text-3xl font-extrabold text-primary">GH₵ {regFee.toFixed(2)}</p>
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
            {payingFee ? "Redirecting to payment..." : `Pay GH₵ ${regFee.toFixed(0)} & Activate Account`}
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

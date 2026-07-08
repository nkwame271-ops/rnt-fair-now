import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Seo from "@/components/Seo";

const AssessmentConfirm = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference =
    params.get("reference") ||
    params.get("trxref") ||
    (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("pendingPaymentReference") : null);
  const [state, setState] = useState<"verifying" | "success" | "failed">("verifying");
  const [message, setMessage] = useState("Verifying your payment...");

  useEffect(() => {
    (async () => {
      if (!reference) { setState("failed"); setMessage("Missing payment reference."); return; }
      try {
        const { data, error } = await supabase.functions.invoke("assessment-verify", {
          body: { reference },
        });
        if (error) throw error;
        if ((data as any)?.verified) {
          setState("success");
          setMessage("Payment confirmed. Your assessment request is now in the queue.");
          try { sessionStorage.removeItem("pendingPaymentReference"); } catch { /* noop */ }
        } else {
          setState("failed");
          setMessage("We could not confirm your payment. If money was debited, refresh in a moment.");
        }
      } catch (e: any) {
        setState("failed");
        setMessage(e.message || "Verification failed");
      }
    })();
  }, [reference]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Seo title="Assessment Payment | Rent Control" description="Confirming your property assessment payment." canonicalPath="/assessments/confirm" />
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
        {state === "verifying" && <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />}
        {state === "success" && <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />}
        {state === "failed" && <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />}
        <h1 className="text-xl font-bold mt-4">
          {state === "verifying" ? "Verifying..." : state === "success" ? "Payment Confirmed" : "Verification Failed"}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => navigate(-1)}>Back to Assessments</Button>
          <Button variant="ghost" onClick={() => navigate("/")}>Home</Button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentConfirm;

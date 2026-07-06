import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Status = "verifying" | "success" | "failed";

export default function PaymentConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("ref") || "";
  const next = params.get("next") || "";
  const [status, setStatus] = useState<Status>("verifying");
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    if (!reference) { setStatus("failed"); return; }
    let cancelled = false;
    const attempt = async (tries: number) => {
      for (let i = 0; i < tries; i++) {
        try {
          const { data } = await supabase.functions.invoke("verify-payment", {
            body: { reference },
          });
          if (cancelled) return;
          if ((data as any)?.verified || (data as any)?.status === "completed") {
            setDetails(data);
            setStatus("success");
            return;
          }
        } catch { /* retry */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setStatus("failed");
    };
    attempt(6);
    return () => { cancelled = true; };
  }, [reference]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle>Payment confirmation</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verifying" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Confirming your payment securely…</p>
              <p className="font-mono text-xs">{reference}</p>
            </div>
          )}
          {status === "success" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-4">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <p className="text-lg font-semibold">Payment received</p>
                <p className="text-sm text-muted-foreground">
                  Thank you. Your payment to Rent Control Ghana has been confirmed.
                </p>
                <p className="font-mono text-xs">{reference}</p>
              </div>
              <Button className="w-full" onClick={() => navigate(next || "/")}>
                Continue
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                Secure payment powered by our licensed payment partner.
              </p>
            </div>
          )}
          {status === "failed" && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2 py-4">
                <XCircle className="h-12 w-12 text-destructive" />
                <p className="text-lg font-semibold">We couldn't confirm this payment</p>
                <p className="text-sm text-muted-foreground text-center">
                  If you were charged, your account will update automatically within a few minutes.
                </p>
                <p className="font-mono text-xs">{reference}</p>
              </div>
              <Button className="w-full" variant="outline" onClick={() => navigate(next || "/")}>
                Back
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

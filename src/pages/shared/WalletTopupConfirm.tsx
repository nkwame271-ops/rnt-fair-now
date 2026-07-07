import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function WalletTopupConfirm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("ref") || "";
  const [status, setStatus] = useState<"verifying" | "success" | "failed">("verifying");
  const [amount, setAmount] = useState<number | null>(null);

  useEffect(() => {
    if (!reference) { setStatus("failed"); return; }
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 6; i++) {
        try {
          const { data } = await supabase.functions.invoke("wallet-topup-verify", { body: { reference } });
          if (cancelled) return;
          if ((data as any)?.verified) {
            setAmount((data as any).amount ?? null);
            setStatus("success");
            return;
          }
        } catch { /* retry */ }
        await new Promise(r => setTimeout(r, 2000));
      }
      if (!cancelled) setStatus("failed");
    })();
    return () => { cancelled = true; };
  }, [reference]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Wallet Top-up</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4 pt-2">
          {status === "verifying" && <><Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" /><p>Confirming your payment…</p></>}
          {status === "success" && <>
            <CheckCircle2 className="h-14 w-14 mx-auto text-primary" />
            <div>
              <p className="text-lg font-bold">Top-up successful</p>
              {amount != null && <p className="text-sm text-muted-foreground mt-1">GHS {amount.toFixed(2)} added to your wallet.</p>}
            </div>
            <Button className="w-full" onClick={() => navigate(-1)}>Back to Wallet</Button>
          </>}
          {status === "failed" && <>
            <XCircle className="h-14 w-14 mx-auto text-destructive" />
            <p className="font-semibold">We couldn't confirm your top-up yet.</p>
            <p className="text-xs text-muted-foreground">If money was debited it will reflect shortly.</p>
            <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>Go Back</Button>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}

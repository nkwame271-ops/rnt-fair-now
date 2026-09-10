import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Loader2, ShieldCheck, Lock, Info, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  onBrandedCheckoutOpen,
  loadPaystackInline,
  hasBrandedCheckoutDetails,
  isCheckoutSessionConsumed,
  markCheckoutSessionConsumed,
  type BrandedCheckoutPayload,
} from "@/lib/payments/brandedCheckout";


const PLATFORM_NAME = "Rent Control Ghana";

const withReference = (path: string, reference: string) => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}ref=${encodeURIComponent(reference)}`;
};

export default function BrandedCheckoutHost() {
  const navigate = useNavigate();
  const [payload, setPayload] = useState<BrandedCheckoutPayload | null>(null);
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hostedFallback, setHostedFallback] = useState(false);
  const openingRef = useRef(false);

  useEffect(() => onBrandedCheckoutOpen((p) => {
    setPayload(p);
    setProcessing(false);
    setErrorMsg(null);
    setHostedFallback(false);
    openingRef.current = false;
  }), []);

  const close = () => { if (!processing) { setPayload(null); setErrorMsg(null); setHostedFallback(false); } };

  const expired = !!(payload as (BrandedCheckoutPayload & { expired?: boolean }) | null)?.expired;

  const pay = async () => {
    if (!payload || expired || openingRef.current) return;
    openingRef.current = true;
    let snapshot = payload;
    setProcessing(true);
    setErrorMsg(null);
    setHostedFallback(false);
    const reportCheckoutError = (stage: string, message: string, reference = snapshot.reference) => {
      void import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.functions.invoke("report-checkout-error", {
          body: {
            reference,
            stage,
            message,
            context: {
              userAgent: navigator.userAgent.slice(0, 500),
              viewport: `${window.innerWidth}x${window.innerHeight}`,
              online: navigator.onLine,
            },
          },
        }),
      ).catch(() => undefined);
    };
    const finishPayment = (reference?: string) => {
      const confirmedReference = reference || snapshot.reference;
      const path = snapshot.confirmationPath
        ? withReference(snapshot.confirmationPath, confirmedReference)
        : `/payments/confirm?ref=${encodeURIComponent(confirmedReference)}` +
          (snapshot.callbackPath ? `&next=${encodeURIComponent(snapshot.callbackPath)}` : "");
      setPayload(null);
      setProcessing(false);
      openingRef.current = false;
      navigate(path);
    };
    // A payment session (access code) can only be opened once. If the window
    // was closed or errored we must mint a NEW session for the retry —
    // resuming the spent one fails with "Unable to process transaction".
    const reopenForRetry = (msg?: string) => {
      setTimeout(async () => {
        let next: BrandedCheckoutPayload | null = null;
        if (snapshot.refresh) {
          try {
            const fresh = await snapshot.refresh();
            if (fresh?.reference) next = { ...fresh, refresh: snapshot.refresh };
          } catch (e) {
            console.warn("Checkout refresh failed:", e);
          }
        }
        setProcessing(false);
        openingRef.current = false;
        if (next) {
          if (msg) setErrorMsg(msg);
          setPayload(next);
          return;
        }
        setErrorMsg(
          (msg ? `${msg} ` : "") +
            "This payment session has closed. Please start the payment again from the previous screen.",
        );
        setPayload({ ...snapshot, access_code: undefined, expired: true } as BrandedCheckoutPayload & { expired: boolean });
      }, 50);
    };
    try {
      // A session (access code) is single use and also goes stale while the
      // payer reads this panel. Mint a brand-new one right now, at the moment
      // the window is about to open, whenever we know how to.
      if (snapshot.refresh) {
        try {
          const fresh = await snapshot.refresh();
          if (fresh?.reference && !isCheckoutSessionConsumed(fresh.access_code)) {
            snapshot = { ...fresh, refresh: snapshot.refresh };
            setPayload(snapshot);
          }
        } catch (e) {
          console.warn("Could not mint a fresh payment session:", e);
          // Fall through: an existing unused session may still work.
        }
      }
      if (isCheckoutSessionConsumed(snapshot.access_code)) {
        throw new Error("This payment session has already been used.");
      }
      if (!hasBrandedCheckoutDetails(snapshot)) {
        throw new Error("Secure checkout details are incomplete. Please try again.");
      }
      await loadPaystackInline();
      const PaystackPop = window.PaystackPop;
      if (!PaystackPop || !snapshot.publicKey) {
        throw new Error("Secure payment is temporarily unavailable. Please try again.");
      }

      // CRITICAL: close our Radix Dialog before opening the provider popup.
      // Leaving it mounted traps focus / swallows taps on mobile, so the
      // payment-method options (Card / Mobile Money / Bank) become unclickable.
      setPayload(null);
      markCheckoutSessionConsumed(snapshot.access_code);


      if (snapshot.access_code && typeof PaystackPop === "function") {
        const popup = new PaystackPop();
        popup.resumeTransaction(snapshot.access_code, {
          onSuccess: (r: { reference?: string; trxref?: string }) => finishPayment(r.reference || r.trxref),
          onCancel: () => {
            reportCheckoutError("inline_cancel", "Payment window closed before completion");
            toast("Payment window closed. You can retry any time.");
            reopenForRetry();
          },
          onError: (error: { message?: string } | Error) => {
            const msg = error?.message || "Could not start secure payment";
            reportCheckoutError("inline_error", msg);
            toast.error(msg);
            setProcessing(false);
            openingRef.current = false;
            setErrorMsg(`${msg} Use the secure checkout page below to continue with this payment.`);
            setHostedFallback(Boolean(snapshot.authorization_url));
            setPayload(snapshot);
          },
        });
        return;
      }

      const legacyInline = PaystackPop as {
        setup?: (opts: {
          key: string;
          email: string;
          amount: number;
          currency?: string;
          ref: string;
          callback: (r: { reference: string }) => void;
          onClose: () => void;
        }) => { openIframe: () => void };
      };
      if (!legacyInline.setup) {
        throw new Error("Secure payment module could not open this transaction.");
      }
      let completed = false;
      const handler = legacyInline.setup({
        key: snapshot.publicKey,
        email: snapshot.email,
        amount: Math.round(snapshot.amount * 100),
        currency: snapshot.currency || "GHS",
        ref: snapshot.reference,
        callback: (r) => { completed = true; finishPayment(r.reference); },
        onClose: () => {
          if (completed) return;
          reportCheckoutError("inline_cancel", "Payment window closed before completion");
          toast("Payment window closed. You can retry any time.");
          reopenForRetry();
        },
      });
      handler.openIframe();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not start secure payment";
      reportCheckoutError("inline_open", msg);
      toast.error(msg);
      setProcessing(false);
      openingRef.current = false;
      if (snapshot.authorization_url) {
        setErrorMsg(`${msg} Use the secure checkout page below to continue with this payment.`);
        setHostedFallback(true);
        setPayload(snapshot);
      } else {
        reopenForRetry(msg);
      }
    }
  };

  const openHostedCheckout = () => {
    if (!payload?.authorization_url) return;
    void import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase.functions.invoke("report-checkout-error", {
        body: {
          reference: payload.reference,
          stage: "hosted_fallback",
          message: "User continued through hosted checkout after inline failure",
          context: { viewport: `${window.innerWidth}x${window.innerHeight}`, online: navigator.onLine },
        },
      }),
    ).catch(() => undefined);
    window.location.assign(payload.authorization_url);
  };

  const amountLabel = payload
    ? `GHS ${payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";

  return (
    <Dialog open={!!payload} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <DialogTitle>Secure payment</DialogTitle>
          </div>
          <DialogDescription>
            Review the details below and confirm to complete your payment
            securely inside {PLATFORM_NAME}.
          </DialogDescription>
        </DialogHeader>

        {payload && (
          <div className="space-y-4">
            {errorMsg && (
              <Alert variant="destructive" role="alert" aria-live="assertive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Secure payment could not start</AlertTitle>
                <AlertDescription>
                  {errorMsg} If the problem persists, please try a different
                  payment method or contact support.
                </AlertDescription>
              </Alert>
            )}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Merchant</span>
                <span className="font-medium">{PLATFORM_NAME}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Invoice</span>
                <span className="font-mono text-xs">{payload.invoiceId || payload.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono text-xs">{payload.reference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Payer</span>
                <span className="text-right">{payload.customerName}<br /><span className="text-xs text-muted-foreground">{payload.email}</span></span>
              </div>
              <div className="border-t pt-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                <p className="text-sm">{payload.description}</p>
              </div>
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="text-sm font-medium">Amount due</span>
                <span className="text-2xl font-bold text-primary">{amountLabel}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Your bank statement, OTP, or Mobile Money prompt may show the
                name of our licensed payment partner. This is expected and safe.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={close} disabled={processing}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={pay} disabled={processing || expired}>
                {processing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening…</>
                ) : expired ? (
                  <>Session closed</>
                ) : (
                  <><Lock className="h-4 w-4 mr-2" /> Pay securely</>
                )}
              </Button>
            </div>
            {hostedFallback && payload.authorization_url && (
              <Button className="w-full" variant="outline" onClick={openHostedCheckout}>
                Continue on secure payment page
              </Button>
            )}

            <p className="text-center text-[11px] text-muted-foreground">
              Secure payment powered by our licensed payment partner.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
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

  useEffect(() => onBrandedCheckoutOpen((p) => {
    setPayload(p);
    setProcessing(false);
    setErrorMsg(null);
  }), []);

  const close = () => { if (!processing) { setPayload(null); setErrorMsg(null); } };

  const pay = async () => {
    if (!payload) return;
    setProcessing(true);
    setErrorMsg(null);
    const finishPayment = (reference?: string) => {
      const confirmedReference = reference || payload.reference;
      const path = payload.confirmationPath
        ? withReference(payload.confirmationPath, confirmedReference)
        : `/payments/confirm?ref=${encodeURIComponent(confirmedReference)}` +
          (payload.callbackPath ? `&next=${encodeURIComponent(payload.callbackPath)}` : "");
      setPayload(null);
      navigate(path);
    };
    try {
      if (!hasBrandedCheckoutDetails(payload)) {
        throw new Error("Secure checkout details are incomplete. Please try again.");
      }
      await loadPaystackInline();
      const PaystackPop = window.PaystackPop;
      if (!PaystackPop || !payload.publicKey) {
        throw new Error("Secure payment is temporarily unavailable. Please try again.");
      }

      if (payload.access_code && typeof PaystackPop === "function") {
        const popup = new PaystackPop();
        popup.resumeTransaction(payload.access_code, {
          onSuccess: (r: { reference?: string; trxref?: string }) => finishPayment(r.reference || r.trxref),
          onCancel: () => {
            setProcessing(false);
            toast("Payment window closed. You can retry any time.");
          },
          onError: (error: { message?: string } | Error) => {
            setProcessing(false);
            const msg = error?.message || "Could not start secure payment";
            setErrorMsg(msg);
            toast.error(msg);
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
      const handler = legacyInline.setup({
        key: payload.publicKey,
        email: payload.email,
        amount: Math.round(payload.amount * 100),
        currency: payload.currency || "GHS",
        ref: payload.reference,
        callback: (r) => finishPayment(r.reference),
        onClose: () => {
          setProcessing(false);
          toast("Payment window closed. You can retry any time.");
        },
      });
      handler.openIframe();
    } catch (e: unknown) {
      setProcessing(false);
      const msg = e instanceof Error ? e.message : "Could not start secure payment";
      setErrorMsg(msg);
      toast.error(msg);
    }
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
              <Button className="flex-1" onClick={pay} disabled={processing}>
                {processing ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Opening…</>
                ) : (
                  <><Lock className="h-4 w-4 mr-2" /> Pay securely</>
                )}
              </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground">
              Secure payment powered by our licensed payment partner.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

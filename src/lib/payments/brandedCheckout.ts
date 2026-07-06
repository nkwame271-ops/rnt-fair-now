// Branded in-app checkout helper. Instead of redirecting the user to a
// hosted payment page, we open our own branded modal that internally uses
// the payment processor's inline SDK. All copy avoids naming the processor.

import { toast } from "sonner";

export interface BrandedCheckoutPayload {
  reference: string;
  access_code?: string;
  authorization_url?: string;
  publicKey?: string | null;
  amount: number; // GHS major units
  currency?: string;
  email: string;
  description: string;
  invoiceId?: string;
  customerName?: string;
  callbackPath?: string;
  confirmationPath?: string;
}

const EVENT = "rcg:branded-checkout:open";

export function hasBrandedCheckoutDetails(payload: Partial<BrandedCheckoutPayload> | null | undefined) {
  return Boolean(
    payload?.reference &&
    payload?.publicKey &&
    payload?.email &&
    Number(payload?.amount) > 0,
  );
}

export function startBrandedCheckout(payload: BrandedCheckoutPayload) {
  if (!hasBrandedCheckoutDetails(payload)) {
    toast.error("Secure checkout details are incomplete. Please try again.");
    return false;
  }

  // Persist reference for post-payment verification fallback.
  try {
    if (payload.reference) {
      sessionStorage.setItem("pendingPaymentReference", payload.reference);
    }
  } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: payload }));
  return true;
}

export function onBrandedCheckoutOpen(
  handler: (payload: BrandedCheckoutPayload) => void,
) {
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// ------- Paystack Inline loader (v1). Loaded on demand only. -------

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: {
        key: string;
        email: string;
        amount: number; // pesewas
        currency?: string;
        ref: string;
        callback: (r: { reference: string }) => void;
        onClose: () => void;
        metadata?: Record<string, unknown>;
      }) => { openIframe: () => void };
    };
  }
}

let inlinePromise: Promise<void> | null = null;
export function loadPaystackInline(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PaystackPop) return Promise.resolve();
  if (inlinePromise) return inlinePromise;
  inlinePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v1/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { inlinePromise = null; reject(new Error("Could not load secure payment module")); };
    document.head.appendChild(s);
  });
  return inlinePromise;
}

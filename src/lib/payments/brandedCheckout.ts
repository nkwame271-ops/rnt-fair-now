// Branded in-app checkout helper. Instead of redirecting the user to a
// hosted payment page, we open our own branded modal that internally uses
// the payment processor's inline SDK. All copy avoids naming the processor.

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
  /**
   * Optional re-initialiser. A payment session (access code) is single-use:
   * once the payment window has been opened and closed/cancelled, resuming the
   * same session fails with "Unable to process transaction". When a retry is
   * needed we call this to mint a brand new session instead of reusing the old
   * one.
   */
  refresh?: () => Promise<BrandedCheckoutPayload | null>;
}

const EVENT = "rcg:branded-checkout:open";

export function getBrandedCheckoutValidationError(
  payload: Partial<BrandedCheckoutPayload> | null | undefined,
) {
  if (!payload) return "Secure checkout details were not received.";
  if (!payload.reference) return "Secure checkout reference is missing.";
  if (!payload.publicKey) return "Secure payment is not configured correctly.";
  if (!payload.email) return "Payer email is missing from the secure checkout.";
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0) {
    return "Secure checkout amount is missing or invalid.";
  }
  return null;
}

export function hasBrandedCheckoutDetails(payload: Partial<BrandedCheckoutPayload> | null | undefined) {
  return getBrandedCheckoutValidationError(payload) === null;
}

/**
 * Tracks payment sessions (access codes) that a payment window has already been
 * opened on. A session is single use: opening a second window on the same
 * access code fails with "Unable to process transaction".
 */
const consumedSessions = new Set<string>();

export function markCheckoutSessionConsumed(accessCode?: string | null) {
  if (accessCode) consumedSessions.add(accessCode);
}

export function isCheckoutSessionConsumed(accessCode?: string | null) {
  return !!accessCode && consumedSessions.has(accessCode);
}

/**
 * Builds a session initialiser for the branded checkout host. The host calls it
 * the moment the payer presses "Pay securely", so the session handed to the
 * payment window is always freshly minted instead of one created minutes
 * earlier when the page's own button was pressed.
 */
export function makeCheckoutSession(
  functionName: string,
  body: Record<string, unknown>,
): () => Promise<BrandedCheckoutPayload | null> {
  return async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data, error } = await supabase.functions.invoke(functionName, { body });
    if (error) throw new Error(error.message || "Payment initiation failed");
    if ((data as { error?: string } | null)?.error) {
      throw new Error((data as { error: string }).error);
    }
    const payload = data as BrandedCheckoutPayload | null;
    if (payload?.reference) {
      try { sessionStorage.setItem("pendingPaymentReference", payload.reference); } catch { /* ignore */ }
    }
    return payload;
  };
}

export function startBrandedCheckout(
  payloadInput: BrandedCheckoutPayload,
  refresh?: () => Promise<BrandedCheckoutPayload | null>,
) {
  const payload: BrandedCheckoutPayload = refresh ? { ...payloadInput, refresh } : payloadInput;
  const validationError = getBrandedCheckoutValidationError(payload);
  if (validationError) {
    console.warn("Branded checkout payload rejected:", validationError);
    throw new Error(validationError);
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
    PaystackPop?: any;
  }
}

export type PaystackInlineV1 = {
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

export type PaystackInlineV2Constructor = new () => {
  resumeTransaction: (
    accessCode: string,
    opts?: {
      onSuccess?: (r: { reference?: string; trxref?: string; status?: string }) => void;
      onCancel?: () => void;
      onError?: (error: { message?: string } | Error) => void;
      onLoad?: () => void;
    },
  ) => void;
};

let inlinePromise: Promise<void> | null = null;
export function loadPaystackInline(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.PaystackPop) return Promise.resolve();
  if (inlinePromise) return inlinePromise;
  inlinePromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.paystack.co/v2/inline.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { inlinePromise = null; reject(new Error("Could not load secure payment module")); };
    document.head.appendChild(s);
  });
  return inlinePromise;
}

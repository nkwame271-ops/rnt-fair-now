import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARKESEL_V2_URL = "https://api.arkesel.com/api/v2/sms/send";
const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";

// Ordered fallback chain. Try "RentControl" first; if Arkesel rejects the
// sender ID (code 111 / "not allowed to use this Sender ID"), fall through
// to the next entry. Add additional approved IDs here as Arkesel whitelists.
const SENDER_FALLBACKS = ["RentControl", "R Control"];

function isSenderRejection(msg: string): boolean {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("not allowed to use this sender id") ||
    m.includes("\"code\":\"111\"") ||
    m.includes("code: 111") ||
    m.includes("sender id")
  );
}

async function sendViaV2(apiKey: string, phone: string, message: string, sender: string) {
  const res = await fetch(ARKESEL_V2_URL, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ sender, message, recipients: [phone] }),
  });
  const data = await res.json();
  if (data.status !== "success") throw new Error(data.message || "V2 SMS failed");
  return data;
}

async function sendViaV1(apiKey: string, phone: string, message: string, sender: string) {
  const params = new URLSearchParams({
    action: "send-sms",
    api_key: apiKey,
    to: phone,
    from: sender,
    sms: message,
  });
  const res = await fetch(`${ARKESEL_V1_URL}?${params.toString()}`);
  const text = await res.text();
  console.log("V1 raw response:", text);
  if (!res.ok) throw new Error("V1 HTTP " + res.status + ": " + text);
  // V1 may return JSON with code 111 even on HTTP 200 in some envs
  if (text.includes('"code":"111"') || text.toLowerCase().includes("not allowed")) {
    throw new Error("V1 sender rejected: " + text);
  }
  return text;
}

async function trySend(apiKey: string, phone: string, message: string, sender: string) {
  try {
    console.log(`Trying V2 with sender "${sender}"...`);
    await sendViaV2(apiKey, phone, message, sender);
    return { ok: true as const, via: "v2", sender };
  } catch (v2Err) {
    const v2Msg = v2Err instanceof Error ? v2Err.message : String(v2Err);
    console.warn(`V2 failed for "${sender}":`, v2Msg, "— trying V1...");
    try {
      await sendViaV1(apiKey, phone, message, sender);
      return { ok: true as const, via: "v1", sender };
    } catch (v1Err) {
      const v1Msg = v1Err instanceof Error ? v1Err.message : String(v1Err);
      return { ok: false as const, sender, error: v1Msg, senderRejected: isSenderRejection(v1Msg) || isSenderRejection(v2Msg) };
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
    if (!ARKESEL_API_KEY) throw new Error("ARKESEL_API_KEY is not configured");

    const { phone, message, sender } = await req.json();
    if (!phone || !message) {
      return new Response(
        JSON.stringify({ success: false, error: "phone and message are required" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let normalizedPhone = phone.replace(/\s/g, "").replace(/^0/, "233");
    if (!normalizedPhone.startsWith("233")) normalizedPhone = "233" + normalizedPhone;

    // If caller pinned a specific sender, honor it as a one-shot (no chain).
    // Otherwise walk the fallback chain.
    const senderChain = sender ? [sender] : SENDER_FALLBACKS;

    let lastError = "";
    let usedSender = "";
    for (const candidate of senderChain) {
      const result = await trySend(ARKESEL_API_KEY, normalizedPhone, message, candidate);
      if (result.ok) {
        usedSender = result.sender;
        console.log(`SMS sent successfully via ${result.via} using sender "${result.sender}"`);
        break;
      }
      lastError = result.error;
      if (!result.senderRejected) {
        // Non-sender error (balance, auth, network) — no point trying another sender
        console.error(`Non-sender failure for "${candidate}", aborting chain:`, lastError);
        break;
      }
      console.warn(`Sender "${candidate}" rejected by Arkesel — trying next in chain...`);
    }

    if (!usedSender) {
      return new Response(
        JSON.stringify({ success: false, error: lastError || "All sender IDs rejected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: "SMS sent successfully", sender: usedSender }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

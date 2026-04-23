import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARKESEL_V2_URL = "https://api.arkesel.com/api/v2/sms/send";
const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";

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
  // V1 returns "OK" or a JSON with code
  if (!res.ok) throw new Error("V1 HTTP " + res.status + ": " + text);
  return text;
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
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let normalizedPhone = phone.replace(/\s/g, "").replace(/^0/, "233");
    if (!normalizedPhone.startsWith("233")) normalizedPhone = "233" + normalizedPhone;

    const senderID = sender || "RentControl";

    // Try V2 first, fallback to V1 on network/DNS error
    try {
      console.log("Trying V2 API...");
      await sendViaV2(ARKESEL_API_KEY, normalizedPhone, message, senderID);
      console.log("V2 succeeded");
    } catch (v2Err: unknown) {
      const v2Msg = v2Err instanceof Error ? v2Err.message : String(v2Err);
      console.warn("V2 failed:", v2Msg, "— trying V1 fallback...");
      await sendViaV1(ARKESEL_API_KEY, normalizedPhone, message, senderID);
      console.log("V1 fallback succeeded");
    }

    return new Response(
      JSON.stringify({ success: true, message: "SMS sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("SMS error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

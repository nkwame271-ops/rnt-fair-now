import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARKESEL_API_URL = "https://sms.arkesel.com/sms/api?action=send-sms";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
    if (!ARKESEL_API_KEY) {
      throw new Error("ARKESEL_API_KEY is not configured");
    }

    const { phone, message, sender } = await req.json();

    if (!phone || !message) {
      return new Response(
        JSON.stringify({ error: "phone and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone: ensure it starts with 233
    let normalizedPhone = phone.replace(/\s/g, "").replace(/^0/, "233");
    if (!normalizedPhone.startsWith("233")) {
      normalizedPhone = "233" + normalizedPhone;
    }

    const senderID = sender || "RentGhana";

    const response = await fetch(ARKESEL_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-sms",
        api_key: ARKESEL_API_KEY,
        to: normalizedPhone,
        from: senderID,
        sms: message,
      }),
    });

    const data = await response.json();
    console.log("Arkesel response:", JSON.stringify(data));

    if (data.code !== "ok") {
      throw new Error(data.message || "SMS sending failed");
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

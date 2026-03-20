import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ARKESEL_V2_URL = "https://api.arkesel.com/api/v2/sms/send";
const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";

const WELCOME_MESSAGE =
  "Welcome to RentControlGhana — the future of rent in Ghana! Your rent, your rights, your records — all in one place. We're building a fairer rental system for everyone. Log in anytime at rentghanapilot.lovable.app. Thank you for being part of the journey!";

async function sendSms(apiKey: string, phone: string, message: string, sender: string) {
  // Try V2 first
  try {
    const res = await fetch(ARKESEL_V2_URL, {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message, recipients: [phone] }),
    });
    const data = await res.json();
    if (data.status === "success") return { ok: true, via: "v2" };
    throw new Error(data.message || "V2 failed");
  } catch (v2Err) {
    console.warn(`V2 failed for ${phone}: ${v2Err.message} — trying V1...`);
  }

  // Fallback to V1
  const params = new URLSearchParams({
    action: "send-sms",
    api_key: apiKey,
    to: phone,
    from: sender,
    sms: message,
  });
  const res = await fetch(`${ARKESEL_V1_URL}?${params.toString()}`);
  const text = await res.text();
  console.log(`V1 response for ${phone}:`, text);
  if (!res.ok) throw new Error("V1 HTTP " + res.status + ": " + text);
  return { ok: true, via: "v1" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
    if (!ARKESEL_API_KEY) throw new Error("ARKESEL_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("phone, full_name")
      .not("phone", "is", null)
      .neq("phone", "");

    if (error) throw new Error("Failed to fetch profiles: " + error.message);

    const realProfiles = (profiles || []).filter(
      (p) => p.phone && !p.phone.replace(/\s/g, "").match(/^0?200000/)
    );

    console.log(`Found ${realProfiles.length} real phone numbers to message`);

    const results = { sent: 0, failed: 0, errors: [] as string[], details: [] as string[] };

    for (const profile of realProfiles) {
      let phone = profile.phone.replace(/\s/g, "").replace(/^0/, "233");
      if (!phone.startsWith("233")) phone = "233" + phone;

      try {
        const result = await sendSms(ARKESEL_API_KEY, phone, WELCOME_MESSAGE, "RentGhana");
        results.sent++;
        results.details.push(`✓ ${phone} (${profile.full_name}) via ${result.via}`);
        console.log(`✓ Sent to ${phone} (${profile.full_name}) via ${result.via}`);
      } catch (e) {
        results.failed++;
        results.errors.push(`${phone}: ${e.message}`);
        console.error(`✗ Failed ${phone}:`, e.message);
      }

      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`Done: ${results.sent} sent, ${results.failed} failed`);

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Bulk SMS error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

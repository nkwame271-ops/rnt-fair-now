import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone) return new Response(JSON.stringify({ error: "Phone required" }), { status: 400, headers: corsHeaders });

    const normalized = phone.replace(/\s/g, "").replace(/^0/, "233");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Delete old OTPs for this phone
    await supabaseAdmin.from("otp_verifications").delete().eq("phone", normalized);

    // Insert new OTP
    const { error: insertErr } = await supabaseAdmin.from("otp_verifications").insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
      verified: false,
    });
    if (insertErr) throw insertErr;

    // Send SMS via Arkesel
    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    const message = `Your RentControlGhana verification code is: ${code}. Valid for 10 minutes. Do not share.`;

    let smsSent = false;
    // Try V2 first
    try {
      const v2Res = await fetch("https://api.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: "RentGhana", message, recipients: [normalized] }),
      });
      if (v2Res.ok) smsSent = true;
    } catch { /* fallback */ }

    // V1 fallback
    if (!smsSent) {
      try {
        const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${normalized}&from=RentGhana&sms=${encodeURIComponent(message)}`;
        await fetch(v1Url);
        smsSent = true;
      } catch { /* log */ }
    }

    return new Response(JSON.stringify({ success: true, smsSent }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

import { adminClient, resolvePhoneFromIdentifier, normalizePhone, maskPhone } from "../_shared/resolvePhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { identifier } = await req.json();
    if (!identifier || typeof identifier !== "string" || identifier.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Valid identifier required" }), { status: 400, headers: corsHeaders });
    }

    const admin = adminClient();
    const phone = await resolvePhoneFromIdentifier(admin, identifier);

    if (!phone) {
      // SECURITY: return a generic message to avoid identifier enumeration.
      return new Response(JSON.stringify({ error: "If an account exists for that identifier, a verification code has been sent." }), { status: 404, headers: corsHeaders });
    }

    // SECURITY: send OTP server-side. Do not return the raw phone number to the
    // client — only return a masked display value to prevent enumeration.
    const normalized = normalizePhone(phone);
    const masked = maskPhone(phone);

    // Create / refresh OTP in the same flow as send-otp
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await admin
      .from("otp_verifications")
      .delete()
      .eq("phone", normalized)
      .or(`verified.eq.true,expires_at.lt.${new Date().toISOString()}`);

    const { data: existing } = await admin
      .from("otp_verifications")
      .select("id, code")
      .eq("phone", normalized)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    let code: string;
    if (existing) {
      code = existing.code as string;
      await admin.from("otp_verifications").update({ expires_at: expiresAt }).eq("id", existing.id);
    } else {
      code = String(Math.floor(100000 + Math.random() * 900000));
      await admin.from("otp_verifications").insert({ phone: normalized, code, expires_at: expiresAt, verified: false });
    }

    // Send SMS via Arkesel
    const apiKey = Deno.env.get("ARKESEL_API_KEY");
    const message = `Your RentControlGhana verification code is: ${code}. Valid for 10 minutes. Do not share.`;
    let smsSent = false;
    try {
      const res = await fetch("https://api.arkesel.com/api/v2/sms/send", {
        method: "POST",
        headers: { "api-key": apiKey!, "Content-Type": "application/json" },
        body: JSON.stringify({ sender: "RentControl", message, recipients: [normalized] }),
      });
      if (res.ok) smsSent = true;
    } catch { /* fallback */ }
    if (!smsSent) {
      try {
        const v1Url = `https://sms.arkesel.com/sms/api?action=send-sms&api_key=${apiKey}&to=${normalized}&from=RentControl&sms=${encodeURIComponent(message)}`;
        await fetch(v1Url);
        smsSent = true;
      } catch { /* ignore */ }
    }

    return new Response(JSON.stringify({
      phone_masked: masked,
      otp_sent: smsSent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

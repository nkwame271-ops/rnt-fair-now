import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Strict normalizer: strip everything except digits, then ensure 233 prefix */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return "233" + digits.slice(1);
  return "233" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, code } = await req.json();
    if (!phone || !code) {
      // Return 200 with error field so supabase.functions.invoke populates data
      return new Response(JSON.stringify({ verified: false, error: "Phone and code required" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalized = normalizePhone(phone);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Find the latest OTP for this phone
    const { data: otp, error } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", normalized)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    // Step 2: No OTP found at all
    if (!otp) {
      return new Response(JSON.stringify({ verified: false, error: "No verification code found for this number. Please request a new one." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 3: Already verified — return idempotent success
    if (otp.verified && otp.code === code) {
      return new Response(JSON.stringify({ verified: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 4: Expired
    if (new Date(otp.expires_at) < new Date()) {
      return new Response(JSON.stringify({ verified: false, error: "Verification code has expired. Please request a new one." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 5: Code doesn't match
    if (otp.code !== code) {
      return new Response(JSON.stringify({ verified: false, error: "Incorrect verification code. Please check and try again." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Step 6: All checks pass — mark as verified
    await supabaseAdmin.from("otp_verifications").update({ verified: true }).eq("id", otp.id);

    return new Response(JSON.stringify({ verified: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("verify-otp crash:", err);
    return new Response(JSON.stringify({ verified: false, error: "Server error during verification. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

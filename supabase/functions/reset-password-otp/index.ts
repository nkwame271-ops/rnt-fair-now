import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, new_password } = await req.json();

    if (!phone || !new_password) {
      return new Response(JSON.stringify({ error: "Phone and new_password required" }), { status: 400, headers: corsHeaders });
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers: corsHeaders });
    }

    const normalized = phone.replace(/\s/g, "").replace(/^0/, "233");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify that OTP was verified for this phone (check for a recently verified OTP)
    const { data: otp, error: otpError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", normalized)
      .eq("verified", true)
      .gte("expires_at", new Date(Date.now() - 15 * 60 * 1000).toISOString()) // verified within last 15 min
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) throw otpError;

    if (!otp) {
      return new Response(JSON.stringify({ error: "No verified OTP found. Please verify your phone first." }), { status: 403, headers: corsHeaders });
    }

    // Look up user by phone in profiles
    // Try both raw phone and normalized forms
    const rawPhone = phone.replace(/\s/g, "");
    let userId: string | null = null;

    for (const tryPhone of [rawPhone, normalized]) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("phone", tryPhone)
        .maybeSingle();
      if (profile?.user_id) {
        userId = profile.user_id;
        break;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }

    // Reset the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: new_password,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 500, headers: corsHeaders });
    }

    // Clean up used OTP
    await supabaseAdmin.from("otp_verifications").delete().eq("phone", normalized);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

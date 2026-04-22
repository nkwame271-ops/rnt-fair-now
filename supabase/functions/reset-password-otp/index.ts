import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Match verify-otp normaliser: digits-only, ensure 233 prefix
const normalizePhone = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return "233" + digits.slice(1);
  return "233" + digits;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, new_password } = await req.json();

    if (!phone || !new_password) {
      return json({ ok: false, error: "Phone and new password are required" });
    }

    if (typeof new_password !== "string" || new_password.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return json({ ok: false, error: "Invalid phone number" });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify a recently-verified OTP exists for this phone (within the last 15 min)
    const { data: otp, error: otpError } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", normalized)
      .eq("verified", true)
      .gte("created_at", new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("OTP lookup failed:", otpError);
      return json({ ok: false, error: "Could not verify OTP. Please request a new code." });
    }

    if (!otp) {
      return json({ ok: false, error: "No verified OTP found. Please verify your phone first." });
    }

    // Look up user by phone in profiles, trying multiple stored formats
    const rawDigits = String(phone).replace(/\D/g, "");
    const candidates = Array.from(new Set([
      normalized,
      rawDigits,
      "+" + normalized,
      rawDigits.startsWith("233") ? "0" + rawDigits.slice(3) : rawDigits,
    ].filter(Boolean)));

    let userId: string | null = null;
    for (const tryPhone of candidates) {
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

    // Fallback: scan auth users by phone
    if (!userId) {
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = list?.users?.find((u: any) => {
          const p = (u.phone || "").replace(/\D/g, "");
          return p === normalized || p === rawDigits;
        });
        if (match) userId = match.id;
      } catch (e) {
        console.warn("listUsers fallback failed:", e);
      }
    }

    if (!userId) {
      return json({ ok: false, error: "No account found for this phone number." });
    }

    // Reset the password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: new_password,
    });

    if (updateError) {
      console.error("Password update failed:", updateError);
      return json({ ok: false, error: updateError.message || "Failed to update password" });
    }

    // Clean up used OTPs for this phone
    await supabaseAdmin.from("otp_verifications").delete().eq("phone", normalized);

    return json({ ok: true });
  } catch (err: any) {
    console.error("reset-password-otp error:", err);
    return json({ ok: false, error: err?.message || "Unexpected error" });
  }
});

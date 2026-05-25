import { adminClient, resolvePhoneFromIdentifier, normalizePhone } from "../_shared/resolvePhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, identifier, new_password } = await req.json();
    if (!new_password) return json({ ok: false, error: "New password is required" });
    if (typeof new_password !== "string" || new_password.length < 8) {
      return json({ ok: false, error: "Password must be at least 8 characters" });
    }

    const admin = adminClient();

    // Resolve phone server-side from identifier so the client never holds the raw phone.
    let resolvedPhone: string | null = null;
    if (identifier) {
      resolvedPhone = await resolvePhoneFromIdentifier(admin, identifier);
    } else if (phone) {
      resolvedPhone = phone;
    }
    if (!resolvedPhone) return json({ ok: false, error: "No account found." });

    const normalized = normalizePhone(resolvedPhone);

    const { data: otp, error: otpError } = await admin
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
    if (!otp) return json({ ok: false, error: "No verified OTP found. Please verify your phone first." });

    // Look up the user by phone in profiles (multiple stored formats).
    const rawDigits = resolvedPhone.replace(/\D/g, "");
    const candidates = Array.from(new Set([
      normalized,
      rawDigits,
      "+" + normalized,
      rawDigits.startsWith("233") ? "0" + rawDigits.slice(3) : rawDigits,
    ].filter(Boolean)));

    let userId: string | null = null;
    for (const tryPhone of candidates) {
      const { data: profile } = await admin.from("profiles").select("user_id").eq("phone", tryPhone).maybeSingle();
      if (profile?.user_id) { userId = profile.user_id; break; }
    }

    if (!userId) {
      try {
        const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = list?.users?.find((u: any) => {
          const p = (u.phone || "").replace(/\D/g, "");
          return p === normalized || p === rawDigits;
        });
        if (match) userId = match.id;
      } catch (e) {
        console.warn("listUsers fallback failed:", e);
      }
    }

    if (!userId) return json({ ok: false, error: "No account found for this phone number." });

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password: new_password });
    if (updateError) {
      console.error("Password update failed:", updateError);
      return json({ ok: false, error: updateError.message || "Failed to update password" });
    }

    await admin.from("otp_verifications").delete().eq("phone", normalized);
    return json({ ok: true });
  } catch (err: any) {
    console.error("reset-password-otp error:", err);
    return json({ ok: false, error: err?.message || "Unexpected error" });
  }
});

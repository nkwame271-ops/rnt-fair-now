import { adminClient, normalizePhone } from "../_shared/resolvePhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ ok: false, error: "Not authenticated" }, 401);

    const admin = adminClient();
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ ok: false, error: "Invalid session" }, 401);
    const user = userData.user;

    const { new_phone, current_password } = await req.json();
    if (!new_phone || !current_password) {
      return json({ ok: false, error: "Phone and current password are required" }, 400);
    }

    const normalized = normalizePhone(new_phone);
    if (normalized.length !== 12) {
      return json({ ok: false, error: "Please enter a valid 10-digit Ghana phone number" }, 400);
    }

    // Re-authenticate with current password against the user's current email
    const { error: signInErr } = await admin.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    });
    if (signInErr) return json({ ok: false, error: "Incorrect current password" }, 400);

    // Ensure the new phone is not already used by another account
    const newSyntheticEmail = `${normalized}@rentcontrolghana.local`;
    if (user.email !== newSyntheticEmail) {
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("phone", normalized)
        .maybeSingle();
      if (existingProfile?.user_id && existingProfile.user_id !== user.id) {
        return json({ ok: false, error: "This phone number is already in use by another account." }, 409);
      }
    }

    // Update the auth user — email (synthetic) AND phone column
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, {
      email: newSyntheticEmail,
      phone: normalized,
      email_confirm: true,
      phone_confirm: true,
    } as any);
    if (updateErr) {
      console.error("auth update failed:", updateErr);
      return json({ ok: false, error: updateErr.message || "Failed to update phone in auth" }, 500);
    }

    // Mirror to profiles
    const { error: profErr } = await admin
      .from("profiles")
      .update({ phone: normalized })
      .eq("user_id", user.id);
    if (profErr) console.error("profile mirror failed:", profErr);

    return json({ ok: true, phone: normalized });
  } catch (err: any) {
    console.error("change-phone error:", err);
    return json({ ok: false, error: err?.message || "Unexpected error" }, 500);
  }
});

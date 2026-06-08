import { adminClient, resolvePhoneFromIdentifier, normalizePhone } from "../_shared/resolvePhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, identifier, code } = await req.json();
    if (!code) return json({ verified: false, error: "Code required" });

    const admin = adminClient();

    // Resolve phone from identifier server-side so the client never holds the raw number.
    let resolvedPhone: string | null = null;
    if (identifier) {
      resolvedPhone = await resolvePhoneFromIdentifier(admin, identifier);
    } else if (phone) {
      resolvedPhone = phone;
    }

    if (!resolvedPhone) return json({ verified: false, error: "Phone not found" });

    const normalized = normalizePhone(resolvedPhone);

    // Prefer an active (unverified, unexpired) OTP. Fall back to the most
    // recent record for clearer error reporting (expired vs incorrect).
    const nowIso = new Date().toISOString();
    const { data: active } = await admin
      .from("otp_verifications")
      .select("*")
      .eq("phone", normalized)
      .eq("verified", false)
      .gte("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let otp = active;
    if (!otp) {
      const { data: latest } = await admin
        .from("otp_verifications")
        .select("*")
        .eq("phone", normalized)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      otp = latest;
    }

    if (!otp) return json({ verified: false, error: "No verification code found for this number. Please request a new one." });
    if (otp.verified && otp.code === code) return json({ verified: true });
    if (new Date(otp.expires_at) < new Date()) return json({ verified: false, error: "Verification code has expired. Please request a new one." });
    if (otp.code !== code) return json({ verified: false, error: "Incorrect verification code. Please check and try again." });

    await admin.from("otp_verifications").update({ verified: true }).eq("id", otp.id);
    return json({ verified: true });
  } catch (err: any) {
    console.error("verify-otp crash:", err);
    return json({ verified: false, error: "Server error during verification. Please try again." }, 500);
  }
});

    await admin.from("otp_verifications").update({ verified: true }).eq("id", otp.id);
    return json({ verified: true });
  } catch (err: any) {
    console.error("verify-otp crash:", err);
    return json({ verified: false, error: "Server error during verification. Please try again." }, 500);
  }
});

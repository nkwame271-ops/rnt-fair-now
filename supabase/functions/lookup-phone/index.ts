import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const trimmed = identifier.trim();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let phone: string | null = null;

    // Check if it looks like a phone number (starts with 0 and digits)
    const phoneDigits = trimmed.replace(/\s/g, "");
    if (/^0\d{9}$/.test(phoneDigits)) {
      // Direct phone lookup
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("phone", phoneDigits)
        .maybeSingle();
      phone = profile?.phone || null;

      // Also try with formatted variants
      if (!phone) {
        const normalized = phoneDigits.replace(/^0/, "233");
        const { data: profile2 } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .eq("phone", normalized)
          .maybeSingle();
        phone = profile2?.phone || null;
      }
    }

    // Check if it's a tenant ID — accept both TEN- (legacy) and TN- (current)
    if (!phone && /^(TEN-|TN-)/i.test(trimmed)) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("user_id")
        .ilike("tenant_id", trimmed)
        .maybeSingle();
      if (tenant?.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .eq("user_id", tenant.user_id)
          .maybeSingle();
        phone = profile?.phone || null;
      }
    }

    // Check if it's a landlord ID — accept both LLD- (legacy) and LL- (current)
    if (!phone && /^(LLD-|LL-)/i.test(trimmed)) {
      const { data: landlord } = await supabaseAdmin
        .from("landlords")
        .select("user_id")
        .ilike("landlord_id", trimmed)
        .maybeSingle();
      if (landlord?.user_id) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("phone")
          .eq("user_id", landlord.user_id)
          .maybeSingle();
        phone = profile?.phone || null;
      }
    }

    if (!phone) {
      return new Response(JSON.stringify({ error: "No account found for this identifier. Please check the phone number or ID and try again." }), { status: 404, headers: corsHeaders });
    }

    // Normalize phone for OTP sending (ensure 233 prefix)
    const normalizedPhone = phone.replace(/\s/g, "").replace(/^0/, "233");

    // Mask phone for display: show first 3 and last 3 digits
    const displayPhone = phone.replace(/\s/g, "");
    const masked = displayPhone.length >= 6
      ? displayPhone.slice(0, 3) + "****" + displayPhone.slice(-3)
      : "***masked***";

    return new Response(JSON.stringify({
      phone_masked: masked,
      phone_normalized: normalizedPhone,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

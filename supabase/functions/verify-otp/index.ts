import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { phone, code } = await req.json();
    if (!phone || !code) return new Response(JSON.stringify({ error: "Phone and code required" }), { status: 400, headers: corsHeaders });

    const normalized = phone.replace(/\s/g, "").replace(/^0/, "233");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: otp, error } = await supabaseAdmin
      .from("otp_verifications")
      .select("*")
      .eq("phone", normalized)
      .eq("code", code)
      .eq("verified", false)
      .gte("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!otp) {
      return new Response(JSON.stringify({ verified: false, error: "Invalid or expired OTP" }), { status: 400, headers: corsHeaders });
    }

    // Mark as verified
    await supabaseAdmin.from("otp_verifications").update({ verified: true }).eq("id", otp.id);

    return new Response(JSON.stringify({ verified: true }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});

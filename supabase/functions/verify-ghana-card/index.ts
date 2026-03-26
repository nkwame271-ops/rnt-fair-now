import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ghana_card_number, full_name, kyc_id } = await req.json();

    if (!ghana_card_number) {
      return new Response(JSON.stringify({ error: "ghana_card_number is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const NIA_API_KEY = Deno.env.get("NIA_API_KEY");
    const NIA_API_URL = Deno.env.get("NIA_API_URL");

    let result: { verified: boolean; reason: string; stub: boolean; data?: any };

    if (NIA_API_KEY && NIA_API_URL) {
      // Live NIA API call
      try {
        const response = await fetch(NIA_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${NIA_API_KEY}`,
          },
          body: JSON.stringify({
            card_number: ghana_card_number,
            full_name: full_name || "",
          }),
        });

        const data = await response.json();
        const verified = data.status === "valid" || data.verified === true;

        result = {
          verified,
          reason: verified ? "NIA verification successful" : (data.message || "NIA verification failed"),
          stub: false,
          data,
        };
      } catch (apiError: any) {
        result = {
          verified: false,
          reason: `NIA API error: ${apiError.message}`,
          stub: false,
        };
      }
    } else {
      // Stub mode — NIA API not configured yet
      result = {
        verified: false,
        reason: "NIA API not configured. Manual verification required.",
        stub: true,
      };
    }

    // Update kyc_verifications if kyc_id provided
    if (kyc_id) {
      await supabaseAdmin.from("kyc_verifications").update({
        nia_verified: result.verified,
        nia_response: result,
      }).eq("id", kyc_id);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

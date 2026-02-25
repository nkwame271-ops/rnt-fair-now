import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { role, id } = await req.json();

    if (!role || !id || !["tenant", "landlord"].includes(role)) {
      return new Response(
        JSON.stringify({ found: false, error: "Invalid role or id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let record: any = null;

    if (role === "tenant") {
      const { data } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, status, registration_fee_paid, registration_date, expiry_date")
        .eq("tenant_id", id)
        .maybeSingle();
      record = data;
    } else {
      const { data } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, status, registration_fee_paid, registration_date, expiry_date")
        .eq("landlord_id", id)
        .maybeSingle();
      record = data;
    }

    if (!record) {
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch name from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", record.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        found: true,
        name: profile?.full_name || "Unknown",
        status: record.status,
        feePaid: record.registration_fee_paid,
        registrationDate: record.registration_date,
        expiryDate: record.expiry_date,
        role,
        registrationId: role === "tenant" ? record.tenant_id : record.landlord_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ found: false, error: "Server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

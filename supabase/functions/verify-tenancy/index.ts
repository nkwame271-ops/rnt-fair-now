import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenancyId } = await req.json();
    if (!tenancyId) {
      return new Response(JSON.stringify({ error: "tenancyId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: t, error: tErr } = await supabase
      .from("tenancies")
      .select("registration_code, status, compliance_status, agreed_rent, start_date, end_date, landlord_user_id, tenant_user_id, rent_card_id")
      .eq("id", tenancyId)
      .maybeSingle();

    if (tErr || !t) {
      return new Response(JSON.stringify({ error: "Tenancy not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: landlordProfile }, { data: tenantProfile }, rentCardResult] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("user_id", t.tenant_user_id).maybeSingle(),
      t.rent_card_id
        ? supabase.from("rent_cards").select("serial_number").eq("id", t.rent_card_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    return new Response(JSON.stringify({
      registration_code: t.registration_code,
      status: t.status,
      compliance_status: t.compliance_status,
      agreed_rent: t.agreed_rent,
      start_date: t.start_date,
      end_date: t.end_date,
      landlord_name: landlordProfile?.full_name || "Unknown",
      tenant_name: tenantProfile?.full_name || "Unknown",
      rent_card_serial: rentCardResult?.data?.serial_number || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

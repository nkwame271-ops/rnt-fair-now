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
      .select("registration_code, status, compliance_status, agreed_rent, start_date, end_date, landlord_user_id, tenant_user_id, rent_card_id, rent_card_id_2, unit_id, landlord_signed_at, tenant_signed_at, landlord_accepted, tenant_accepted")
      .eq("id", tenancyId)
      .maybeSingle();

    if (tErr || !t) {
      return new Response(JSON.stringify({ error: "Tenancy not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Compute agreement status
    let agreement_status = "Pending";
    if (t.status === "expired") agreement_status = "Expired";
    else if (t.status === "terminated") agreement_status = "Terminated";
    else if (t.status === "rejected") agreement_status = "Rejected";
    else if (t.status === "archived") agreement_status = "Archived";
    else if (t.landlord_accepted && t.tenant_accepted) agreement_status = "Final";
    else if (t.status === "active") agreement_status = "Active";

    // Fetch related data in parallel
    const [
      { data: landlordProfile },
      { data: tenantProfile },
      rentCard1Result,
      rentCard2Result,
      unitResult,
    ] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("user_id", t.tenant_user_id).maybeSingle(),
      t.rent_card_id
        ? supabase.from("rent_cards").select("serial_number, card_role").eq("id", t.rent_card_id).maybeSingle()
        : Promise.resolve({ data: null }),
      t.rent_card_id_2
        ? supabase.from("rent_cards").select("serial_number, card_role").eq("id", t.rent_card_id_2).maybeSingle()
        : Promise.resolve({ data: null }),
      t.unit_id
        ? supabase.from("units").select("unit_name, unit_type, property_id").eq("id", t.unit_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Fetch property data if unit found
    let propertyData = null;
    if (unitResult?.data?.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("property_name, address, region, gps_location, ghana_post_gps")
        .eq("id", unitResult.data.property_id)
        .maybeSingle();
      propertyData = prop;
    }

    return new Response(JSON.stringify({
      registration_code: t.registration_code,
      status: t.status,
      agreement_status,
      compliance_status: t.compliance_status,
      agreed_rent: t.agreed_rent,
      start_date: t.start_date,
      end_date: t.end_date,
      landlord_name: landlordProfile?.full_name || "Unknown",
      tenant_name: tenantProfile?.full_name || "Unknown",
      landlord_signed_at: t.landlord_signed_at || null,
      tenant_signed_at: t.tenant_signed_at || null,
      property_name: propertyData?.property_name || null,
      property_address: propertyData?.address || null,
      property_region: propertyData?.region || null,
      gps_location: propertyData?.gps_location || null,
      ghana_post_gps: propertyData?.ghana_post_gps || null,
      unit_name: unitResult?.data?.unit_name || null,
      unit_type: unitResult?.data?.unit_type || null,
      rent_card_serial: rentCard1Result?.data?.serial_number || null,
      rent_card_role: rentCard1Result?.data?.card_role || null,
      rent_card_serial_2: rentCard2Result?.data?.serial_number || null,
      rent_card_role_2: rentCard2Result?.data?.card_role || null,
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

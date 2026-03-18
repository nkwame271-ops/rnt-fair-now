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
    const { token } = await req.json();
    if (!token) throw new Error("token is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: card, error } = await supabase
      .from("rent_cards")
      .select("serial_number, status, landlord_user_id, tenant_user_id, property_id, unit_id, current_rent, start_date, expiry_date, advance_paid, max_advance, last_payment_status")
      .eq("qr_token", token)
      .maybeSingle();

    if (error || !card) {
      return new Response(JSON.stringify({ error: "Rent card not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch landlord name
    const { data: landlordProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", card.landlord_user_id)
      .single();

    // Fetch tenant name if assigned
    let tenantName: string | null = null;
    if (card.tenant_user_id) {
      const { data: tenantProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", card.tenant_user_id)
        .single();
      tenantName = tenantProfile?.full_name || null;
    }

    // Fetch property address if assigned
    let propertyAddress: string | null = null;
    let unitName: string | null = null;
    if (card.property_id) {
      const { data: prop } = await supabase
        .from("properties")
        .select("address")
        .eq("id", card.property_id)
        .single();
      propertyAddress = prop?.address || null;
    }
    if (card.unit_id) {
      const { data: unit } = await supabase
        .from("units")
        .select("unit_name")
        .eq("id", card.unit_id)
        .single();
      unitName = unit?.unit_name || null;
    }

    return new Response(JSON.stringify({
      serial_number: card.serial_number,
      status: card.status,
      landlord_name: landlordProfile?.full_name || "Unknown",
      tenant_name: tenantName,
      property_address: propertyAddress,
      unit_name: unitName,
      current_rent: card.current_rent,
      start_date: card.start_date,
      expiry_date: card.expiry_date,
      advance_paid: card.advance_paid,
      max_advance: card.max_advance,
      last_payment_status: card.last_payment_status,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

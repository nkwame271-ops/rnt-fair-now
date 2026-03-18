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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: string[] = [];

    // 1. Regulator
    const { data: regUser, error: regErr } = await supabase.auth.admin.createUser({
      email: "admin@rentcontrol.gov.gh",
      password: "Admin123!",
      email_confirm: true,
      user_metadata: {
        full_name: "RCD Administrator",
        phone: "0200000000",
        role: "regulator",
      },
    });
    if (regErr) {
      results.push(`Regulator: ${regErr.message}`);
    } else {
      results.push(`Regulator created: ${regUser.user.id}`);
    }

    // 2. Tenant
    const { data: tenUser, error: tenErr } = await supabase.auth.admin.createUser({
      email: "0240001234@rentcontrolghana.local",
      password: "001234",
      email_confirm: true,
      user_metadata: {
        full_name: "Kwame Asante",
        phone: "0240001234",
        role: "tenant",
      },
    });
    if (tenErr) {
      results.push(`Tenant: ${tenErr.message}`);
    } else {
      // Insert tenant record with fee paid
      const { error: tInsErr } = await supabase.from("tenants").insert({
        user_id: tenUser.user.id,
        tenant_id: "TNT-DEMO-001",
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
      });
      results.push(`Tenant created: ${tenUser.user.id}${tInsErr ? ` (tenant record error: ${tInsErr.message})` : ""}`);
    }

    // 3. Landlord
    const { data: llUser, error: llErr } = await supabase.auth.admin.createUser({
      email: "0240005678@rentcontrolghana.local",
      password: "005678",
      email_confirm: true,
      user_metadata: {
        full_name: "Ama Mensah",
        phone: "0240005678",
        role: "landlord",
      },
    });
    if (llErr) {
      results.push(`Landlord: ${llErr.message}`);
    } else {
      const { error: lInsErr } = await supabase.from("landlords").insert({
        user_id: llUser.user.id,
        landlord_id: "LLD-DEMO-001",
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        compliance_score: 100,
      });
      results.push(`Landlord created: ${llUser.user.id}${lInsErr ? ` (landlord record error: ${lInsErr.message})` : ""}`);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

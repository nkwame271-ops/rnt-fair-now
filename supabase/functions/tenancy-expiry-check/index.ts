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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    // Find active tenancies expiring within 90 days that haven't been flagged yet
    const { data: tenancies, error } = await supabase
      .from("tenancies")
      .select("id, tenant_user_id, landlord_user_id, end_date, registration_code, unit_id, agreed_rent")
      .eq("status", "active")
      .is("renewal_requested_at", null)
      .lte("end_date", in90Days.toISOString().split("T")[0])
      .gte("end_date", now.toISOString().split("T")[0]);

    if (error) {
      console.error("Query error:", error.message);
      throw new Error(error.message);
    }

    console.log(`Found ${tenancies?.length || 0} tenancies in 90-day renewal window`);

    let updated = 0;
    for (const t of tenancies || []) {
      const daysLeft = Math.ceil(
        (new Date(t.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Update status to renewal_window
      const { error: updateErr } = await supabase
        .from("tenancies")
        .update({ status: "renewal_window" })
        .eq("id", t.id)
        .eq("status", "active");

      if (updateErr) {
        console.error(`Failed to update tenancy ${t.id}:`, updateErr.message);
        continue;
      }

      // Get property info for notification
      const { data: unit } = await supabase
        .from("units")
        .select("unit_name, property_id")
        .eq("id", t.unit_id)
        .single();

      let propertyAddress = "";
      if (unit) {
        const { data: prop } = await supabase
          .from("properties")
          .select("address")
          .eq("id", unit.property_id)
          .single();
        propertyAddress = prop?.address || "";
      }

      // Get tenant and landlord profiles for notifications
      const { data: tenantProfile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", t.tenant_user_id)
        .single();

      // Notify tenant (in-app)
      await supabase.from("notifications").insert({
        user_id: t.tenant_user_id,
        title: "Tenancy Expiring Soon",
        body: `Your tenancy at ${propertyAddress || "your property"} expires in ${daysLeft} days. Request a renewal or plan your exit.`,
        link: "/tenant/renewal",
      });

      // Notify landlord (in-app)
      await supabase.from("notifications").insert({
        user_id: t.landlord_user_id,
        title: "Tenant Tenancy Expiring",
        body: `Tenancy for ${tenantProfile?.full_name || "a tenant"} at ${propertyAddress || "your property"} expires in ${daysLeft} days.`,
        link: "/landlord/renewal-requests",
      });

      // Send SMS reminders for expiry (per notification spec)
      const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
      if (ARKESEL_API_KEY && tenantProfile?.phone) {
        let phone = tenantProfile.phone.replace(/\s/g, "").replace(/^0/, "233");
        if (!phone.startsWith("233")) phone = "233" + phone;
        try {
          await fetch("https://api.arkesel.com/api/v2/sms/send", {
            method: "POST",
            headers: { "api-key": ARKESEL_API_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: "RentControl",
              message: `RentControl: Your tenancy at ${propertyAddress || "your property"} expires in ${daysLeft} days. Request a renewal or plan your exit.`,
              recipients: [phone],
            }),
          });
        } catch (e) {
          console.error(`SMS error for tenant ${t.tenant_user_id}:`, e);
        }
      }

      updated++;
    }

    console.log(`Updated ${updated} tenancies to renewal_window`);

    // Auto-expire tenancies past end_date — single SQL helper handles
    // status flip, unit vacate, property off-market, notifications, audit log.
    const { data: expiredCount, error: expError } = await supabase.rpc("expire_overdue_tenancies");
    if (expError) {
      console.error("expire_overdue_tenancies error:", expError.message);
    }
    console.log(`Auto-expired ${expiredCount ?? 0} tenancies`);

    return new Response(JSON.stringify({ ok: true, updated, expired: expiredCount ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Expiry check error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

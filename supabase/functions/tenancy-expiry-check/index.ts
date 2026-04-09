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
              sender: "RentGhana",
              message: `RentGhana: Your tenancy at ${propertyAddress || "your property"} expires in ${daysLeft} days. Request a renewal or plan your exit.`,
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

    // Auto-expire tenancies past end_date with no renewal
    const { data: expired, error: expError } = await supabase
      .from("tenancies")
      .select("id, tenant_user_id, landlord_user_id, unit_id, registration_code")
      .in("status", ["active", "renewal_window"])
      .lt("end_date", now.toISOString().split("T")[0]);

    if (expError) {
      console.error("Expiry query error:", expError.message);
    }

    let expiredCount = 0;
    for (const t of expired || []) {
      const { error: ue } = await supabase
        .from("tenancies")
        .update({ status: "expired", terminated_at: now.toISOString(), termination_reason: "auto_expired" })
        .eq("id", t.id);
      if (ue) { console.error(`Failed to expire ${t.id}:`, ue.message); continue; }

      await supabase.from("units").update({ status: "vacant" }).eq("id", t.unit_id);

      // Update property status to off_market when tenancy expires
      const { data: unitData } = await supabase.from("units").select("property_id").eq("id", t.unit_id).single();
      if (unitData?.property_id) {
        // Check if any other units on this property are still occupied
        const { data: otherOccupied } = await supabase
          .from("units")
          .select("id")
          .eq("property_id", unitData.property_id)
          .eq("status", "occupied")
          .neq("id", t.unit_id)
          .limit(1);

        if (!otherOccupied || otherOccupied.length === 0) {
          await supabase.from("properties").update({
            property_status: "off_market",
            listed_on_marketplace: false,
          }).eq("id", unitData.property_id);

          // Log property event
          await supabase.from("property_events").insert({
            property_id: unitData.property_id,
            event_type: "status_change",
            old_value: { status: "occupied" },
            new_value: { status: "off_market" },
            performed_by: null,
            reason: "All tenancies expired — property moved to off-market",
          });
        }
      }

      await supabase.from("notifications").insert([
        { user_id: t.tenant_user_id, title: "Tenancy Expired", body: `Your tenancy ${t.registration_code} has expired. The unit is now unlocked.`, link: "/tenant/my-agreements" },
        { user_id: t.landlord_user_id, title: "Tenancy Expired", body: `Tenancy ${t.registration_code} has expired. The unit is now vacant. Your property is now off-market. You can relist it from My Properties when ready.`, link: "/landlord/my-properties" },
      ]);
      expiredCount++;
    }

    console.log(`Auto-expired ${expiredCount} tenancies`);

    return new Response(JSON.stringify({ ok: true, updated, expired: expiredCount }), {
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

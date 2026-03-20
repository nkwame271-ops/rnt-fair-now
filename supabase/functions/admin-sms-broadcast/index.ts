import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
    if (!ARKESEL_API_KEY) throw new Error("ARKESEL_API_KEY not configured");

    // Verify caller is regulator
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check regulator role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "regulator")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // === CHECK BALANCE ===
    if (action === "check-balance") {
      const params = new URLSearchParams({
        action: "check-balance",
        api_key: ARKESEL_API_KEY,
        response: "json",
      });
      const res = await fetch(`${ARKESEL_V1_URL}?${params.toString()}`);
      const text = await res.text();
      console.log("Balance response:", text);
      
      let balance = null;
      try {
        const parsed = JSON.parse(text);
        balance = parsed.balance ?? parsed.data?.balance ?? null;
      } catch {
        // Try to extract number from text
        const match = text.match(/[\d.]+/);
        if (match) balance = parseFloat(match[0]);
      }

      return new Response(
        JSON.stringify({ balance, raw: text }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === SEND BROADCAST ===
    if (action === "send-broadcast") {
      const { message, recipientFilter, region, schedule } = body;
      if (!message) throw new Error("message is required");

      // Build query for phone numbers
      let query = adminClient.from("profiles").select("phone, user_id");

      if (recipientFilter === "tenants" || recipientFilter === "landlords") {
        const roleName = recipientFilter === "tenants" ? "tenant" : "landlord";
        const { data: roleUsers } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", roleName);
        const userIds = (roleUsers || []).map((r: any) => r.user_id);
        if (userIds.length === 0) {
          return new Response(
            JSON.stringify({ success: true, sent: 0, failed: 0, message: "No recipients found" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        query = query.in("user_id", userIds);
      }

      const { data: profiles, error: profilesErr } = await query;
      if (profilesErr) throw new Error("Failed to fetch recipients: " + profilesErr.message);

      let recipients = (profiles || []).filter((p: any) => p.phone && p.phone.trim());

      // Region filter — check if landlord/tenant has properties/tenancies in region
      // For simplicity, we send to all matching role users (region filtering would need joins)

      let sent = 0;
      let failed = 0;
      const senderID = "RentGhana";

      for (const recipient of recipients) {
        let phone = recipient.phone.replace(/\s/g, "").replace(/^0/, "233");
        if (!phone.startsWith("233")) phone = "233" + phone;

        const params: Record<string, string> = {
          action: "send-sms",
          api_key: ARKESEL_API_KEY,
          to: phone,
          from: senderID,
          sms: message,
        };
        if (schedule) {
          params.schedule = schedule;
        }

        const qs = new URLSearchParams(params);
        try {
          const res = await fetch(`${ARKESEL_V1_URL}?${qs.toString()}`);
          if (res.ok) {
            sent++;
          } else {
            failed++;
            console.error(`Failed to send to ${phone}:`, await res.text());
          }
        } catch (err) {
          failed++;
          console.error(`Error sending to ${phone}:`, err);
        }
      }

      // Log to audit
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: userId,
        action: "sms_broadcast",
        target_type: "sms",
        target_id: recipientFilter || "all",
        reason: `Broadcast to ${recipients.length} recipients (${sent} sent, ${failed} failed)${schedule ? ` scheduled: ${schedule}` : ""}`,
        new_state: { message: message.substring(0, 200), recipientFilter, schedule },
      });

      return new Response(
        JSON.stringify({ success: true, sent, failed, total: recipients.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("SMS Broadcast error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

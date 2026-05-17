import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    const {
      report_kind,
      category,
      emergency_type,
      description,
      property_id,
      unit_id,
      hostel_or_hall,
      school,
      latitude,
      longitude,
      location_accuracy,
      location_address,
      is_silent,
      evidence_urls,
      user_role,
      severity,
    } = body ?? {};

    if (!report_kind || !["safety_report", "panic_emergency"].includes(report_kind)) {
      return new Response(JSON.stringify({ error: "Invalid report_kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Snapshot profile
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .maybeSingle();

    // Count prior false alerts
    const { count: falseAlertCount } = await admin
      .from("safety_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "false_alert");

    const effectiveSeverity =
      severity ?? (report_kind === "panic_emergency" ? "critical" : "medium");

    const { data: inserted, error: insErr } = await admin
      .from("safety_reports")
      .insert({
        report_kind,
        category: category ?? null,
        emergency_type: emergency_type ?? null,
        user_id: user.id,
        user_role: user_role ?? "tenant",
        user_name_snapshot: profile?.full_name ?? null,
        user_phone_snapshot: profile?.phone ?? null,
        property_id: property_id ?? null,
        unit_id: unit_id ?? null,
        hostel_or_hall: hostel_or_hall ?? null,
        school: school ?? null,
        description: description ?? null,
        evidence_urls: evidence_urls ?? [],
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        location_accuracy: location_accuracy ?? null,
        location_address: location_address ?? null,
        is_silent: !!is_silent,
        severity: effectiveSeverity,
        false_alert_count_at_time: falseAlertCount ?? 0,
      })
      .select("id, ticket_number")
      .single();

    if (insErr) throw insErr;

    // Audit log
    await admin.from("safety_audit_log").insert({
      report_id: inserted.id,
      actor_user_id: user.id,
      action: "created",
      details: { report_kind, emergency_type, is_silent: !!is_silent },
    });

    // Fan-out SMS to safety contacts (best-effort, non-blocking)
    try {
      const { data: contacts } = await admin
        .from("safety_contacts")
        .select("phone, contact_type")
        .eq("active", true)
        .not("phone", "is", null);

      const message =
        report_kind === "panic_emergency"
          ? `RentControl SAFETY: PANIC alert ${inserted.ticket_number} from ${profile?.full_name ?? "user"} (${profile?.phone ?? "no phone"}). Type: ${emergency_type ?? "n/a"}. Open admin Safety dashboard now.`
          : `RentControl SAFETY: New safety report ${inserted.ticket_number} from ${profile?.full_name ?? "user"}. Category: ${category ?? "n/a"}.`;

      const phones = (contacts ?? []).map((c) => c.phone).filter(Boolean) as string[];
      await Promise.all(
        phones.map((phone) =>
          admin.functions.invoke("send-sms", { body: { phone, message } }).catch(() => null)
        )
      );
    } catch (e) {
      console.error("Safety contact fan-out failed", e);
    }

    // In-app notify all main admins
    try {
      const { data: admins } = await admin
        .from("admin_staff")
        .select("user_id")
        .in("admin_type", ["main_admin", "super_admin"]);
      if (admins?.length) {
        const rows = admins.map((a: any) => ({
          user_id: a.user_id,
          title: report_kind === "panic_emergency" ? "🚨 PANIC ALERT" : "New Safety Report",
          body: `${inserted.ticket_number} from ${profile?.full_name ?? "user"}`,
          link: `/regulator/safety/${inserted.id}`,
        }));
        await admin.from("notifications").insert(rows);
      }
    } catch (e) {
      console.error("Notify admins failed", e);
    }

    return new Response(
      JSON.stringify({ success: true, id: inserted.id, ticket_number: inserted.ticket_number }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-safety-report error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

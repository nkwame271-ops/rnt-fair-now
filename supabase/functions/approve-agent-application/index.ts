import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * approve-agent-application
 *
 * Body: { application_id: uuid, decision: "approved" | "rejected", reviewer_notes?: string }
 *
 * On approve:
 *  - Marks application approved
 *  - Inserts agent_staff row for the applicant's linked auth user
 *  - Assigns the `agent` role in user_roles
 *
 * On reject: marks application rejected with notes.
 *
 * Requires the caller to be an authenticated main/super admin.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !user) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabaseAdmin.rpc("is_main_admin", { _user_id: user.id });
    if (!isAdmin) throw new Error("Forbidden — admin role required");

    const body = await req.json();
    const application_id: string = body.application_id;
    const decision: "approved" | "rejected" = body.decision;
    const reviewer_notes: string = (body.reviewer_notes || "").toString().slice(0, 1000);

    if (!application_id || !["approved", "rejected"].includes(decision)) {
      throw new Error("Invalid request");
    }

    const { data: app, error: fetchErr } = await supabaseAdmin
      .from("agent_applications")
      .select("*")
      .eq("id", application_id)
      .maybeSingle();
    if (fetchErr || !app) throw new Error("Application not found");
    if (app.status !== "pending") throw new Error(`Application already ${app.status}`);

    if (decision === "rejected") {
      const { error: updErr } = await supabaseAdmin
        .from("agent_applications")
        .update({
          status: "rejected",
          reviewer_notes,
          reviewer_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", application_id);
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve path — applicant must have a linked auth user
    if (!app.applicant_user_id) {
      throw new Error("Applicant has no linked user account. Ask them to sign in first and re-apply.");
    }

    // Insert agent_staff (upsert on user_id)
    const { error: staffErr } = await supabaseAdmin
      .from("agent_staff")
      .upsert({
        user_id: app.applicant_user_id,
        application_id: app.id,
        status: "active",
        full_name: app.full_name,
        phone: app.phone,
        email: app.email,
        professional_photo_url: app.professional_photo_url,
        region: app.region,
        operating_area: app.operating_area,
      }, { onConflict: "user_id" });
    if (staffErr) throw staffErr;

    // Assign agent role (idempotent)
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: app.applicant_user_id, role: "agent" as any },
      { onConflict: "user_id,role" }
    );

    const { error: updErr } = await supabaseAdmin
      .from("agent_applications")
      .update({
        status: "approved",
        reviewer_notes,
        reviewer_user_id: user.id,
        reviewed_at: new Date().toISOString(),
        approved_user_id: app.applicant_user_id,
      })
      .eq("id", application_id);
    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, agent_user_id: app.applicant_user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("approve-agent-application error:", err.message);
    return new Response(JSON.stringify({ error: err.message || "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

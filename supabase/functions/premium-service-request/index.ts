import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Please sign in to continue." }, 200);

    const { subscription_id, request_type = "landlord_request", note } = await req.json();
    if (!subscription_id || typeof subscription_id !== "string") return json({ error: "subscription_id is required" }, 200);
    if (!note || typeof note !== "string" || !note.trim()) return json({ error: "Request details are required" }, 200);

    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const { data: claims } = await (anon.auth as any).getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json({ error: "Your session has expired. Please sign in again." }, 200);

    const { data: sub, error: subErr } = await admin
      .from("premium_subscriptions")
      .select("id, property_id, subscriber_user_id, assigned_agent_user_id, status")
      .eq("id", subscription_id)
      .maybeSingle();
    if (subErr) throw subErr;
    if (!sub || sub.subscriber_user_id !== userId) return json({ error: "Premium subscription not found." }, 200);
    if (!sub.assigned_agent_user_id) return json({ error: "No agent is assigned to this subscription yet." }, 200);
    if (!["active", "pending"].includes(sub.status)) return json({ error: "This subscription is not active." }, 200);

    const { data: task, error: taskErr } = await admin
      .from("management_task_assignments")
      .insert({
        property_id: sub.property_id,
        task_type: request_type,
        assigned_staff_id: sub.assigned_agent_user_id,
        status: "open",
        assigned_at: new Date().toISOString(),
        created_by: userId,
        notes: note.trim().slice(0, 1000),
      })
      .select("id")
      .single();
    if (taskErr) throw taskErr;

    await admin.from("notifications").insert({
      user_id: sub.assigned_agent_user_id,
      title: "New Premium Service request",
      body: note.trim().slice(0, 500),
    });

    return json({ ok: true, task_id: task.id });
  } catch (e: any) {
    console.error("premium-service-request error:", e?.message);
    return json({ error: e?.message || "Could not submit request" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Backend configuration unavailable" }, 500);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: staff } = await admin.from("admin_staff").select("id").eq("user_id", user.id).maybeSingle();
    if (!staff) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    if (body?.action === "confirm_complaint_receipt") {
      if (typeof body.receipt_id !== "string" || !body.receipt_id) return json({ error: "receipt_id is required" }, 400);
      const { data, error } = await admin.rpc("confirm_complaint_receipt", {
        p_receipt_id: body.receipt_id,
        p_actor: user.id,
      });
      if (error) return json({ error: error.message }, 400);
      return json(data);
    }

    if (body?.action === "office_summary") {
      if (typeof body.office_id !== "string" || !body.office_id) return json({ error: "office_id is required" }, 400);
      const from = typeof body.from === "string" && body.from ? `${body.from}T00:00:00Z` : null;
      const to = typeof body.to === "string" && body.to ? `${body.to}T23:59:59Z` : null;
      const { data, error } = await admin.rpc("payment_reconciliation_summary", {
        p_office_id: body.office_id,
        p_from: from,
        p_to: to,
        p_actor: user.id,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ rows: data ?? [] });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected reconciliation error" }, 500);
  }
});
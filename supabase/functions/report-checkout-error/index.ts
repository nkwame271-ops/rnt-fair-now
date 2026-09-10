import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.23.8";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BodySchema = z.object({
  reference: z.string().min(3).max(180),
  stage: z.enum(["inline_load", "inline_open", "inline_error", "inline_cancel", "hosted_fallback"]),
  message: z.string().min(1).max(500),
  context: z.object({
    userAgent: z.string().max(500).optional(),
    viewport: z.string().max(40).optional(),
    online: z.boolean().optional(),
  }).strict().optional(),
}).strict();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Not authenticated" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anonKey || !serviceKey) return json({ error: "Service unavailable" }, 503);

    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(url, serviceKey);
    const { data: transaction } = await admin
      .from("escrow_transactions")
      .select("id, user_id, payment_type, status")
      .eq("reference", parsed.data.reference)
      .maybeSingle();
    if (!transaction) return json({ error: "Transaction not found" }, 404);

    let authorized = transaction.user_id === user.id;
    if (!authorized) {
      const [{ data: staff }, { data: role }] = await Promise.all([
        admin.from("admin_staff").select("user_id").eq("user_id", user.id).maybeSingle(),
        admin.from("user_roles").select("role").eq("user_id", user.id).in("role", ["regulator", "nugs_admin"]).maybeSingle(),
      ]);
      authorized = Boolean(staff || role);
    }
    if (!authorized) return json({ error: "Unauthorized" }, 403);

    const { error } = await admin.from("payment_processing_errors").insert({
      escrow_transaction_id: transaction.id,
      reference: parsed.data.reference,
      function_name: "branded-checkout",
      error_stage: parsed.data.stage,
      error_message: parsed.data.message,
      error_context: {
        ...parsed.data.context,
        payment_type: transaction.payment_type,
        local_status: transaction.status,
        reporter_user_id: user.id,
      },
      severity: parsed.data.stage === "inline_error" ? "warning" : "info",
    });
    if (error) throw error;

    return json({ recorded: true });
  } catch (error) {
    console.error("report-checkout-error:", error instanceof Error ? error.message : String(error));
    return json({ error: "Could not record checkout error" }, 500);
  }
});
// Dispatches queued api_webhook_deliveries to subscriber URLs with HMAC-SHA256 signature.
// Invoke periodically (cron) or on demand by passing { delivery_id } to retry a single delivery.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BACKOFF_MIN = [1, 5, 30, 120, 720, 1440]; // minutes per attempt
const MAX_ATTEMPTS = BACKOFF_MIN.length;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let onlyId: string | null = null;
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    onlyId = body?.delivery_id ?? null;
  } catch { /* noop */ }

  let q = supabase.from("api_webhook_deliveries").select("*, endpoint:api_webhook_endpoints(*)")
    .eq("status", "pending").lte("next_retry_at", new Date().toISOString()).limit(50);
  if (onlyId) q = supabase.from("api_webhook_deliveries").select("*, endpoint:api_webhook_endpoints(*)").eq("id", onlyId);

  const { data: deliveries, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const results: any[] = [];
  for (const d of (deliveries || [])) {
    const r = await dispatch(supabase, d);
    results.push(r);
  }
  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function dispatch(supabase: any, d: any) {
  const ep = d.endpoint;
  if (!ep || ep.status !== "active") {
    await supabase.from("api_webhook_deliveries").update({ status: "exhausted", response_body: "Endpoint disabled" }).eq("id", d.id);
    return { id: d.id, status: "skipped" };
  }
  const attempt = d.attempt + 1;
  const startTs = Date.now();
  const t = Math.floor(Date.now() / 1000);
  const bodyStr = JSON.stringify({
    id: d.event_id, type: d.event_type, created_at: d.created_at, data: d.payload,
  });
  const sig = createHmac("sha256", ep.secret).update(`${t}.${bodyStr}`).digest("hex");

  let response_status: number | null = null;
  let response_body = "";
  let ok = false;
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "RentControlGhana-Webhook/1.0",
        "X-RentControl-Signature": `t=${t},v1=${sig}`,
        "X-RentControl-Event": d.event_type,
        "X-RentControl-Delivery": d.id,
      },
      body: bodyStr,
      signal: AbortSignal.timeout(15000),
    });
    response_status = res.status;
    response_body = (await res.text()).slice(0, 2000);
    ok = res.ok;
  } catch (e) {
    response_body = `Network error: ${(e as Error).message}`;
  }

  const duration_ms = Date.now() - startTs;

  if (ok) {
    await supabase.from("api_webhook_deliveries").update({
      status: "succeeded", attempt, response_status, response_body, duration_ms,
    }).eq("id", d.id);
    await supabase.from("api_webhook_endpoints").update({
      last_delivery_at: new Date().toISOString(),
      last_success_at: new Date().toISOString(),
      consecutive_failures: 0,
      status: "active",
    }).eq("id", ep.id);
    return { id: d.id, status: "succeeded" };
  }

  if (attempt >= MAX_ATTEMPTS) {
    await supabase.from("api_webhook_deliveries").update({
      status: "exhausted", attempt, response_status, response_body, duration_ms,
    }).eq("id", d.id);
    await supabase.from("api_webhook_endpoints").update({
      last_delivery_at: new Date().toISOString(),
      consecutive_failures: ep.consecutive_failures + 1,
      status: ep.consecutive_failures + 1 >= 10 ? "disabled" : "failing",
    }).eq("id", ep.id);
    return { id: d.id, status: "exhausted" };
  }

  const nextDelayMin = BACKOFF_MIN[attempt];
  const next = new Date(Date.now() + nextDelayMin * 60_000).toISOString();
  await supabase.from("api_webhook_deliveries").update({
    status: "pending", attempt, response_status, response_body, duration_ms, next_retry_at: next,
  }).eq("id", d.id);
  await supabase.from("api_webhook_endpoints").update({
    last_delivery_at: new Date().toISOString(),
    consecutive_failures: ep.consecutive_failures + 1,
    status: "failing",
  }).eq("id", ep.id);
  return { id: d.id, status: "retry", next };
}

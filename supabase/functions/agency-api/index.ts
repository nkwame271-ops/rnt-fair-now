import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_VERSION = "v1";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key, x-api-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-request-id, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after, x-api-version",
};
const securityHeaders = {
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type ResponseExtras = {
  requestId: string;
  rateLimit?: { limit: number; remaining: number; reset: number };
  apiVersion?: string;
};

function jsonResponse(data: unknown, status: number, extras: ResponseExtras) {
  const headers: Record<string, string> = {
    ...corsHeaders, ...securityHeaders,
    "Content-Type": "application/json",
    "X-Request-Id": extras.requestId,
    "X-API-Version": extras.apiVersion || API_VERSION,
  };
  if (extras.rateLimit) {
    headers["X-RateLimit-Limit"] = String(extras.rateLimit.limit);
    headers["X-RateLimit-Remaining"] = String(extras.rateLimit.remaining);
    headers["X-RateLimit-Reset"] = String(extras.rateLimit.reset);
    if (status === 429) headers["Retry-After"] = "60";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function problem(extras: ResponseExtras, status: number, title: string, detail?: string, type = "about:blank") {
  return jsonResponse({ type, title, status, detail, request_id: extras.requestId }, status, extras);
}

const SCOPE_MAP: Record<string, string[]> = {
  "tax:read": ["tax/landlord-income", "tax/rent-tax-collected", "tax/landlord-list"],
  "tenants:read": [
    "tenants/registered", "tenants/without-landlord", "tenants/expired-registration",
    "tenants/rent-card-delivery", "tenants/non-citizens",
    "tenants/list", "tenants/detail",
  ],
  "landlords:read": [
    "landlords/registered", "landlords/unregistered-fee", "landlords/property-count",
    "landlords/list", "landlords/detail",
  ],
  "properties:read": [
    "properties/by-region", "properties/vacant-units", "properties/conditions",
    "properties/list", "properties/detail",
  ],
  "complaints:read": ["complaints/list", "complaints/summary", "complaints/detail"],
  "stats:read": ["stats/overview", "stats/regional-breakdown", "stats/citizen-breakdown"],
  "identity:read": ["identity/kyc-stats", "identity/ghana-card-usage"],
};

function maskPhone(p?: string | null) {
  if (!p) return null;
  const s = String(p);
  return s.length < 6 ? "***" : s.slice(0, 3) + "****" + s.slice(-3);
}
function maskEmail(e?: string | null) {
  if (!e) return null;
  const [u, d] = String(e).split("@");
  if (!d) return "***";
  return (u?.[0] || "*") + "***@" + d;
}
function getClientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") || null;
}

function buildOpenApi() {
  const endpoints = Object.entries(SCOPE_MAP).flatMap(([scope, list]) =>
    list.map((ep) => ({ endpoint: ep, scope }))
  );
  return {
    openapi: "3.1.0",
    info: { title: "Rent Control Ghana — Agency API", version: API_VERSION,
      description: "Read-only API for accredited Ghanaian agencies." },
    servers: [{ url: "/agency-api" }],
    components: { securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } } },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      "/v1/health": { get: { summary: "Health check" } },
      "/v1/me": { get: { summary: "Key introspection" } },
      "/": { post: { summary: "Invoke a data endpoint",
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["endpoint"],
          properties: { endpoint: { type: "string", enum: endpoints.map((e) => e.endpoint) }, filters: { type: "object" } } } } } } } },
    },
    "x-endpoints": endpoints,
  };
}

serve(async (req) => {
  const requestId = crypto.randomUUID();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/agency-api\/?/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  const extras: ResponseExtras = { requestId, apiVersion: API_VERSION };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { ...corsHeaders, "X-Request-Id": requestId } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Public endpoints (no auth) ──
  if (path === "health" || path === "v1/health") {
    return jsonResponse({ status: "ok", time: new Date().toISOString(), version: API_VERSION }, 200, extras);
  }
  if (path === "openapi.json" || path === "v1/openapi.json") {
    return jsonResponse(buildOpenApi(), 200, extras);
  }

  const startedAt = Date.now();
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  const logCtx: {
    api_key_id?: string; agency_name?: string; endpoint?: string;
    scope_used?: string; status_code: number; error_message?: string;
    request_params?: unknown;
  } = { status_code: 500 };

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      logCtx.status_code = 401; logCtx.error_message = "Missing X-API-Key";
      return problem(extras, 401, "Missing API key", "Send your key in the X-API-Key header.");
    }

    const keyHash = await hashKey(apiKey);
    const prefix = apiKey.slice(0, 16);

    let { data: keyRecord } = await supabase.from("api_keys").select("*")
      .eq("key_prefix", prefix).eq("api_key_hash", keyHash).maybeSingle();
    if (!keyRecord) {
      const fb = await supabase.from("api_keys").select("*").eq("api_key_hash", keyHash).maybeSingle();
      keyRecord = fb.data;
    }
    if (!keyRecord) {
      const { data: gr } = await supabase.from("api_keys").select("*")
        .eq("previous_key_hash", keyHash)
        .gte("previous_key_expires_at", new Date().toISOString())
        .maybeSingle();
      if (gr) { keyRecord = gr; logCtx.error_message = "rotation_grace"; }
    }
    if (!keyRecord) {
      logCtx.status_code = 403; logCtx.error_message = "Invalid key";
      return problem(extras, 403, "Invalid API key", "The key was not recognised.");
    }

    logCtx.api_key_id = keyRecord.id;
    logCtx.agency_name = keyRecord.agency_name;

    if (!keyRecord.is_active || keyRecord.revoked_at) {
      logCtx.status_code = 403; logCtx.error_message = "Revoked";
      return problem(extras, 403, "API key revoked");
    }
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      logCtx.status_code = 403; logCtx.error_message = "Expired";
      return problem(extras, 403, "API key expired");
    }
    if (Array.isArray(keyRecord.allowed_ip_cidrs) && keyRecord.allowed_ip_cidrs.length > 0) {
      if (!ip || !keyRecord.allowed_ip_cidrs.includes(ip)) {
        logCtx.status_code = 403; logCtx.error_message = `IP ${ip ?? "?"} blocked`;
        return problem(extras, 403, "IP not allowed", `Request IP ${ip ?? "unknown"} not in allowlist.`);
      }
    }

    const rl = Number(keyRecord.rate_limit_per_minute) || 60;
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count: recentCount } = await supabase.from("api_request_log")
      .select("id", { count: "exact", head: true })
      .eq("api_key_id", keyRecord.id).gte("created_at", since);
    const used = recentCount ?? 0;
    extras.rateLimit = { limit: rl, remaining: Math.max(0, rl - used), reset: 60 };
    if (used >= rl) {
      logCtx.status_code = 429; logCtx.error_message = `Rate limit ${rl}/min`;
      return problem(extras, 429, "Rate limit exceeded", `Limit ${rl}/min. Retry after 60s.`);
    }

    // ── /v1/me introspection ──
    if (path === "me" || path === "v1/me") {
      const { data: sub } = await supabase.from("api_subscriptions")
        .select("*, plan:api_pricing_plans(name, slug, included_calls, environment_access)")
        .eq("api_key_id", keyRecord.id).in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: counter } = await supabase.from("api_usage_counters")
        .select("*").eq("api_key_id", keyRecord.id)
        .order("period_start", { ascending: false }).limit(1).maybeSingle();
      logCtx.status_code = 200; logCtx.endpoint = "v1/me";
      return jsonResponse({
        agency: keyRecord.agency_name,
        environment: keyRecord.environment,
        scopes: keyRecord.scopes || [],
        rate_limit_per_minute: rl,
        expires_at: keyRecord.expires_at,
        plan: sub?.plan ?? null,
        usage: counter ? {
          period_start: counter.period_start, period_end: counter.period_end,
          calls_count: counter.calls_count, overage_calls: counter.overage_calls,
        } : null,
      }, 200, extras);
    }

    if (req.method !== "POST") {
      logCtx.status_code = 405;
      return problem(extras, 405, "Method not allowed", "Use POST for data endpoints.");
    }
    const body = await req.json();
    const { endpoint, filters = {} } = body || {};
    logCtx.endpoint = endpoint;
    logCtx.request_params = filters;
    if (!endpoint) {
      logCtx.status_code = 400; logCtx.error_message = "Missing endpoint";
      return problem(extras, 400, "Missing endpoint", "Body must contain `endpoint`.");
    }

    const scopes: string[] = keyRecord.scopes || [];
    const matchingScope = scopes.find((s) => (SCOPE_MAP[s] || []).includes(endpoint));
    if (!matchingScope) {
      logCtx.status_code = 403; logCtx.error_message = `Not authorised: ${endpoint}`;
      return problem(extras, 403, "Endpoint not authorised",
        `Endpoint '${endpoint}' not allowed. Granted scopes: ${scopes.join(", ") || "(none)"}.`);
    }
    logCtx.scope_used = matchingScope;

    // ── Billing / quota enforcement (only when master switch ON) ──
    const { data: billCfg } = await supabase.from("platform_config")
      .select("config_value").eq("config_key", "agency_api_billing_enabled").maybeSingle();
    const billingOn = !!(billCfg?.config_value as any)?.enabled;
    const overrideFree = keyRecord.billing_override === "free";

    if (billingOn && !overrideFree) {
      let planRow: any = null;
      if (keyRecord.current_plan_id) {
        const { data } = await supabase.from("api_pricing_plans").select("*").eq("id", keyRecord.current_plan_id).maybeSingle();
        planRow = data;
      }
      if (!planRow) {
        logCtx.status_code = 402;
        return problem(extras, 402, "Subscription required",
          "Billing is enabled but this key has no active plan. Contact the regulator to subscribe.");
      }
      if (planRow.environment_access !== "both" && planRow.environment_access !== keyRecord.environment) {
        logCtx.status_code = 403;
        return problem(extras, 403, "Environment not allowed by plan",
          `Plan '${planRow.slug}' grants ${planRow.environment_access} access only.`);
      }
      const periodStart = new Date(); periodStart.setUTCDate(1); periodStart.setUTCHours(0, 0, 0, 0);
      const periodEnd = new Date(periodStart); periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
      const { data: usage } = await supabase.rpc("api_increment_usage", {
        p_api_key_id: keyRecord.id,
        p_period_start: periodStart.toISOString(),
        p_period_end: periodEnd.toISOString(),
        p_included_calls: planRow.included_calls,
        p_overage_price_per_1k: planRow.overage_price_ghs_per_1k,
      });
      if (usage && (usage as any).over_quota && !(usage as any).overage_billable) {
        logCtx.status_code = 429;
        return problem(extras, 429, "Monthly quota exceeded",
          `Plan '${planRow.slug}' includes ${planRow.included_calls} calls/month. Upgrade to continue.`);
      }
    }

    await supabase.from("api_keys")
      .update({ last_used_at: new Date().toISOString(), last_used_ip: ip })
      .eq("id", keyRecord.id);

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 100, 500);
    const offset = (page - 1) * limit;
    const region = filters.region;

    const result = await handleEndpoint(supabase, endpoint, {
      ...filters, limit, offset, region,
      _hasIdentityScope: scopes.includes("identity:read") && !!keyRecord.dsa_signed_at,
    });

    logCtx.status_code = 200;
    return jsonResponse({
      success: true, endpoint, agency: keyRecord.agency_name, data: result,
      meta: { page, page_size: limit, request_id: requestId },
    }, 200, extras);
  } catch (error: unknown) {
    console.error("Agency API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    logCtx.error_message = msg;
    return problem(extras, 500, "Internal server error", msg);
  } finally {
    try {
      await supabase.from("api_request_log").insert({
        api_key_id: logCtx.api_key_id ?? null,
        agency_name: logCtx.agency_name ?? null,
        endpoint: logCtx.endpoint ?? "(unknown)",
        scope_used: logCtx.scope_used ?? null,
        method: req.method,
        status_code: logCtx.status_code,
        response_ms: Date.now() - startedAt,
        ip, user_agent: userAgent,
        request_params: logCtx.request_params ?? null,
        error_message: logCtx.error_message ?? null,
      });
    } catch (e) { console.error("log insert failed:", e); }
  }
});

async function handleEndpoint(supabase: any, endpoint: string, filters: any) {
  const { limit, offset, region } = filters;

  switch (endpoint) {
    // ── TAX ──
    case "tax/landlord-income": {
      let query = supabase
        .from("rent_payments")
        .select("tenancy_id, monthly_rent, tax_amount, amount_to_landlord, status, paid_date, due_date, tenancies!inner(landlord_user_id, unit_id)")
        .eq("status", "paid")
        .range(offset, offset + limit - 1);
      const { data, error } = await query;
      if (error) throw error;

      // Aggregate by landlord
      const landlordIncome: Record<string, { total_rent: number; total_tax: number; payment_count: number }> = {};
      for (const p of data || []) {
        const lid = p.tenancies?.landlord_user_id;
        if (!lid) continue;
        if (!landlordIncome[lid]) landlordIncome[lid] = { total_rent: 0, total_tax: 0, payment_count: 0 };
        landlordIncome[lid].total_rent += Number(p.amount_to_landlord);
        landlordIncome[lid].total_tax += Number(p.tax_amount);
        landlordIncome[lid].payment_count++;
      }
      return Object.entries(landlordIncome).map(([landlord_user_id, stats]) => ({ landlord_user_id, ...stats }));
    }

    case "tax/rent-tax-collected": {
      const { data, error } = await supabase
        .from("rent_payments")
        .select("tax_amount, paid_date, due_date")
        .eq("status", "paid");
      if (error) throw error;
      const total = (data || []).reduce((sum: number, r: any) => sum + Number(r.tax_amount), 0);
      return { total_tax_collected: total, payment_count: (data || []).length };
    }

    case "tax/landlord-list": {
      const { data, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, status, registration_fee_paid, profiles!inner(full_name, phone, email)")
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
    }

    // ── TENANTS ──
    case "tenants/registered": {
      let query = supabase
        .from("tenants")
        .select("user_id, tenant_id, status, registration_fee_paid, registration_date, expiry_date, profiles!inner(full_name, phone, region:delivery_region)")
        .range(offset, offset + limit - 1);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    case "tenants/without-landlord": {
      const { data: tenants, error: tErr } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, profiles!inner(full_name, phone)")
        .range(offset, offset + limit - 1);
      if (tErr) throw tErr;

      const { data: activeTenancies } = await supabase
        .from("tenancies")
        .select("tenant_user_id")
        .eq("status", "active");

      const activeTenantIds = new Set((activeTenancies || []).map((t: any) => t.tenant_user_id));
      return (tenants || []).filter((t: any) => !activeTenantIds.has(t.user_id));
    }

    case "tenants/expired-registration": {
      const { data, error } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, expiry_date, profiles!inner(full_name, phone)")
        .lt("expiry_date", new Date().toISOString())
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
    }

    case "tenants/rent-card-delivery": {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, delivery_address, delivery_area, delivery_region, delivery_landmark")
        .not("delivery_address", "is", null)
        .neq("delivery_address", "")
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
    }

    case "tenants/non-citizens": {
      // SECURITY: do not return residence_permit_no or other PII to external agencies.
      // Return aggregated counts by nationality only.
      const { data, error } = await supabase
        .from("profiles")
        .select("nationality")
        .eq("is_citizen", false);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const key = (r.nationality || "unknown").trim() || "unknown";
        counts[key] = (counts[key] || 0) + 1;
      });
      const by_nationality = Object.entries(counts).map(([nationality, count]) => ({ nationality, count }));
      return { total: (data || []).length, by_nationality };
    }

    // ── LANDLORDS ──
    case "landlords/registered": {
      const { data, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, status, registration_fee_paid, registration_date, expiry_date, profiles!inner(full_name, phone, email)")
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
    }

    case "landlords/unregistered-fee": {
      const { data, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, profiles!inner(full_name, phone)")
        .eq("registration_fee_paid", false)
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
    }

    case "landlords/property-count": {
      const { data: landlords, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, profiles!inner(full_name)")
        .range(offset, offset + limit - 1);
      if (error) throw error;

      const result = [];
      for (const l of landlords || []) {
        const { count } = await supabase.from("properties").select("id", { count: "exact", head: true }).eq("landlord_user_id", l.user_id);
        result.push({ ...l, property_count: count || 0 });
      }
      return result;
    }

    // ── PROPERTIES ──
    case "properties/by-region": {
      const { data, error } = await supabase
        .from("properties")
        .select("region, id");
      if (error) throw error;
      const grouped: Record<string, number> = {};
      for (const p of data || []) {
        grouped[p.region] = (grouped[p.region] || 0) + 1;
      }
      return Object.entries(grouped).map(([region, count]) => ({ region, count }));
    }

    case "properties/vacant-units": {
      let query = supabase
        .from("units")
        .select("id, unit_name, unit_type, monthly_rent, status, properties!inner(address, area, region)")
        .eq("status", "vacant")
        .range(offset, offset + limit - 1);
      if (region) query = query.eq("properties.region", region);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    case "properties/conditions": {
      const { data, error } = await supabase
        .from("properties")
        .select("property_condition, region");
      if (error) throw error;
      const summary: Record<string, Record<string, number>> = {};
      for (const p of data || []) {
        const cond = p.property_condition || "unknown";
        if (!summary[cond]) summary[cond] = {};
        summary[cond][p.region] = (summary[cond][p.region] || 0) + 1;
      }
      return summary;
    }

    // ── COMPLAINTS ──
    case "complaints/list": {
      let query = supabase
        .from("complaints")
        .select("id, complaint_code, complaint_type, region, status, created_at, landlord_name, property_address")
        .range(offset, offset + limit - 1);
      if (region) query = query.eq("region", region);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.complaint_type) query = query.eq("complaint_type", filters.complaint_type);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    case "complaints/summary": {
      const { data, error } = await supabase
        .from("complaints")
        .select("complaint_type, region, status");
      if (error) throw error;
      const byType: Record<string, number> = {};
      const byRegion: Record<string, number> = {};
      for (const c of data || []) {
        byType[c.complaint_type] = (byType[c.complaint_type] || 0) + 1;
        byRegion[c.region] = (byRegion[c.region] || 0) + 1;
      }
      return { by_type: byType, by_region: byRegion, total: (data || []).length };
    }

    // ── STATS ──
    case "stats/overview": {
      const [tenants, landlords, properties, units, complaints] = await Promise.all([
        supabase.from("tenants").select("id", { count: "exact", head: true }),
        supabase.from("landlords").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id", { count: "exact", head: true }),
        supabase.from("units").select("id", { count: "exact", head: true }),
        supabase.from("complaints").select("id", { count: "exact", head: true }),
      ]);
      const { data: taxData } = await supabase.from("rent_payments").select("tax_amount").eq("status", "paid");
      const totalTax = (taxData || []).reduce((s: number, r: any) => s + Number(r.tax_amount), 0);

      return {
        total_tenants: tenants.count || 0,
        total_landlords: landlords.count || 0,
        total_properties: properties.count || 0,
        total_units: units.count || 0,
        total_complaints: complaints.count || 0,
        total_tax_collected: totalTax,
      };
    }

    case "stats/regional-breakdown": {
      const { data: props } = await supabase.from("properties").select("region");
      const regions: Record<string, number> = {};
      for (const p of props || []) {
        regions[p.region] = (regions[p.region] || 0) + 1;
      }

      const { data: comps } = await supabase.from("complaints").select("region");
      const compRegions: Record<string, number> = {};
      for (const c of comps || []) {
        compRegions[c.region] = (compRegions[c.region] || 0) + 1;
      }

      return { properties_by_region: regions, complaints_by_region: compRegions };
    }

    case "stats/citizen-breakdown": {
      const { data, error } = await supabase.from("profiles").select("is_citizen");
      if (error) throw error;
      const citizens = (data || []).filter((p: any) => p.is_citizen).length;
      const nonCitizens = (data || []).length - citizens;
      return { citizens, non_citizens: nonCitizens, total: (data || []).length };
    }

    // ── IDENTITY ──
    case "identity/kyc-stats": {
      const { data, error } = await supabase.from("kyc_verifications").select("status");
      if (error) throw error;
      const byStatus: Record<string, number> = {};
      for (const k of data || []) {
        byStatus[k.status] = (byStatus[k.status] || 0) + 1;
      }
      return { total: (data || []).length, by_status: byStatus };
    }

    case "identity/ghana-card-usage": {
      const { count, error } = await supabase
        .from("kyc_verifications")
        .select("id", { count: "exact", head: true })
        .not("ghana_card_number", "is", null);
      if (error) throw error;
      return { ghana_cards_used: count || 0 };
    }

    // ── LANDLORDS LIST / DETAIL ──
    case "landlords/list": {
      const reveal = !!filters._hasIdentityScope;
      const { data, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, status, registration_date, expiry_date, registration_fee_paid, compliance_score, profiles!inner(full_name, phone, email, region:delivery_region)")
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data || []).map((l: any) => ({
        landlord_id: l.landlord_id,
        user_id: l.user_id,
        full_name: l.profiles?.full_name,
        phone: reveal ? l.profiles?.phone : maskPhone(l.profiles?.phone),
        email: reveal ? l.profiles?.email : maskEmail(l.profiles?.email),
        region: l.profiles?.region,
        status: l.status,
        registration_date: l.registration_date,
        expiry_date: l.expiry_date,
        registration_fee_paid: l.registration_fee_paid,
        compliance_score: l.compliance_score,
      }));
    }
    case "landlords/detail": {
      if (!filters.landlord_id) throw new Error("filters.landlord_id required");
      const reveal = !!filters._hasIdentityScope;
      const { data: l, error } = await supabase
        .from("landlords")
        .select("user_id, landlord_id, status, registration_date, expiry_date, registration_fee_paid, compliance_score, profiles!inner(full_name, phone, email, ghana_card_no, region:delivery_region)")
        .eq("landlord_id", filters.landlord_id).maybeSingle();
      if (error) throw error;
      if (!l) return null;
      const { count: propertyCount } = await supabase.from("properties")
        .select("id", { count: "exact", head: true }).eq("landlord_user_id", l.user_id);
      return {
        landlord_id: l.landlord_id,
        full_name: l.profiles?.full_name,
        phone: reveal ? l.profiles?.phone : maskPhone(l.profiles?.phone),
        email: reveal ? l.profiles?.email : maskEmail(l.profiles?.email),
        ghana_card_no: reveal ? l.profiles?.ghana_card_no : "***-****-****",
        region: l.profiles?.region,
        status: l.status,
        compliance_score: l.compliance_score,
        property_count: propertyCount || 0,
      };
    }

    // ── TENANTS LIST / DETAIL ──
    case "tenants/list": {
      const reveal = !!filters._hasIdentityScope;
      const { data, error } = await supabase
        .from("tenants")
        .select("user_id, tenant_id, status, registration_date, expiry_date, registration_fee_paid, profiles!inner(full_name, phone, email, region:delivery_region)")
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return (data || []).map((t: any) => ({
        tenant_id: t.tenant_id,
        user_id: t.user_id,
        full_name: t.profiles?.full_name,
        phone: reveal ? t.profiles?.phone : maskPhone(t.profiles?.phone),
        email: reveal ? t.profiles?.email : maskEmail(t.profiles?.email),
        region: t.profiles?.region,
        status: t.status,
        registration_date: t.registration_date,
        expiry_date: t.expiry_date,
      }));
    }
    case "tenants/detail": {
      if (!filters.tenant_id) throw new Error("filters.tenant_id required");
      const reveal = !!filters._hasIdentityScope;
      const { data: t, error } = await supabase.from("tenants")
        .select("user_id, tenant_id, status, registration_date, expiry_date, profiles!inner(full_name, phone, email, ghana_card_no, region:delivery_region)")
        .eq("tenant_id", filters.tenant_id).maybeSingle();
      if (error) throw error;
      if (!t) return null;
      const { data: tenancies } = await supabase.from("tenancies")
        .select("registration_code, status, agreed_rent, start_date, end_date")
        .eq("tenant_user_id", t.user_id);
      return {
        tenant_id: t.tenant_id,
        full_name: t.profiles?.full_name,
        phone: reveal ? t.profiles?.phone : maskPhone(t.profiles?.phone),
        email: reveal ? t.profiles?.email : maskEmail(t.profiles?.email),
        ghana_card_no: reveal ? t.profiles?.ghana_card_no : "***-****-****",
        region: t.profiles?.region,
        status: t.status,
        tenancies: tenancies || [],
      };
    }

    // ── PROPERTIES LIST / DETAIL ──
    case "properties/list": {
      let query = supabase.from("properties")
        .select("id, property_code, property_name, address, area, region, property_status, property_type, property_condition, approved_rent, created_at")
        .range(offset, offset + limit - 1);
      if (region) query = query.eq("region", region);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
    case "properties/detail": {
      if (!filters.property_code) throw new Error("filters.property_code required");
      const { data: p, error } = await supabase.from("properties")
        .select("id, property_code, property_name, address, area, region, property_status, property_type, property_condition, approved_rent, landlord_user_id")
        .eq("property_code", filters.property_code).maybeSingle();
      if (error) throw error;
      if (!p) return null;
      const { data: units } = await supabase.from("units")
        .select("unit_name, unit_type, monthly_rent, status").eq("property_id", p.id);
      return { ...p, units: units || [] };
    }

    // ── COMPLAINTS DETAIL ──
    case "complaints/detail": {
      if (!filters.complaint_code) throw new Error("filters.complaint_code required");
      const { data: c, error } = await supabase.from("complaints")
        .select("complaint_code, complaint_type, region, status, created_at, payment_status, landlord_name, property_address, description")
        .eq("complaint_code", filters.complaint_code).maybeSingle();
      if (error) throw error;
      return c;
    }

    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

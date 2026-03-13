import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Scope-to-endpoint mapping
const SCOPE_MAP: Record<string, string[]> = {
  "tax:read": ["tax/landlord-income", "tax/rent-tax-collected", "tax/landlord-list"],
  "tenants:read": [
    "tenants/registered", "tenants/without-landlord", "tenants/expired-registration",
    "tenants/rent-card-delivery", "tenants/non-citizens",
  ],
  "landlords:read": ["landlords/registered", "landlords/unregistered-fee", "landlords/property-count"],
  "properties:read": ["properties/by-region", "properties/vacant-units", "properties/conditions"],
  "complaints:read": ["complaints/list", "complaints/summary"],
  "stats:read": ["stats/overview", "stats/regional-breakdown", "stats/citizen-breakdown"],
  "identity:read": ["identity/kyc-stats", "identity/ghana-card-usage"],
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return jsonResponse({ error: "Missing X-API-Key header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate API key
    const keyHash = await hashKey(apiKey);
    const { data: keyRecord, error: keyError } = await supabase
      .from("api_keys")
      .select("*")
      .eq("api_key_hash", keyHash)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyRecord) {
      return jsonResponse({ error: "Invalid or inactive API key" }, 403);
    }

    // Update last_used_at
    await supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRecord.id);

    const { endpoint, filters = {} } = await req.json();
    if (!endpoint) {
      return jsonResponse({ error: "Missing endpoint in request body" }, 400);
    }

    // Check scope authorization
    const scopes: string[] = keyRecord.scopes || [];
    const allowedEndpoints = scopes.flatMap((s: string) => SCOPE_MAP[s] || []);
    if (!allowedEndpoints.includes(endpoint)) {
      return jsonResponse({ error: `Endpoint '${endpoint}' not authorized for this API key. Authorized scopes: ${scopes.join(", ")}` }, 403);
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 100, 500);
    const offset = (page - 1) * limit;
    const region = filters.region;

    // Route to handler
    const result = await handleEndpoint(supabase, endpoint, { ...filters, limit, offset, region });
    return jsonResponse({ success: true, endpoint, agency: keyRecord.agency_name, data: result });

  } catch (error: unknown) {
    console.error("Agency API error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: msg }, 500);
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
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, nationality, phone, residence_permit_no")
        .eq("is_citizen", false)
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return data;
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

    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

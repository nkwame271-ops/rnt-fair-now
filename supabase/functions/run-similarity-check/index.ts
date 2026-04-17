// Property similarity check — scores a complaint_property against landlord properties
// Idempotent upsert on (source_id, matched_property_id). Null lat/lng tolerated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  source_type?: string;
  source_id?: string;
}

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

function gpsPoints(distM: number | null): number {
  if (distM === null || !isFinite(distM)) return 0;
  if (distM <= 50) return 35;
  if (distM <= 150) return 25;
  if (distM <= 300) return 15;
  if (distM <= 500) return 5;
  return 0;
}

function nameSimPoints(sim: number, max: number): number {
  // sim is 0..1
  if (sim >= 0.999) return max;
  if (sim >= 0.8) return max === 25 ? 15 : 10;
  if (sim >= 0.5) return max === 25 ? 8 : 5;
  return 0;
}

function levelFor(score: number): "high" | "medium" | "low" | null {
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  if (score >= 25) return "low";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let body: Body = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const sourceId = body.source_id;
  const sourceType = body.source_type || "complaint_property";

  if (!sourceId || sourceType !== "complaint_property") {
    return ok({ error: "source_id required, source_type must be 'complaint_property'" }, 400);
  }

  try {
    // 1. Load complaint_property snapshot
    const { data: cp, error: cpErr } = await supabase
      .from("complaint_properties")
      .select("*")
      .eq("id", sourceId)
      .maybeSingle();

    if (cpErr || !cp) {
      await supabase.from("similarity_check_errors").insert({
        source_id: sourceId,
        error_message: cpErr?.message || "complaint_property not found",
      });
      return ok({ error: "complaint_property not found" }, 404);
    }

    // 2. Load all landlord properties (lightweight columns)
    const { data: props, error: propsErr } = await supabase
      .from("properties")
      .select("id, property_name, address, area, region, gps_location, landlord_user_id, property_category");

    if (propsErr) throw propsErr;

    // 3. Pre-fetch landlord names for fuzzy matching
    const landlordIds = Array.from(new Set((props || []).map((p) => p.landlord_user_id).filter(Boolean)));
    const { data: landlords } = landlordIds.length > 0
      ? await supabase.from("profiles").select("user_id, full_name").in("user_id", landlordIds)
      : { data: [] };
    const landlordNameById = new Map<string, string>(
      (landlords || []).map((l: any) => [l.user_id, (l.full_name || "").toLowerCase()])
    );

    // 4. Pre-fetch tenant filer name for tenant-boost check
    const { data: filerProfile } = await supabase
      .from("profiles").select("full_name").eq("user_id", cp.tenant_user_id).maybeSingle();
    const filerName = (filerProfile?.full_name || "").toLowerCase().trim();

    const cpLandlord = (cp.landlord_name || "").toLowerCase().trim();
    const cpPropName = (cp.property_name || "").toLowerCase().trim();
    const cpType = (cp.property_type || "").toLowerCase().trim();
    const cpAddr = (cp.address_description || "").toLowerCase();
    const cpHasGps = cp.lat !== null && cp.lng !== null;

    const upserts: any[] = [];

    for (const prop of props || []) {
      // GPS points
      let gpsPts = 0;
      if (cpHasGps && prop.gps_location) {
        const parts = String(prop.gps_location).split(/[,\s]+/).map(Number).filter((n) => !isNaN(n));
        if (parts.length >= 2) {
          const d = distMeters({ lat: Number(cp.lat), lng: Number(cp.lng) }, { lat: parts[0], lng: parts[1] });
          gpsPts = gpsPoints(d);
        }
      }

      // Landlord name fuzzy (trigram in JS via simple ratio fallback — call DB for accuracy)
      let landlordPts = 0;
      const propLandlordName = landlordNameById.get(prop.landlord_user_id) || "";
      if (cpLandlord && propLandlordName) {
        const { data: simRow } = await supabase.rpc("similarity" as any, {} as any).then(() => ({ data: null })).catch(() => ({ data: null }));
        // Use raw SQL via select for trigram similarity
        const { data: simData } = await supabase
          .from("complaint_properties")
          .select("id")
          .limit(0); // no-op to keep types happy
        // Compute via direct SQL
        const { data: simResult } = await supabase.rpc("get_name_similarity" as any, {
          a: cpLandlord, b: propLandlordName,
        } as any).then((r) => r).catch(() => ({ data: null }));
        let sim = 0;
        if (typeof simResult === "number") sim = simResult;
        else {
          // Fallback: simple Jaccard on char trigrams in JS
          sim = trigramSim(cpLandlord, propLandlordName);
        }
        landlordPts = nameSimPoints(sim, 25);
      }

      // Property name fuzzy
      let propNamePts = 0;
      if (cpPropName && prop.property_name) {
        const sim = trigramSim(cpPropName, String(prop.property_name).toLowerCase());
        propNamePts = nameSimPoints(sim, 15);
      }

      // Property type
      const propAreaType = (prop.property_category || "").toLowerCase();
      let typePts = 0;
      if (cpType && (propAreaType === cpType || (cpType.includes("hostel") && propAreaType === "student_housing") || (cpType.includes("hall") && propAreaType === "student_housing"))) {
        typePts = 10;
      }

      // Location text overlap
      let locPts = 0;
      const haystack = `${(prop.address || "").toLowerCase()} ${(prop.area || "").toLowerCase()} ${(prop.region || "").toLowerCase()}`;
      if (cpAddr) {
        const tokens = cpAddr.split(/[\s,]+/).filter((t) => t.length >= 3);
        const matches = tokens.filter((t) => haystack.includes(t)).length;
        if (matches >= 2) locPts = 10;
        else if (matches === 1) locPts = 5;
      }

      let total = gpsPts + landlordPts + propNamePts + typePts + locPts;

      // Tenant boost
      let boosted = false;
      if (total > 0 && filerName) {
        const { data: tenantRows } = await supabase
          .from("tenancies")
          .select("tenant_user_id, profiles!tenancies_tenant_user_id_fkey(full_name)")
          .eq("landlord_user_id", prop.landlord_user_id);
        // Fallback if FK alias differs:
        let tenantNames: string[] = [];
        if (tenantRows && tenantRows.length > 0) {
          const tIds = tenantRows.map((r: any) => r.tenant_user_id).filter(Boolean);
          if (tIds.length > 0) {
            const { data: tProfiles } = await supabase.from("profiles").select("full_name").in("user_id", tIds);
            tenantNames = (tProfiles || []).map((p: any) => (p.full_name || "").toLowerCase());
          }
        }
        if (tenantNames.some((n) => n && (n === filerName || trigramSim(n, filerName) >= 0.8))) {
          total = Math.min(100, total * 1.15);
          boosted = true;
        }
      }

      const level = levelFor(total);
      if (!level) continue;

      upserts.push({
        source_type: "complaint_property",
        source_id: sourceId,
        matched_property_id: prop.id,
        score: Math.round(total * 100) / 100,
        similarity_level: level,
        gps_points: gpsPts,
        landlord_name_points: landlordPts,
        property_name_points: propNamePts,
        property_type_points: typePts,
        location_points: locPts,
        tenant_boost_applied: boosted,
        last_calculated_at: new Date().toISOString(),
      });
    }

    if (upserts.length > 0) {
      const { error: upErr } = await supabase
        .from("property_similarity_scores")
        .upsert(upserts, { onConflict: "source_id,matched_property_id" });
      if (upErr) throw upErr;
    }

    return ok({ matches: upserts.length, processed: (props || []).length });
  } catch (e: any) {
    await supabase.from("similarity_check_errors").insert({
      source_id: sourceId,
      error_message: e?.message || String(e),
    });
    return ok({ error: e?.message || "internal error" }, 500);
  }
});

// Simple character-trigram Jaccard similarity (fallback when DB function unavailable)
function trigramSim(a: string, b: string): number {
  const trigrams = (s: string): Set<string> => {
    const padded = `  ${s}  `;
    const set = new Set<string>();
    for (let i = 0; i < padded.length - 2; i++) set.add(padded.slice(i, i + 3));
    return set;
  };
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FORMAT = /^[A-Z]{2}-\d{2,4}-\d{3,4}$/;

interface ResolvedLocation {
  lat: number;
  lng: number;
  region?: string;
  district?: string;
  area?: string;
  formatted?: string;
  cached?: boolean;
}

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

async function lookupSperse(code: string): Promise<ResolvedLocation | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 5000);
  try {
    const body = new URLSearchParams({ address: code });
    const res = await fetch("https://ghanapostgps.sperse.com/get.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body,
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null) as any;
    const found = json?.data?.Table?.[0];
    if (!found) return null;
    const lat = Number(found.CenterLatitude ?? found.GPSLatitude);
    const lng = Number(found.CenterLongitude ?? found.GPSLongitude);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return {
      lat,
      lng,
      region: found.Region ?? undefined,
      district: found.District ?? undefined,
      area: found.Area ?? found.Name ?? undefined,
      formatted: found.PostCode ?? code,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code: raw } = await req.json().catch(() => ({}));
    if (!raw || typeof raw !== "string") {
      return new Response(JSON.stringify({ error: "missing_code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const code = normalizeCode(raw);
    if (!FORMAT.test(code)) {
      return new Response(JSON.stringify({ error: "invalid_format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Cache hit
    const { data: cached } = await supabase
      .from("ghana_post_gps_cache")
      .select("code, lat, lng, region, district, area, formatted")
      .eq("code", code)
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({ ...cached, lat: Number(cached.lat), lng: Number(cached.lng), cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const resolved = await lookupSperse(code);
    if (!resolved) {
      return new Response(JSON.stringify({ error: "lookup_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("ghana_post_gps_cache").upsert({ code, ...resolved });

    return new Response(JSON.stringify({ ...resolved, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "server_error", detail: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

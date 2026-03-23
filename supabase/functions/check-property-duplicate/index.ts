import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { gps_location, ghana_post_gps, normalized_address, landlord_user_id, region, area } = await req.json();

    if (!normalized_address && !gps_location && !ghana_post_gps) {
      return new Response(JSON.stringify({ match: "low", confidence: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch ALL properties including archived for anti-evasion detection
    const { data: existing } = await supabaseAdmin
      .from("properties")
      .select("id, gps_location, ghana_post_gps, normalized_address, region, area, landlord_user_id, property_status, property_fingerprint");

    if (!existing || existing.length === 0) {
      return new Response(JSON.stringify({ match: "low", confidence: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let bestMatch = { id: "", score: 0 };

    for (const prop of existing) {
      let score = 0;
      let maxScore = 0;

      // GPS proximity check (weight: 30)
      if (gps_location && prop.gps_location) {
        maxScore += 30;
        const [lat1, lng1] = gps_location.split(",").map((s: string) => parseFloat(s.trim()));
        const [lat2, lng2] = prop.gps_location.split(",").map((s: string) => parseFloat(s.trim()));
        if (!isNaN(lat1) && !isNaN(lng1) && !isNaN(lat2) && !isNaN(lng2)) {
          const dist = Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
          // ~0.0001 degrees ≈ 11m
          if (dist < 0.0002) score += 30;
          else if (dist < 0.001) score += 20;
          else if (dist < 0.005) score += 10;
        }
      }

      // GhanaPost GPS exact match (weight: 25)
      if (ghana_post_gps && prop.ghana_post_gps) {
        maxScore += 25;
        if (ghana_post_gps.toUpperCase().replace(/\s/g, "") === prop.ghana_post_gps.toUpperCase().replace(/\s/g, "")) {
          score += 25;
        }
      }

      // Normalized address similarity (weight: 25)
      if (normalized_address && prop.normalized_address) {
        maxScore += 25;
        if (normalized_address === prop.normalized_address) {
          score += 25;
        } else {
          // Simple substring match
          const shorter = normalized_address.length < prop.normalized_address.length ? normalized_address : prop.normalized_address;
          const longer = normalized_address.length >= prop.normalized_address.length ? normalized_address : prop.normalized_address;
          if (longer.includes(shorter) && shorter.length > 10) score += 15;
        }
      }

      // Same region + area (weight: 10)
      if (region && area) {
        maxScore += 10;
        if (prop.region === region && prop.area === area) score += 10;
      }

      // Same landlord (weight: 10)
      if (landlord_user_id && prop.landlord_user_id) {
        maxScore += 10;
        if (prop.landlord_user_id === landlord_user_id) score += 10;
      }

      const confidence = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      if (confidence > bestMatch.score) {
        bestMatch = { id: prop.id, score: confidence };
      }
    }

    let match: "high" | "medium" | "low" = "low";
    if (bestMatch.score >= 80) match = "high";
    else if (bestMatch.score >= 50) match = "medium";

    return new Response(JSON.stringify({
      match,
      confidence: bestMatch.score,
      existingPropertyId: match !== "low" ? bestMatch.id : undefined,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

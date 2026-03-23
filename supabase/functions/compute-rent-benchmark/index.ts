import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Baseline rent data derived from dummyData.ts rentPrices
const makeRents = (base: number) => ({
  "Single Room": { min: Math.round(base * 0.6), avg: base, max: Math.round(base * 1.5) },
  "Chamber & Hall": { min: Math.round(base * 1.5), avg: Math.round(base * 2.2), max: Math.round(base * 3) },
  "1-Bedroom": { min: Math.round(base * 2.5), avg: Math.round(base * 3.5), max: Math.round(base * 5) },
  "2-Bedroom": { min: Math.round(base * 4), avg: Math.round(base * 6), max: Math.round(base * 9) },
  "3-Bedroom": { min: Math.round(base * 7), avg: Math.round(base * 10), max: Math.round(base * 15) },
  "Self-Contained": { min: Math.round(base * 2), avg: Math.round(base * 3), max: Math.round(base * 4.5) },
});

const baselineData: Record<string, Record<string, number>> = {
  "Greater Accra|East Legon": { base: 400 },
  "Greater Accra|Tema": { base: 250 },
  "Greater Accra|Madina": { base: 200 },
  "Greater Accra|Spintex": { base: 350 },
  "Greater Accra|Accra Central": { base: 300 },
  "Greater Accra|Cantonments": { base: 500 },
  "Greater Accra|Osu": { base: 350 },
  "Greater Accra|Dansoman": { base: 180 },
  "Greater Accra|Kasoa": { base: 120 },
  "Greater Accra|Adenta": { base: 200 },
  "Greater Accra|Dome": { base: 220 },
  "Greater Accra|Ashaiman": { base: 100 },
  "Ashanti|Kumasi Central": { base: 150 },
  "Ashanti|Adum": { base: 180 },
  "Ashanti|Bantama": { base: 130 },
  "Ashanti|Oforikrom": { base: 120 },
  "Ashanti|Ejisu": { base: 100 },
  "Ashanti|Nhyiaeso": { base: 160 },
  "Ashanti|Kwadaso": { base: 110 },
  "Western|Takoradi": { base: 180 },
  "Western|Sekondi": { base: 140 },
  "Western|Tarkwa": { base: 160 },
  "Western|Anaji": { base: 200 },
  "Western|Effia": { base: 150 },
  "Eastern|Koforidua": { base: 140 },
  "Eastern|Nkawkaw": { base: 100 },
  "Eastern|Suhum": { base: 90 },
  "Eastern|Nsawam": { base: 100 },
  "Eastern|Akim Oda": { base: 80 },
  "Central|Cape Coast": { base: 150 },
  "Central|Elmina": { base: 120 },
  "Central|Winneba": { base: 110 },
  "Central|Kasoa": { base: 120 },
  "Central|Swedru": { base: 90 },
  "Northern|Tamale": { base: 120 },
  "Northern|Yendi": { base: 70 },
  "Northern|Savelugu": { base: 60 },
  "Northern|Sagnarigu": { base: 100 },
  "Northern|Damongo": { base: 80 },
  "Volta|Ho": { base: 130 },
  "Volta|Hohoe": { base: 100 },
  "Volta|Keta": { base: 90 },
  "Volta|Aflao": { base: 80 },
  "Volta|Kpando": { base: 85 },
  "Upper East|Bolgatanga": { base: 100 },
  "Upper East|Navrongo": { base: 70 },
  "Upper East|Bawku": { base: 60 },
  "Upper East|Zuarungu": { base: 50 },
  "Upper West|Wa": { base: 90 },
  "Upper West|Tumu": { base: 50 },
  "Upper West|Lawra": { base: 45 },
  "Upper West|Jirapa": { base: 40 },
  "Bono|Sunyani": { base: 140 },
  "Bono|Berekum": { base: 100 },
  "Bono|Dormaa Ahenkro": { base: 90 },
  "Bono|Wenchi": { base: 80 },
  "Bono East|Techiman": { base: 120 },
  "Bono East|Kintampo": { base: 80 },
  "Bono East|Atebubu": { base: 70 },
  "Bono East|Nkoranza": { base: 75 },
  "Ahafo|Goaso": { base: 100 },
  "Ahafo|Bechem": { base: 80 },
  "Ahafo|Duayaw Nkwanta": { base: 70 },
  "Ahafo|Mim": { base: 60 },
  "Savannah|Damongo": { base: 80 },
  "Savannah|Bole": { base: 50 },
  "Savannah|Salaga": { base: 55 },
  "Savannah|Sawla": { base: 40 },
  "North East|Nalerigu": { base: 60 },
  "North East|Gambaga": { base: 50 },
  "North East|Walewale": { base: 55 },
  "Oti|Dambai": { base: 80 },
  "Oti|Nkwanta": { base: 70 },
  "Oti|Kadjebi": { base: 65 },
  "Oti|Jasikan": { base: 60 },
  "Western North|Sefwi Wiawso": { base: 90 },
  "Western North|Bibiani": { base: 100 },
  "Western North|Juaboso": { base: 70 },
  "Western North|Enchi": { base: 65 },
};

// Regional fallback bases
const regionFallback: Record<string, number> = {
  "Greater Accra": 250,
  "Ashanti": 130,
  "Western": 160,
  "Eastern": 100,
  "Central": 110,
  "Northern": 80,
  "Volta": 90,
  "Upper East": 70,
  "Upper West": 55,
  "Bono": 100,
  "Bono East": 85,
  "Ahafo": 75,
  "Savannah": 55,
  "North East": 55,
  "Oti": 70,
  "Western North": 80,
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

    const { property_id, unit_id, zone_key, property_class, asking_rent } = await req.json();

    if (!zone_key || !property_class) {
      return new Response(JSON.stringify({ error: "zone_key and property_class are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to find baseline data
    const baseline = baselineData[zone_key];
    let confidence: "high" | "medium" | "low" = "low";
    let comparableCount = 0;
    let benchmarkMin = 0, benchmarkExpected = 0, benchmarkMax = 0;

    if (baseline) {
      const rents = makeRents(baseline.base);
      const classData = rents[property_class as keyof typeof rents];
      if (classData) {
        benchmarkMin = classData.min;
        benchmarkExpected = classData.avg;
        benchmarkMax = classData.max;
        confidence = "medium";
        comparableCount = 5; // synthetic
      }
    }

    // If no exact zone match, try region fallback
    if (benchmarkMax === 0) {
      const region = zone_key.split("|")[0];
      const fallbackBase = regionFallback[region];
      if (fallbackBase) {
        const rents = makeRents(fallbackBase);
        const classData = rents[property_class as keyof typeof rents];
        if (classData) {
          benchmarkMin = classData.min;
          benchmarkExpected = classData.avg;
          benchmarkMax = classData.max;
          confidence = "low";
          comparableCount = 1;
        }
      }
    }

    // Check actual market data for better confidence
    const { data: marketData } = await supabaseAdmin
      .from("rent_market_data")
      .select("accepted_rent, asking_rent, approved_rent")
      .eq("zone_key", zone_key)
      .eq("property_class", property_class)
      .order("event_date", { ascending: false })
      .limit(20);

    if (marketData && marketData.length >= 3) {
      const rents = marketData
        .map(d => d.accepted_rent || d.approved_rent || d.asking_rent)
        .filter(Boolean)
        .sort((a, b) => (a as number) - (b as number)) as number[];

      if (rents.length >= 3) {
        benchmarkMin = rents[0];
        benchmarkMax = rents[rents.length - 1];
        benchmarkExpected = rents[Math.floor(rents.length / 2)]; // median
        comparableCount = rents.length;
        confidence = rents.length >= 10 ? "high" : "medium";
      }
    }

    const softCap = Math.round(benchmarkMax * 1.25);
    const hardCap = Math.round(benchmarkMax * 1.50);

    // Determine pricing band
    let pricingBand = "unknown";
    let pricingLabel = "";
    if (asking_rent && benchmarkMax > 0) {
      if (asking_rent <= benchmarkMax) {
        pricingBand = "within";
        pricingLabel = "Within Benchmark";
      } else if (asking_rent <= softCap) {
        pricingBand = "above";
        pricingLabel = "Above Benchmark";
      } else if (asking_rent <= hardCap) {
        pricingBand = "pending_justification";
        pricingLabel = "Pending Justification";
      } else {
        pricingBand = "rejected";
        pricingLabel = "Rejected — Excessive Pricing";
      }
    }

    // Store benchmark
    if (property_id) {
      // Upsert: delete old then insert new
      if (unit_id) {
        await supabaseAdmin.from("rent_benchmarks").delete()
          .eq("property_id", property_id)
          .eq("unit_id", unit_id);
      }

      await supabaseAdmin.from("rent_benchmarks").insert({
        property_id,
        unit_id: unit_id || null,
        zone_key,
        property_class,
        benchmark_min: benchmarkMin,
        benchmark_expected: benchmarkExpected,
        benchmark_max: benchmarkMax,
        soft_cap: softCap,
        hard_cap: hardCap,
        confidence,
        comparable_count: comparableCount,
        computed_at: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({
      benchmark_min: benchmarkMin,
      benchmark_expected: benchmarkExpected,
      benchmark_max: benchmarkMax,
      soft_cap: softCap,
      hard_cap: hardCap,
      confidence,
      comparable_count: comparableCount,
      pricing_band: pricingBand,
      pricing_label: pricingLabel,
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

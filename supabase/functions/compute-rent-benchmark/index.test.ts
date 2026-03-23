import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/compute-rent-benchmark`;

Deno.test("returns benchmark for known zone and property class", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      zone_key: "Greater Accra|East Legon",
      property_class: "2-Bedroom",
      asking_rent: 2000,
    }),
  });
  const data = await res.json();
  assert(data.benchmark_min > 0, "benchmark_min should be > 0");
  assert(data.benchmark_expected > 0, "benchmark_expected should be > 0");
  assert(data.benchmark_max > 0, "benchmark_max should be > 0");
  assertEquals(data.soft_cap, Math.round(data.benchmark_max * 1.25));
  assertEquals(data.hard_cap, Math.round(data.benchmark_max * 1.5));
  assert(["high", "medium", "low"].includes(data.confidence));
});

Deno.test("falls back to region average for unknown area", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      zone_key: "Greater Accra|NonExistentArea",
      property_class: "Single Room",
      asking_rent: 200,
    }),
  });
  const data = await res.json();
  assert(data.benchmark_max > 0, "should fall back to regional data");
  assertEquals(data.confidence, "low");
});

Deno.test("returns correct pricing band for within benchmark", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      zone_key: "Greater Accra|East Legon",
      property_class: "Single Room",
      asking_rent: 100,
    }),
  });
  const data = await res.json();
  assertEquals(data.pricing_band, "within");
  assertEquals(data.pricing_label, "Within Benchmark");
});

Deno.test("returns rejected for excessive pricing", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      zone_key: "Greater Accra|East Legon",
      property_class: "Single Room",
      asking_rent: 99999,
    }),
  });
  const data = await res.json();
  assertEquals(data.pricing_band, "rejected");
});

Deno.test("returns 400 when zone_key missing", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ property_class: "Single Room" }),
  });
  assertEquals(res.status, 400);
  await res.text();
});

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/check-property-duplicate`;

Deno.test("returns low match when no fields provided", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  assertEquals(data.match, "low");
  assertEquals(data.confidence, 0);
});

Deno.test("returns valid response with GPS location", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      gps_location: "5.6037,-0.1870",
      normalized_address: "test address accra",
      region: "Greater Accra",
      area: "Osu",
    }),
  });
  const data = await res.json();
  assert(["low", "medium", "high"].includes(data.match));
  assert(typeof data.confidence === "number");
});

Deno.test("handles OPTIONS request (CORS)", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  assertEquals(res.status, 200);
  await res.text();
});

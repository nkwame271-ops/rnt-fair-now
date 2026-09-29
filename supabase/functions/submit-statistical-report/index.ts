import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const n = z.coerce.number().int().min(0).max(10_000_000);
const money = z.coerce.number().min(0).max(1_000_000_000_000);
const stations = z.array(z.string().trim().max(120)).max(50).default([]);

const Body = z.object({
  action: z.literal("submit"),
  website: z.string().max(0).optional(), // honeypot
  office_id: z.string().min(1).max(80),
  reporting_period: z.string().min(1).max(20),
  reporting_year: z.coerce.number().int().min(2000).max(2100),
  submitter_name: z.string().trim().min(2).max(120),
  submitter_position: z.string().trim().min(2).max(120),
  pin: z.string().max(12).optional().default(""),
  confirm_revision: z.boolean().optional().default(false),
  cases: z.object({
    total_cases: n, digital: n, manual: n,
    tenant_male: n, tenant_female: n, landlord_male: n, landlord_female: n,
    settled: n, struck_off: n, withdrawn: n, referred_court: n, pending: n,
    arrears: n, absconded: n, other_matters: n, ag_landlords: n, ag_tenants: n,
    sittings_to_settle: z.coerce.number().min(0).max(1000),
  }),
  recovery: z.object({ recovered_landlords: money, recovered_tenants: money }),
  registration: z.object({
    inspections: n, agreements_registered: n, rent_cards_issued: n,
    landlords_registered: n, tenants_registered: n, radio_engagements: n, tv_engagements: n,
  }),
  radio_stations: stations,
  tv_stations: stations,
});

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s + "rpt-salt"));
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const raw = await req.json().catch(() => ({}));

    if (raw?.action === "bootstrap") {
      const [{ data: offices }, { data: cfg }] = await Promise.all([
        admin.from("offices").select("id,name,region").order("region").order("name"),
        admin.from("reporting_config").select("periods,open_years,submissions_open,require_pin").eq("id", 1).single(),
      ]);
      return json({ offices: offices ?? [], config: cfg });
    }

    const parsed = Body.safeParse(raw);
    if (!parsed.success) return json({ error: "Some fields are missing or invalid.", details: parsed.error.flatten().fieldErrors }, 400);
    const p = parsed.data;
    if (p.website) return json({ error: "Rejected" }, 400);

    const c = p.cases;
    const errs: string[] = [];
    if (c.digital + c.manual !== c.total_cases) errs.push("Digital + Manual must equal Total Cases");
    if (c.tenant_male + c.tenant_female + c.landlord_male + c.landlord_female !== c.total_cases) errs.push("Tenant and landlord cases must equal Total Cases");
    if (c.settled + c.struck_off + c.withdrawn + c.referred_court + c.pending !== c.total_cases) errs.push("Case outcomes must equal Total Cases");
    if (c.ag_landlords + c.ag_tenants !== c.referred_court) errs.push("AG referrals must equal Referred to Court");
    if (errs.length) return json({ error: errs.join(". ") }, 400);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { data, error } = await admin.rpc("submit_statistical_report", { p, p_ip_hash: await sha(ip) });
    if (error) return json({ error: error.message }, 400);
    return json(data);
  } catch (e) {
    console.error("submit-statistical-report", e);
    return json({ error: "Unexpected error. Please try again." }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.startsWith("233")) return d;
  if (d.startsWith("0")) return "233" + d.slice(1);
  if (d.length === 9) return "233" + d;
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is a landlord
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "landlord")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Only landlords can search tenants" }), { status: 403, headers: corsHeaders });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Query must be at least 3 characters" }), { status: 400, headers: corsHeaders });
    }

    const q = query.trim();
    const cleaned = q.replace(/\D/g, "");

    // Strategy: search tenant_id exact-ish first, then by phone, then by name
    let tenantRow: { user_id: string; tenant_id: string } | null = null;

    const { data: byCode } = await admin
      .from("tenants")
      .select("user_id, tenant_id")
      .ilike("tenant_id", `%${q}%`)
      .limit(1)
      .maybeSingle();
    tenantRow = byCode ?? null;

    if (!tenantRow && cleaned.length >= 9) {
      const phoneNorm = normalizePhone(cleaned);
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id")
        .or(`phone.eq.${phoneNorm},phone.eq.${cleaned}`)
        .limit(1)
        .maybeSingle();
      if (prof) {
        const { data: t } = await admin
          .from("tenants")
          .select("user_id, tenant_id")
          .eq("user_id", prof.user_id)
          .maybeSingle();
        tenantRow = t ?? null;
      }
    }

    if (!tenantRow) {
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id, full_name")
        .ilike("full_name", `%${q}%`)
        .limit(1)
        .maybeSingle();
      if (prof) {
        const { data: t } = await admin
          .from("tenants")
          .select("user_id, tenant_id")
          .eq("user_id", prof.user_id)
          .maybeSingle();
        tenantRow = t ?? null;
      }
    }

    if (!tenantRow) {
      return new Response(JSON.stringify({ found: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", tenantRow.user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        found: true,
        tenant: {
          userId: tenantRow.user_id,
          tenantIdCode: tenantRow.tenant_id,
          name: profile?.full_name ?? "Unknown",
          phone: profile?.phone ?? null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), { status: 500, headers: corsHeaders });
  }
});

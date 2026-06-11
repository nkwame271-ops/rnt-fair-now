import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(d: unknown, status = 200) {
  return new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateKey(env: "sandbox" | "production"): string {
  const prefix = env === "sandbox" ? "rcg_test_" : "rcg_live_";
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return prefix + body;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claims } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const { data: isAdmin } = await admin.rpc("is_main_admin", { _user_id: userId });
    if (!isAdmin) return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json();
    const action = body.action as string;

    switch (action) {
      case "issue": {
        const {
          agency_name,
          scopes,
          environment = "production",
          rate_limit_per_minute = 60,
          allowed_ip_cidrs = null,
          expires_at = null,
          agency_contact_email = null,
          agency_contact_phone = null,
          notes = null,
        } = body;
        if (!agency_name || !Array.isArray(scopes) || scopes.length === 0) {
          return json({ error: "agency_name and scopes[] are required" }, 400);
        }
        const plaintext = generateKey(environment === "sandbox" ? "sandbox" : "production");
        const hash = await sha256(plaintext);
        const prefix = plaintext.slice(0, 16);

        const { data: row, error } = await admin.from("api_keys").insert({
          agency_name,
          api_key_hash: hash,
          key_prefix: prefix,
          scopes,
          environment,
          rate_limit_per_minute,
          allowed_ip_cidrs,
          expires_at,
          agency_contact_email,
          agency_contact_phone,
          notes,
          is_active: true,
          created_by: userId,
        }).select("*").single();
        if (error) return json({ error: error.message }, 400);

        await admin.from("admin_audit_log").insert({
          actor_user_id: userId,
          action: "agency_api.issue_key",
          entity_type: "api_key",
          entity_id: row.id,
          metadata: { agency_name, environment, scopes },
        }).then(() => {}, () => {});

        return json({ ok: true, key_id: row.id, api_key: plaintext, key_prefix: prefix, record: row });
      }

      case "revoke": {
        const { key_id, reason } = body;
        if (!key_id) return json({ error: "key_id required" }, 400);
        const { error } = await admin.from("api_keys").update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoked_by: userId,
          revoke_reason: reason || null,
        }).eq("id", key_id);
        if (error) return json({ error: error.message }, 400);
        await admin.from("admin_audit_log").insert({
          actor_user_id: userId, action: "agency_api.revoke_key",
          entity_type: "api_key", entity_id: key_id, metadata: { reason },
        }).then(() => {}, () => {});
        return json({ ok: true });
      }

      case "rotate": {
        const { key_id } = body;
        if (!key_id) return json({ error: "key_id required" }, 400);
        const { data: existing } = await admin.from("api_keys").select("environment").eq("id", key_id).maybeSingle();
        if (!existing) return json({ error: "key not found" }, 404);
        const plaintext = generateKey(existing.environment === "sandbox" ? "sandbox" : "production");
        const hash = await sha256(plaintext);
        const prefix = plaintext.slice(0, 16);
        const { error } = await admin.from("api_keys").update({
          api_key_hash: hash, key_prefix: prefix, last_used_at: null, last_used_ip: null,
        }).eq("id", key_id);
        if (error) return json({ error: error.message }, 400);
        await admin.from("admin_audit_log").insert({
          actor_user_id: userId, action: "agency_api.rotate_key",
          entity_type: "api_key", entity_id: key_id,
        }).then(() => {}, () => {});
        return json({ ok: true, api_key: plaintext, key_prefix: prefix });
      }

      case "update": {
        const { key_id, patch } = body;
        if (!key_id || !patch) return json({ error: "key_id and patch required" }, 400);
        const allowed = [
          "scopes", "rate_limit_per_minute", "allowed_ip_cidrs", "expires_at",
          "agency_contact_email", "agency_contact_phone", "notes", "is_active",
          "dsa_signed_at", "agency_name",
        ];
        const clean: Record<string, unknown> = {};
        for (const k of allowed) if (k in patch) clean[k] = patch[k];
        const { error } = await admin.from("api_keys").update(clean).eq("id", key_id);
        if (error) return json({ error: error.message }, 400);
        await admin.from("admin_audit_log").insert({
          actor_user_id: userId, action: "agency_api.update_key",
          entity_type: "api_key", entity_id: key_id, metadata: clean,
        }).then(() => {}, () => {});
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("agency-api-admin error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

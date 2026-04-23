import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ARKESEL_V1_URL = "https://sms.arkesel.com/sms/api";
const SEND_CHUNK_SIZE = 25;
const MAX_RECIPIENTS = 1500;
const MAX_USER_IDS = 200;

function respond(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.replace(/\s|-/g, "").replace(/^\+/, "");
  if (p.startsWith("0")) p = "233" + p.slice(1);
  if (!p.startsWith("233")) p = "233" + p;
  // Ghana mobile: 233 + 9 digits
  if (!/^233\d{9}$/.test(p)) return null;
  return p;
}

async function sendOne(
  apiKey: string,
  phone: string,
  message: string,
  schedule: string | undefined,
): Promise<{ ok: boolean; reason?: string }> {
  const params: Record<string, string> = {
    action: "send-sms",
    api_key: apiKey,
    to: phone,
    from: "RentControl",
    sms: message,
  };
  if (schedule) params.schedule = schedule;

  try {
    const res = await fetch(`${ARKESEL_V1_URL}?${new URLSearchParams(params)}`);
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}: ${text.slice(0, 120)}` };
    // Arkesel returns JSON like {"code":"ok",...} or text — treat non-"ok" code as failure
    try {
      const json = JSON.parse(text);
      const code = String(json?.code ?? "").toLowerCase();
      if (code && code !== "ok") {
        return { ok: false, reason: json?.message || `Arkesel code: ${code}` };
      }
    } catch {
      // non-JSON response — assume success since HTTP was 2xx
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "network error" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
    if (!ARKESEL_API_KEY) {
      return respond({ ok: false, error: "SMS provider is not configured (ARKESEL_API_KEY missing)." });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond({ ok: false, error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) {
      return respond({ ok: false, error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub as string;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "regulator")
      .maybeSingle();
    if (!roleData) return respond({ ok: false, error: "Forbidden" }, 403);

    const body = await req.json();
    const { action } = body;

    // ============ CHECK BALANCE ============
    if (action === "check-balance") {
      const params = new URLSearchParams({
        action: "check-balance",
        api_key: ARKESEL_API_KEY,
        response: "json",
      });
      const res = await fetch(`${ARKESEL_V1_URL}?${params}`);
      const text = await res.text();
      let balance: number | null = null;
      try {
        const parsed = JSON.parse(text);
        balance = parsed.balance ?? parsed.data?.balance ?? null;
      } catch {
        const match = text.match(/[\d.]+/);
        if (match) balance = parseFloat(match[0]);
      }
      return respond({ ok: true, balance });
    }

    // ============ SEARCH USERS ============
    if (action === "search-users") {
      const q = String(body.q ?? "").trim();
      const limit = Math.min(Math.max(Number(body.limit ?? 25), 1), 50);
      if (q.length < 2) return respond({ ok: true, users: [] });

      const isUuid = /^[0-9a-f-]{36}$/i.test(q);
      let query = adminClient
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .limit(limit);

      if (isUuid) {
        query = query.eq("user_id", q);
      } else {
        const safe = q.replace(/[%,]/g, "");
        query = query.or(
          `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,email.ilike.%${safe}%`,
        );
      }

      const { data: profiles, error: profErr } = await query;
      if (profErr) return respond({ ok: false, error: profErr.message });

      const ids = (profiles || []).map((p: any) => p.user_id);
      let roleMap: Record<string, string> = {};
      if (ids.length) {
        const { data: roles } = await adminClient
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", ids);
        for (const r of (roles || [])) roleMap[r.user_id] = r.role;
      }

      const users = (profiles || [])
        .filter((p: any) => p.phone && p.phone.trim())
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name || "",
          phone: p.phone,
          email: p.email || "",
          role: roleMap[p.user_id] || null,
        }));

      return respond({ ok: true, users });
    }

    // ============ SEND BROADCAST ============
    if (action === "send-broadcast") {
      const { message, recipientFilter, schedule, userIds } = body;
      if (!message || typeof message !== "string" || !message.trim()) {
        return respond({ ok: false, error: "Message is required" });
      }

      let query = adminClient.from("profiles").select("phone, user_id");
      let targetingMode = recipientFilter || "all";

      if (Array.isArray(userIds) && userIds.length > 0) {
        if (userIds.length > MAX_USER_IDS) {
          return respond({ ok: false, error: `Cannot target more than ${MAX_USER_IDS} users in one broadcast.` });
        }
        query = query.in("user_id", userIds);
        targetingMode = `selected:${userIds.length}`;
      } else if (recipientFilter === "tenants" || recipientFilter === "landlords") {
        const roleName = recipientFilter === "tenants" ? "tenant" : "landlord";
        const { data: roleUsers, error: roleErr } = await adminClient
          .from("user_roles")
          .select("user_id")
          .eq("role", roleName);
        if (roleErr) return respond({ ok: false, error: "Failed to fetch role users: " + roleErr.message });
        const ids = (roleUsers || []).map((r: any) => r.user_id);
        if (!ids.length) return respond({ ok: true, sent: 0, failed: 0, total: 0, failures: [] });
        query = query.in("user_id", ids);
      }

      const { data: profiles, error: profilesErr } = await query;
      if (profilesErr) return respond({ ok: false, error: "Failed to fetch recipients: " + profilesErr.message });

      type Recipient = { phone: string; raw: string };
      const recipients: Recipient[] = [];
      const seen = new Set<string>();
      for (const p of (profiles || [])) {
        const raw = (p as any).phone;
        if (!raw) continue;
        const norm = normalizePhone(raw);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        recipients.push({ phone: norm, raw });
      }

      if (recipients.length > MAX_RECIPIENTS) {
        return respond({
          ok: false,
          error: `Too many recipients (${recipients.length}). Max ${MAX_RECIPIENTS} per broadcast — narrow the audience or use Specific Users.`,
        });
      }

      if (recipients.length === 0) {
        return respond({ ok: true, sent: 0, failed: 0, total: 0, failures: [], message: "No valid phone numbers found" });
      }

      let sent = 0;
      let failed = 0;
      const failures: Array<{ phone: string; reason: string }> = [];

      for (let i = 0; i < recipients.length; i += SEND_CHUNK_SIZE) {
        const chunk = recipients.slice(i, i + SEND_CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((r) => sendOne(ARKESEL_API_KEY, r.phone, message.trim(), schedule)),
        );
        results.forEach((res, idx) => {
          const phone = chunk[idx].phone;
          if (res.status === "fulfilled" && res.value.ok) {
            sent++;
          } else {
            failed++;
            const reason = res.status === "fulfilled"
              ? (res.value.reason || "unknown")
              : (res.reason?.message || "rejected");
            if (failures.length < 10) failures.push({ phone, reason });
          }
        });
      }

      // Audit log — non-blocking
      try {
        await adminClient.from("admin_audit_log").insert({
          admin_user_id: userId,
          action: "sms_broadcast",
          target_type: "sms",
          target_id: targetingMode,
          reason: `Broadcast to ${recipients.length} recipients (${sent} sent, ${failed} failed)${schedule ? ` scheduled: ${schedule}` : ""}`,
          new_state: {
            message: message.substring(0, 200),
            targeting: targetingMode,
            schedule,
            sample_failures: failures,
          },
        });
      } catch (e) {
        console.error("Audit log insert failed:", e);
      }

      return respond({
        ok: true,
        sent,
        failed,
        total: recipients.length,
        failures,
      });
    }

    return respond({ ok: false, error: "Invalid action" }, 400);
  } catch (error: unknown) {
    console.error("SMS Broadcast error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return respond({ ok: false, error: msg });
  }
});

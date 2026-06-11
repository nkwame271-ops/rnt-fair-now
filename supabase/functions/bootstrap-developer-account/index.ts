// Atomic developer account bootstrap. Creates auth user (auto-confirmed),
// assigns the 'developer' role, creates the developer_organizations row and
// owner membership — all with the service role so client-side RLS gaps cannot
// leave the account half-provisioned.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Body {
  full_name: string;
  email: string;
  password: string;
  org_name: string;
  contact_phone?: string | null;
  agency_type?: string | null;
  intended_use_case: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Body;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Invalid JSON" }); }

  const required = ["full_name", "email", "password", "org_name", "intended_use_case"] as const;
  for (const k of required) {
    if (!body[k] || String(body[k]).trim().length < 2) {
      return json({ ok: false, error: `${k} is required` });
    }
  }
  if (body.password.length < 8) return json({ ok: false, error: "password must be 8+ characters" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Create auth user (auto-confirmed so they can log in immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: body.email.trim().toLowerCase(),
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name.trim(), intended_role: "developer" },
  });

  if (createErr || !created?.user) {
    const msg = (createErr?.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return json({ ok: false, error: "An account with this email already exists. Please log in." });
    }
    return json({ ok: false, error: createErr?.message || "Failed to create account" });
  }

  const userId = created.user.id;
  const rollback = async (reason: string) => {
    try { await admin.auth.admin.deleteUser(userId); } catch (e) { console.error("rollback failed", e); }
    return json({ ok: false, error: reason });
  };

  // 2. Assign developer role
  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "developer" });
  if (roleErr && !String(roleErr.message).toLowerCase().includes("duplicate")) {
    return rollback("Could not assign developer role: " + roleErr.message);
  }

  // 3. Create organization
  const { data: org, error: orgErr } = await admin
    .from("developer_organizations")
    .insert({
      name: body.org_name.trim(),
      contact_email: body.email.trim().toLowerCase(),
      contact_phone: body.contact_phone?.trim() || null,
      agency_type: body.agency_type?.trim() || null,
      intended_use_case: body.intended_use_case.trim(),
      owner_user_id: userId,
    })
    .select("id")
    .single();
  if (orgErr || !org) return rollback("Could not create organization: " + (orgErr?.message ?? "unknown"));

  // 4. Owner membership
  const { error: memErr } = await admin
    .from("developer_org_members")
    .insert({ org_id: org.id, user_id: userId, member_role: "owner" });
  if (memErr) return rollback("Could not create owner membership: " + memErr.message);

  // 5. Notify developer (welcome) + every admin staff member. Best-effort.
  const notify = (payload: Record<string, unknown>) =>
    admin.functions.invoke("send-notification", { body: payload }).catch((e) => {
      console.error("send-notification failed:", e);
    });

  await notify({
    event: "developer_account_created",
    email: body.email.trim().toLowerCase(),
    user_id: userId,
    data: {
      name: body.full_name,
      org_name: body.org_name,
      tier: "Sandbox (auto-issued) · Live (admin approval required)",
    },
  });

  try {
    const { data: admins } = await admin
      .from("admin_staff")
      .select("user_id, profiles:profiles!inner(email)");
    for (const a of (admins ?? []) as Array<{ user_id: string; profiles: { email: string | null } | null }>) {
      const email = a.profiles?.email;
      await notify({
        event: "developer_account_created_admin",
        email,
        user_id: a.user_id,
        data: {
          org_name: body.org_name,
          contact_email: body.email,
          agency_type: body.agency_type || "—",
          use_case: body.intended_use_case.slice(0, 240),
        },
      });
    }
  } catch (e) {
    console.error("admin notify loop failed", e);
  }

  return json({ ok: true, user_id: userId, org_id: org.id });
});

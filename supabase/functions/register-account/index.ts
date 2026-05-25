// Atomic account registration. Wraps auth.signUp + profile update + tenant/landlord insert
// in a single server-side operation. On any failure after auth user creation, the auth user
// is deleted so the caller never ends up with an orphan profile/role with no tenant/landlord row.
//
// This replaces the 3-step client-side flow that produced the Margaret Oppong / Imam Shamsuoleen Umar bug.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface RegisterBody {
  role: "tenant" | "landlord";
  full_name: string;
  phone: string;
  password: string;
  email?: string | null;

  // shared optional
  is_citizen?: boolean;
  nationality?: string | null;
  residence_permit_no?: string | null;

  // tenant-only
  delivery_region?: string | null;
  occupation?: string | null;
  work_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  is_student?: boolean;
  school?: string | null;
  hostel_or_hall?: string | null;
  room_or_bed_space?: string | null;
  hostel_region?: string | null;
  hostel_contact_number?: string | null;

  // controls whether to pre-mark fee paid (legacy regFeeEnabled = false branch)
  reg_fee_enabled?: boolean;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: RegisterBody;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: "Invalid JSON body" }, 400);
  }

  // Basic validation
  if (!body || (body.role !== "tenant" && body.role !== "landlord")) {
    return jsonResp({ error: "role must be 'tenant' or 'landlord'" }, 400);
  }
  if (!body.full_name?.trim() || !body.phone?.trim() || !body.password) {
    return jsonResp({ error: "full_name, phone, and password are required" }, 400);
  }
  if (body.password.length < 6) {
    return jsonResp({ error: "password must be at least 6 characters" }, 400);
  }

  const phoneDigits = normalizePhone(body.phone);
  if (phoneDigits.length < 9) {
    return jsonResp({ error: "phone number looks invalid" }, 400);
  }
  const syntheticEmail = `${phoneDigits}@rentcontrolghana.local`;

  // 1. Pre-check: existing profile with this phone
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("user_id")
    .eq("phone", phoneDigits)
    .maybeSingle();

  if (existingProfile) {
    const checkTable = body.role === "tenant" ? "tenants" : "landlords";
    const { data: roleRecord } = await admin
      .from(checkTable)
      .select("account_status")
      .eq("user_id", existingProfile.user_id)
      .maybeSingle();
    if (roleRecord?.account_status === "deactivated") {
      return jsonResp({ error: "This phone number is linked to a deactivated account. Please contact Rent Control for assistance.", code: "DEACTIVATED" }, 409);
    }
    return jsonResp({ error: "This phone number is already registered. Please log in or recover your account.", code: "ALREADY_REGISTERED" }, 409);
  }

  // 2. Pre-check: email uniqueness (if email provided)
  if (body.email && body.email.trim()) {
    const { data: emailMatch } = await admin
      .from("profiles")
      .select("id")
      .eq("email", body.email.trim())
      .maybeSingle();
    if (emailMatch) {
      return jsonResp({ error: "This email is already in use by another account.", code: "EMAIL_TAKEN" }, 409);
    }
  }

  // 3. Create auth user (service role bypass — confirms immediately)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: syntheticEmail,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name.trim(), phone: phoneDigits, role: body.role },
  });

  if (createErr || !created?.user) {
    const msg = createErr?.message || "Failed to create auth user";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
      return jsonResp({ error: "This phone number is already registered.", code: "ALREADY_REGISTERED" }, 409);
    }
    return jsonResp({ error: msg }, 500);
  }

  const userId = created.user.id;

  // Helper: roll back the auth user if any downstream step fails
  const rollback = async (reason: string) => {
    try { await admin.auth.admin.deleteUser(userId); } catch (e) { console.error("rollback delete user failed", e); }
    return jsonResp({ error: reason, code: "ROLLED_BACK" }, 500);
  };

  // 4. Update profile (handle_new_user trigger created the base row + user_roles entry from metadata)
  const profilePatch: Record<string, unknown> = {
    email: body.email || null,
    is_citizen: body.is_citizen ?? true,
    nationality: body.is_citizen === false ? body.nationality : "Ghanaian",
    residence_permit_no: body.is_citizen === false ? body.residence_permit_no : null,
  };
  if (body.role === "tenant") {
    profilePatch.delivery_region = body.delivery_region || null;
    profilePatch.occupation = body.occupation || null;
    profilePatch.work_address = body.work_address || null;
    profilePatch.emergency_contact_name = body.emergency_contact_name || null;
    profilePatch.emergency_contact_phone = body.emergency_contact_phone ? normalizePhone(body.emergency_contact_phone) : null;
    profilePatch.user_type = body.is_student ? "student" : "tenant";
  }

  const { error: profileErr } = await admin.from("profiles").update(profilePatch).eq("user_id", userId);
  if (profileErr) {
    return rollback("Failed to update profile: " + profileErr.message);
  }

  // 5. Generate domain ID via sequence (collision-proof) and insert tenant/landlord row
  const idFn = body.role === "tenant" ? "generate_tenant_id" : "generate_landlord_id";
  const { data: genId, error: genErr } = await admin.rpc(idFn);
  if (genErr || !genId) {
    return rollback("Failed to generate account ID: " + (genErr?.message ?? "unknown"));
  }
  const domainId = String(genId);

  const now = new Date();
  const expiry = new Date(now);
  expiry.setFullYear(expiry.getFullYear() + 1);
  const regFeeEnabled = body.reg_fee_enabled !== false; // default true

  if (body.role === "tenant") {
    const tenantInsert: Record<string, unknown> = {
      user_id: userId,
      tenant_id: domainId,
      registration_fee_paid: !regFeeEnabled,
      is_student: !!body.is_student,
      school: body.is_student ? (body.school || null) : null,
      hostel_or_hall: body.is_student ? (body.hostel_or_hall || null) : null,
      room_or_bed_space: body.is_student ? (body.room_or_bed_space || null) : null,
    };
    if (!regFeeEnabled) {
      tenantInsert.registration_date = now.toISOString();
      tenantInsert.expiry_date = expiry.toISOString();
    }
    const { error: tErr } = await admin.from("tenants").insert(tenantInsert);
    if (tErr) return rollback("Failed to create tenant record: " + tErr.message);
  } else {
    const landlordInsert: Record<string, unknown> = {
      user_id: userId,
      landlord_id: domainId,
      registration_fee_paid: !regFeeEnabled,
    };
    if (!regFeeEnabled) {
      landlordInsert.registration_date = now.toISOString();
      landlordInsert.expiry_date = expiry.toISOString();
    }
    const { error: lErr } = await admin.from("landlords").insert(landlordInsert);
    if (lErr) return rollback("Failed to create landlord record: " + lErr.message);
  }

  return jsonResp({
    ok: true,
    user_id: userId,
    domain_id: domainId,
    synthetic_email: syntheticEmail,
    role: body.role,
  });
});

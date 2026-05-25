// Shared helper: resolve a phone number from an identifier (phone, tenant ID, or landlord ID).
// Used by lookup-phone, verify-otp, and reset-password-otp so the raw phone never has
// to be returned to the client.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("233")) return digits;
  if (digits.startsWith("0")) return "233" + digits.slice(1);
  return "233" + digits;
}

export async function resolvePhoneFromIdentifier(
  admin: SupabaseClient,
  identifier: string
): Promise<string | null> {
  const trimmed = (identifier || "").trim();
  if (trimmed.length < 3) return null;

  const phoneDigits = trimmed.replace(/\s/g, "");

  // Direct phone lookup
  if (/^0\d{9}$/.test(phoneDigits) || /^233\d{9}$/.test(phoneDigits.replace(/\D/g, ""))) {
    const norm = normalizePhone(phoneDigits);
    for (const candidate of Array.from(new Set([phoneDigits, norm, "0" + norm.slice(3)]))) {
      const { data } = await admin.from("profiles").select("phone").eq("phone", candidate).maybeSingle();
      if (data?.phone) return data.phone;
    }
  }

  // Tenant ID
  if (/^(TEN-|TN-)/i.test(trimmed)) {
    const { data: tenant } = await admin.from("tenants").select("user_id").ilike("tenant_id", trimmed).maybeSingle();
    if (tenant?.user_id) {
      const { data: profile } = await admin.from("profiles").select("phone").eq("user_id", tenant.user_id).maybeSingle();
      if (profile?.phone) return profile.phone;
    }
  }

  // Landlord ID
  if (/^(LLD-|LL-)/i.test(trimmed)) {
    const { data: landlord } = await admin.from("landlords").select("user_id").ilike("landlord_id", trimmed).maybeSingle();
    if (landlord?.user_id) {
      const { data: profile } = await admin.from("profiles").select("phone").eq("user_id", landlord.user_id).maybeSingle();
      if (profile?.phone) return profile.phone;
    }
  }

  return null;
}

export function maskPhone(phone: string): string {
  const d = phone.replace(/\s/g, "");
  return d.length >= 6 ? d.slice(0, 3) + "****" + d.slice(-3) : "***masked***";
}

export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

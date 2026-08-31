import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Idempotent test-account seeder.
 *
 * Two bugs made the demo accounts unusable:
 *  1. Passwords were 6 characters, below the project's 8-character minimum, so the
 *     accounts were created with a password nobody could sign in with (or not at all).
 *  2. createUser() fails once the account exists, so re-running the seeder never
 *     repaired the password. We now fall back to updateUserById.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const results: string[] = [];

    const findUserByEmail = async (email: string): Promise<string | null> => {
      for (let page = 1; page <= 20; page++) {
        const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        const users = data?.users || [];
        const hit = users.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
        if (hit) return hit.id;
        if (users.length < 200) break;
      }
      return null;
    };

    /** Create the auth user, or reset the password + confirm the email when it already exists. */
    const upsertUser = async (
      label: string,
      email: string,
      password: string,
      user_metadata: Record<string, unknown>,
    ): Promise<{ id: string | null; created: boolean }> => {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata,
      });
      if (!error && data?.user) {
        results.push(`${label} created: ${data.user.id}`);
        return { id: data.user.id, created: true };
      }

      const existingId = await findUserByEmail(email);
      if (!existingId) {
        results.push(`${label}: ${error?.message || "could not create or locate account"}`);
        return { id: null, created: false };
      }
      const { error: updErr } = await supabase.auth.admin.updateUserById(existingId, {
        password,
        email_confirm: true,
        user_metadata,
      });
      results.push(
        updErr
          ? `${label} password reset failed: ${updErr.message}`
          : `${label} existed — password reset and email confirmed: ${existingId}`,
      );
      return { id: existingId, created: false };
    };

    // 1. Regulator
    await upsertUser("Regulator", "admin@rentcontrol.gov.gh", "Admin123!", {
      full_name: "RCD Administrator",
      phone: "0200000000",
      role: "regulator",
    });

    // 2. Tenant (phone login → synthetic email)
    const tenant = await upsertUser("Tenant", "0240001234@rentcontrolghana.local", "Demo001234", {
      full_name: "Kwame Asante",
      phone: "0240001234",
      role: "tenant",
    });
    if (tenant.id) {
      const { error: tInsErr } = await supabase.from("tenants").upsert({
        user_id: tenant.id,
        tenant_id: "TNT-DEMO-001",
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
      }, { onConflict: "user_id" });
      if (tInsErr) results.push(`Tenant record: ${tInsErr.message}`);
    }

    // 3. Landlord (phone login → synthetic email)
    const landlord = await upsertUser("Landlord", "0240005678@rentcontrolghana.local", "Demo005678", {
      full_name: "Ama Mensah",
      phone: "0240005678",
      role: "landlord",
    });
    if (landlord.id) {
      // The legacy demo profile predates its auth identity. Re-key all domain
      // records to the actual auth id, then ensure role and profile are present.
      const { data: legacyLandlord } = await supabase
        .from("landlords")
        .select("id")
        .eq("landlord_id", "LLD-DEMO-001")
        .maybeSingle();
      if (legacyLandlord?.id) {
        const { error: relinkError } = await supabase
          .from("landlords")
          .update({
            user_id: landlord.id,
            registration_fee_paid: true,
            registration_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: "active",
            compliance_score: 100,
          })
          .eq("id", legacyLandlord.id);
        if (relinkError) results.push(`Landlord relink: ${relinkError.message}`);
      }
      const { data: duplicateProfiles } = await supabase
        .from("profiles")
        .select("user_id")
        .or("phone.eq.0240005678,email.eq.0240005678@rentcontrolghana.local")
        .neq("user_id", landlord.id);
      for (const duplicate of duplicateProfiles || []) {
        // Release unique profile identifiers before attempting auth cleanup so
        // the real login account can always receive the demo phone and email.
        await supabase.from("profiles").update({
          phone: `archived-${duplicate.user_id}`,
          email: `archived-${duplicate.user_id}@rentcontrolghana.local`,
        }).eq("user_id", duplicate.user_id);
        const { data: duplicateAuth } = await supabase.auth.admin.getUserById(duplicate.user_id);
        if (duplicateAuth?.user) {
          const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(duplicate.user_id);
          // Legacy domain rows can prevent auth deletion; keeping that archived
          // identity is safe because it no longer owns the login identifiers.
          if (deleteAuthError) results.push("Stale landlord identity archived");
        } else {
          await supabase.from("user_roles").delete().eq("user_id", duplicate.user_id).eq("role", "landlord");
          await supabase.from("profiles").delete().eq("user_id", duplicate.user_id);
        }
      }
      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: landlord.id,
        email: "0240005678@rentcontrolghana.local",
        phone: "0240005678",
        full_name: "Ama Mensah",
        user_type: "landlord",
      }, { onConflict: "user_id" });
      if (profileError) results.push(`Landlord profile: ${profileError.message}`);
      const { error: roleError } = await supabase.from("user_roles").upsert({ user_id: landlord.id, role: "landlord" }, { onConflict: "user_id,role" });
      if (roleError) results.push(`Landlord role: ${roleError.message}`);
      if (!legacyLandlord?.id) {
        const { error: lInsErr } = await supabase.from("landlords").insert({
          user_id: landlord.id,
          landlord_id: "LLD-DEMO-001",
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          status: "active",
          compliance_score: 100,
        });
        if (lInsErr) results.push(`Landlord record: ${lInsErr.message}`);
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

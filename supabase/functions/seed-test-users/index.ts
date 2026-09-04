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

    // 3. Landlord demo account (phone login → synthetic email).
    //
    // History: the original demo landlord (created via email signup, phone
    // 0240005678 in its metadata) owns ALL the demo properties, tenancies and
    // payments. An earlier version of this seeder created a *second* synthetic
    // account for the same phone and archived the original profile — so phone
    // login landed on an empty account with no properties, while the Engine
    // Room still showed the original as active.
    //
    // Correct behaviour: keep whichever account actually owns the data, give it
    // the phone-login email + password, and remove the empty duplicate.
    const DEMO_PHONE = "0240005678";
    const DEMO_EMAIL = `${DEMO_PHONE}@rentcontrolghana.local`;
    const DEMO_PASSWORD = "Demo005678";

    const candidateIds = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
      const users = data?.users || [];
      for (const u of users as any[]) {
        const metaPhone = String(u.user_metadata?.phone || "").replace(/\D/g, "");
        const emailMatch = (u.email || "").toLowerCase() === DEMO_EMAIL;
        if (emailMatch || metaPhone.endsWith(DEMO_PHONE.slice(1))) candidateIds.add(u.id);
      }
      if (users.length < 200) break;
    }
    const { data: phoneProfiles } = await supabase
      .from("profiles")
      .select("user_id")
      .or(`phone.eq.${DEMO_PHONE},email.eq.${DEMO_EMAIL}`);
    for (const p of phoneProfiles || []) candidateIds.add(p.user_id);

    /** Owned-data weight decides which identity is the real demo landlord. */
    const dataWeight = async (id: string) => {
      const [props, tens, esc] = await Promise.all([
        supabase.from("properties").select("id", { count: "exact", head: true }).eq("landlord_user_id", id),
        supabase.from("tenancies").select("id", { count: "exact", head: true }).eq("landlord_user_id", id),
        supabase.from("escrow_transactions").select("id", { count: "exact", head: true }).eq("user_id", id),
      ]);
      return (props.count || 0) * 100 + (tens.count || 0) * 10 + (esc.count || 0);
    };

    const scored: { id: string; weight: number }[] = [];
    for (const id of candidateIds) scored.push({ id, weight: await dataWeight(id) });
    scored.sort((a, b) => b.weight - a.weight);

    let landlordId: string | null = scored[0]?.id ?? null;
    if (landlordId) {
      results.push(`Landlord demo identity kept: ${landlordId} (data weight ${scored[0].weight})`);
    } else {
      const created = await upsertUser("Landlord", DEMO_EMAIL, DEMO_PASSWORD, {
        full_name: "Ama Mensah",
        phone: DEMO_PHONE,
        role: "landlord",
      });
      landlordId = created.id;
    }

    if (landlordId) {
      const keeper = landlordId;

      // Empty duplicates must release the phone/email before the keeper takes them.
      for (const other of scored.slice(1)) {
        if (other.weight > 0) {
          results.push(`Left ${other.id} untouched — it owns real records`);
          continue;
        }
        await supabase.from("profiles").delete().eq("user_id", other.id);
        await supabase.from("landlords").delete().eq("user_id", other.id);
        await supabase.from("user_roles").delete().eq("user_id", other.id);
        const { error: delErr } = await supabase.auth.admin.deleteUser(other.id);
        results.push(delErr ? `Duplicate ${other.id} kept (${delErr.message})` : `Duplicate ${other.id} removed`);
      }

      const { error: authErr } = await supabase.auth.admin.updateUserById(keeper, {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { full_name: "Ama Mensah", phone: DEMO_PHONE, role: "landlord" },
      });
      if (authErr) results.push(`Landlord auth repair: ${authErr.message}`);

      const { error: profileError } = await supabase.from("profiles").upsert({
        user_id: keeper,
        email: DEMO_EMAIL,
        phone: DEMO_PHONE,
        full_name: "Ama Mensah",
        user_type: "landlord",
      }, { onConflict: "user_id" });
      if (profileError) results.push(`Landlord profile: ${profileError.message}`);

      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: keeper, role: "landlord" }, { onConflict: "user_id,role" });
      if (roleError) results.push(`Landlord role: ${roleError.message}`);

      const landlordRecord = {
        user_id: keeper,
        landlord_id: "LLD-DEMO-001",
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        status: "active",
        account_status: "active",
        compliance_score: 100,
      };
      const { data: demoLandlord } = await supabase
        .from("landlords")
        .select("id")
        .eq("landlord_id", "LLD-DEMO-001")
        .maybeSingle();
      const { error: lErr } = demoLandlord?.id
        ? await supabase.from("landlords").update(landlordRecord).eq("id", demoLandlord.id)
        : await supabase.from("landlords").insert(landlordRecord);
      if (lErr) results.push(`Landlord record: ${lErr.message}`);
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

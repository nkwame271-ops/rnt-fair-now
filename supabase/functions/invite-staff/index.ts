import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: any) =>
  new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function emailExists(adminClient: any, email: string): Promise<boolean> {
  const lower = email.toLowerCase();
  // Page through users (Supabase admin listUsers default ~50/page)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    if (users.some((u: any) => (u.email || "").toLowerCase() === lower)) return true;
    if (users.length < 200) return false;
  }
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" });

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: "Unauthorized" });
    const callerId = userData.user.id;

    const { data: callerRole } = await adminClient
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "regulator").maybeSingle();
    if (!callerRole) return json({ error: "Access denied. Regulator role required." });

    const { data: callerAdmin } = await adminClient
      .from("admin_staff").select("admin_type").eq("user_id", callerId).maybeSingle();
    if (!callerAdmin || (callerAdmin.admin_type !== "main_admin" && callerAdmin.admin_type !== "super_admin")) {
      return json({ error: "Only Main Admins can invite staff." });
    }

    const body = await req.json().catch(() => ({}));
    const { email, fullName, phone, password, adminType, officeId, officeName, assignedSchool, allowedFeatures, nugsPermissions, salesChannelId, channelPermissions } = body || {};
    const isNugs = adminType === "nugs_admin";

    if (isNugs && callerAdmin.admin_type !== "super_admin") {
      return json({ error: "Only Super Admins can create NUGS sub-admins." });
    }
    if (!email || !fullName || !password) return json({ error: "email, fullName, and password are required" });
    if (password.length < 6) return json({ error: "Password must be at least 6 characters" });

    const resolvedAdminType = adminType || "sub_admin";
    if (resolvedAdminType === "sub_admin" && !officeId) return json({ error: "Sub Admins must be assigned to an office" });
    if (isNugs && (!assignedSchool || !assignedSchool.trim())) return json({ error: "NUGS Sub-Admins must be assigned to a school" });

    // Email pre-check (paginated)
    try {
      if (await emailExists(adminClient, email)) {
        return json({ error: `Email "${email}" is already registered. Use a different email.` });
      }
    } catch (e: any) {
      console.error("emailExists check failed:", e?.message || e);
      // continue — createUser will catch duplicates with its own error
    }

    // Cleanup orphaned profile (prevents unique constraint violation)
    try {
      const { data: orphanProfile } = await adminClient
        .from("profiles").select("user_id").eq("email", email.toLowerCase()).maybeSingle();
      if (orphanProfile) {
        await adminClient.from("profiles").delete().eq("user_id", orphanProfile.user_id);
      }
    } catch (e) {
      console.error("Orphan profile cleanup error:", e);
    }

    const userRole = isNugs ? "nugs_admin" : "regulator";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, phone: phone || "", role: userRole },
    });
    if (createError || !newUser?.user) {
      return json({ error: createError?.message || "Failed to create user" });
    }
    const newUserId = newUser.user.id;

    if (!isNugs) {
      const { error: staffError } = await adminClient
        .from("admin_staff").insert({
          user_id: newUserId,
          admin_type: resolvedAdminType,
          office_id: resolvedAdminType === "main_admin" ? null : (officeId || null),
          office_name: resolvedAdminType === "main_admin" ? null : (officeName || null),
          allowed_features: allowedFeatures || [],
          muted_features: [],
          phone: phone || null,
          sales_channel_id: salesChannelId || null,
          channel_permissions: channelPermissions || {},
          created_by: callerId,
        });

      if (staffError) {
        // Roll back the auth user to avoid half-created accounts
        await adminClient.auth.admin.deleteUser(newUserId).catch((e) => console.error("rollback failed", e));
        return json({ error: `Failed to create staff record: ${staffError.message}` });
      }
    } else {
      const { error: nugsError } = await adminClient
        .from("nugs_staff").insert({
          user_id: newUserId,
          assigned_school: assignedSchool.trim(),
          created_by: callerId,
          permissions: {
            complaints: nugsPermissions?.complaints !== false,
            rent_card: nugsPermissions?.rent_card === true,
          },
          allowed_features: allowedFeatures || [],
          muted_features: [],
        });

      if (nugsError) {
        await adminClient.auth.admin.deleteUser(newUserId).catch((e) => console.error("rollback failed", e));
        return json({ error: `School assignment failed: ${nugsError.message}` });
      }
    }

    const labelMap: Record<string, string> = {
      main_admin: "Main Admin", sub_admin: "Sub Admin", nugs_admin: "NUGS Sub-Admin",
    };

    return json({
      success: true,
      message: `${labelMap[resolvedAdminType] || resolvedAdminType} account created for ${email}`,
      userId: newUserId,
      adminType: resolvedAdminType,
    });
  } catch (error: any) {
    console.error("Invite staff unhandled error:", error?.message || error);
    return json({ error: error?.message || "Unexpected error" });
  }
});

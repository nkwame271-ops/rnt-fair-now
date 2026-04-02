import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Extract caller ID from JWT
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    // Verify caller has regulator role
    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "regulator")
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Access denied. Regulator role required." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is main_admin
    const { data: callerAdmin } = await adminClient
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", callerId)
      .maybeSingle();

    if (!callerAdmin || callerAdmin.admin_type !== "main_admin") {
      return new Response(JSON.stringify({ error: "Only Main Admins can invite staff." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, fullName, password, adminType, officeId, officeName, allowedFeatures } = await req.json();
    if (!email || !fullName || !password) {
      return new Response(JSON.stringify({ error: "email, fullName, and password are required" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Password must be at least 6 characters" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedAdminType = adminType || "sub_admin";

    // Sub admins must have an office
    if (resolvedAdminType === "sub_admin" && !officeId) {
      return new Response(JSON.stringify({ error: "Sub Admins must be assigned to an office" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if email is already registered
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    if (existingUsers?.users?.some((u: any) => u.email?.toLowerCase() === email.toLowerCase())) {
      return new Response(JSON.stringify({ error: `Email "${email}" is already registered. Use a different email.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with admin API (auto-confirmed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: "",
        role: "regulator",
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin_staff record
    const { error: staffError } = await adminClient
      .from("admin_staff")
      .insert({
        user_id: newUser.user.id,
        admin_type: resolvedAdminType,
        office_id: resolvedAdminType === "main_admin" ? null : (officeId || null),
        office_name: resolvedAdminType === "main_admin" ? null : (officeName || null),
        allowed_features: allowedFeatures || [],
        muted_features: [],
        created_by: callerId,
      });

    if (staffError) {
      console.error("Failed to create admin_staff record:", staffError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${resolvedAdminType === "main_admin" ? "Main Admin" : "Sub Admin"} account created for ${email}`,
      userId: newUser.user.id,
      adminType: resolvedAdminType,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Invite staff error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

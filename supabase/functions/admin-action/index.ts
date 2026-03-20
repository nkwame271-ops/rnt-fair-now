import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller is authenticated
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is main_admin
    const { data: adminStaff } = await adminClient
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", user.id)
      .single();

    if (!adminStaff || adminStaff.admin_type !== "main_admin") {
      throw new Error("Only Main Admin can perform this action");
    }

    const body = await req.json();
    const { action, target_id, reason, password, extra } = body;

    if (!action || !target_id || !reason || !password) {
      throw new Error("Missing required fields: action, target_id, reason, password");
    }

    // Re-authenticate admin via password using a separate client to avoid mutating adminClient session
    const verifyClient = createClient(supabaseUrl, anonKey);
    const { error: reAuthError } = await verifyClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });
    if (reAuthError) throw new Error("Password verification failed");

    let oldState: any = {};
    let newState: any = {};
    let targetType = "";

    switch (action) {
      case "revoke_batch": {
        targetType = "serial_stock";
        // target_id is batch_label
        const { data: serials } = await adminClient
          .from("rent_card_serial_stock")
          .select("id, serial_number, status, assigned_to_card_id")
          .eq("batch_label", target_id)
          .in("status", ["available"]);

        if (!serials || serials.length === 0) {
          throw new Error("No available (unused) serials found in this batch");
        }

        oldState = { batch_label: target_id, count: serials.length, status: "available" };

        const ids = serials.map((s: any) => s.id);
        const { error: updateErr } = await adminClient
          .from("rent_card_serial_stock")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            revoke_reason: reason,
          })
          .in("id", ids);

        if (updateErr) throw updateErr;
        newState = { status: "revoked", revoked_count: ids.length };
        break;
      }

      case "unassign_serial": {
        targetType = "serial_stock";
        // target_id is serial_number
        const { data: serial } = await adminClient
          .from("rent_card_serial_stock")
          .select("id, status, assigned_to_card_id, serial_number")
          .eq("serial_number", target_id)
          .single();

        if (!serial) throw new Error("Serial not found");
        if (serial.status !== "assigned") throw new Error("Serial is not in 'assigned' status");

        // Check if the linked card has an active tenancy
        if (serial.assigned_to_card_id) {
          const { data: card } = await adminClient
            .from("rent_cards")
            .select("id, status, tenancy_id")
            .eq("id", serial.assigned_to_card_id)
            .single();

          if (card?.tenancy_id) {
            const { data: tenancy } = await adminClient
              .from("tenancies")
              .select("status")
              .eq("id", card.tenancy_id)
              .single();

            if (tenancy && !["terminated", "expired"].includes(tenancy.status)) {
              throw new Error("Cannot unassign: serial is linked to an active tenancy. Use correction workflow instead.");
            }
          }

          // Reset the rent card
          await adminClient
            .from("rent_cards")
            .update({ serial_number: null, status: "awaiting_serial" })
            .eq("id", serial.assigned_to_card_id);
        }

        oldState = { serial_number: serial.serial_number, status: serial.status };

        await adminClient
          .from("rent_card_serial_stock")
          .update({
            status: "available",
            assigned_to_card_id: null,
            assigned_at: null,
            assigned_by: null,
          })
          .eq("id", serial.id);

        newState = { status: "available" };
        break;
      }

      case "void_upload": {
        targetType = "serial_stock";
        // target_id is batch_label
        const { data: serials } = await adminClient
          .from("rent_card_serial_stock")
          .select("id, status")
          .eq("batch_label", target_id)
          .in("status", ["available"]);

        if (!serials || serials.length === 0) {
          throw new Error("No unused serials found in this batch to void");
        }

        oldState = { batch_label: target_id, count: serials.length };

        const ids = serials.map((s: any) => s.id);
        await adminClient
          .from("rent_card_serial_stock")
          .update({
            status: "revoked",
            revoked_at: new Date().toISOString(),
            revoked_by: user.id,
            revoke_reason: `Voided upload: ${reason}`,
          })
          .in("id", ids);

        newState = { status: "revoked", voided_count: ids.length };
        break;
      }

      case "deactivate_account":
      case "archive_account": {
        // extra.account_type = 'landlord' | 'tenant'
        const accountType = extra?.account_type;
        if (!accountType || !["landlord", "tenant"].includes(accountType)) {
          throw new Error("Must specify account_type: landlord or tenant");
        }
        targetType = accountType;
        const table = accountType === "landlord" ? "landlords" : "tenants";
        const newStatus = action === "deactivate_account" ? "deactivated" : "archived";

        const { data: account } = await adminClient
          .from(table)
          .select("*")
          .eq("user_id", target_id)
          .single();

        if (!account) throw new Error(`${accountType} account not found`);
        oldState = { account_status: (account as any).account_status || "active" };

        // Check for active tenancies before hard actions
        if (action === "archive_account") {
          const tenancyField = accountType === "landlord" ? "landlord_user_id" : "tenant_user_id";
          const { data: activeTenancies } = await adminClient
            .from("tenancies")
            .select("id")
            .eq(tenancyField, target_id)
            .in("status", ["pending", "active"]);

          if (activeTenancies && activeTenancies.length > 0) {
            throw new Error(`Cannot archive: ${activeTenancies.length} active tenancies exist`);
          }
        }

        await adminClient
          .from(table)
          .update({ account_status: newStatus } as any)
          .eq("user_id", target_id);

        newState = { account_status: newStatus };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Write audit log
    await adminClient.from("admin_audit_log").insert({
      admin_user_id: user.id,
      action,
      target_type: targetType,
      target_id,
      reason,
      old_state: oldState,
      new_state: newState,
    });

    return new Response(JSON.stringify({ success: true, old_state: oldState, new_state: newState }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

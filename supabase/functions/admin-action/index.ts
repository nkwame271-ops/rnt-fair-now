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

    // Re-authenticate admin via password
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
      case "generate_serials": {
        targetType = "serial_stock";
        const { prefix, start_range, end_range, pad_length, office_name, region, batch_label, paired_mode } = extra || {};

        if (!prefix || !start_range || !end_range || !office_name) {
          throw new Error("Missing serial generation parameters");
        }

        const quantity = end_range - start_range + 1;
        if (quantity <= 0 || quantity > 10000) {
          throw new Error("Quantity must be between 1 and 10,000");
        }

        const padLen = pad_length || 4;
        const serials: string[] = [];
        for (let i = start_range; i <= end_range; i++) {
          serials.push(prefix + String(i).padStart(padLen, "0"));
        }

        const existingSet = new Set<string>();
        for (let i = 0; i < serials.length; i += 100) {
          const batch = serials.slice(i, i + 100);
          const { data } = await adminClient
            .from("rent_card_serial_stock")
            .select("serial_number")
            .in("serial_number", batch)
            .limit(batch.length);
          if (data) data.forEach((r: any) => existingSet.add(r.serial_number));
        }

        const newSerials = serials.filter(s => !existingSet.has(s));
        if (newSerials.length === 0) {
          throw new Error("All generated serial numbers already exist in stock");
        }

        const pairGroup = paired_mode ? `PG-${Date.now()}` : null;

        for (let i = 0; i < newSerials.length; i += 500) {
          const batch = newSerials.slice(i, i + 500);
          const rows: any[] = [];
          for (const s of batch) {
            if (paired_mode) {
              rows.push({
                serial_number: s, office_name, status: "available",
                batch_label: batch_label || target_id, region: region || null,
                pair_index: 1, pair_group: pairGroup, stock_type: "regional",
              });
              rows.push({
                serial_number: s, office_name, status: "available",
                batch_label: batch_label || target_id, region: region || null,
                pair_index: 2, pair_group: pairGroup, stock_type: "regional",
              });
            } else {
              rows.push({
                serial_number: s, office_name, status: "available",
                batch_label: batch_label || target_id, region: region || null,
                stock_type: "regional",
              });
            }
          }
          const { error: insertErr } = await adminClient
            .from("rent_card_serial_stock")
            .insert(rows);
          if (insertErr) throw insertErr;
        }

        const physicalCards = paired_mode ? newSerials.length * 2 : newSerials.length;
        oldState = { action: "generate_serials" };
        newState = {
          generated_count: newSerials.length,
          physical_cards: physicalCards,
          paired_mode: !!paired_mode,
          skipped_duplicates: serials.length - newSerials.length,
          prefix, range: `${start_range}-${end_range}`,
          office_name, region: region || null,
          batch_label: batch_label || target_id,
        };
        break;
      }

      case "generate_serials_multi": {
        targetType = "serial_stock";
        const { prefix: mPrefix, pad_length: mPadLen, regions: mRegions, batch_label: mBatchLabel, paired_mode: mPairedMode } = extra || {};

        if (!mPrefix || !mRegions || !Array.isArray(mRegions) || mRegions.length === 0) {
          throw new Error("Missing multi-region generation parameters");
        }

        // Fetch region codes
        const { data: regionCodesData } = await adminClient
          .from("region_codes")
          .select("region, code");
        const codeMap = new Map<string, string>();
        (regionCodesData || []).forEach((rc: any) => codeMap.set(rc.region, rc.code));

        const padLen = mPadLen || 4;
        const pairGroup = mPairedMode ? `PG-${Date.now()}` : null;
        const batchLabel = mBatchLabel || target_id;
        let totalGenerated = 0;
        const regionDetails: any[] = [];

        for (const regionEntry of mRegions) {
          const { region: rName, code: rCode, start_range: rStart, end_range: rEnd } = regionEntry;
          const regionCode = codeMap.get(rName) || rCode || rName.substring(0, 3).toUpperCase();
          const qty = rEnd - rStart + 1;
          if (qty <= 0 || qty > 10000) continue;

          const serials: string[] = [];
          for (let i = rStart; i <= rEnd; i++) {
            serials.push(mPrefix + regionCode + "-" + String(i).padStart(padLen, "0"));
          }

          // Check duplicates
          const existingSet = new Set<string>();
          for (let i = 0; i < serials.length; i += 100) {
            const batch = serials.slice(i, i + 100);
            const { data } = await adminClient
              .from("rent_card_serial_stock")
              .select("serial_number")
              .in("serial_number", batch)
              .limit(batch.length);
            if (data) data.forEach((r: any) => existingSet.add(r.serial_number));
          }

          const newSerials = serials.filter(s => !existingSet.has(s));
          if (newSerials.length === 0) {
            regionDetails.push({ region: rName, code: regionCode, generated: 0, skipped: serials.length });
            continue;
          }

          // Insert in batches
          for (let i = 0; i < newSerials.length; i += 500) {
            const batch = newSerials.slice(i, i + 500);
            const rows: any[] = [];
            for (const s of batch) {
              if (mPairedMode) {
                rows.push({
                  serial_number: s, office_name: rName, status: "available",
                  batch_label: batchLabel, region: rName,
                  pair_index: 1, pair_group: pairGroup, stock_type: "regional",
                });
                rows.push({
                  serial_number: s, office_name: rName, status: "available",
                  batch_label: batchLabel, region: rName,
                  pair_index: 2, pair_group: pairGroup, stock_type: "regional",
                });
              } else {
                rows.push({
                  serial_number: s, office_name: rName, status: "available",
                  batch_label: batchLabel, region: rName, stock_type: "regional",
                });
              }
            }
            const { error: insertErr } = await adminClient
              .from("rent_card_serial_stock")
              .insert(rows);
            if (insertErr) throw insertErr;
          }

          totalGenerated += newSerials.length;
          regionDetails.push({
            region: rName, code: regionCode,
            generated: newSerials.length, skipped: serials.length - newSerials.length,
            start: rStart, end: rEnd,
          });
        }

        if (totalGenerated === 0) {
          throw new Error("All serial numbers already exist across all selected regions");
        }

        // Create generation_batches record
        const totalPhysical = mPairedMode ? totalGenerated * 2 : totalGenerated;
        await adminClient.from("generation_batches").insert({
          batch_label: batchLabel,
          prefix: mPrefix,
          regions: mRegions.map((r: any) => r.region),
          region_details: regionDetails,
          total_unique_serials: totalGenerated,
          total_physical_cards: totalPhysical,
          paired_mode: !!mPairedMode,
          generated_by: user.id,
        });

        oldState = { action: "generate_serials_multi" };
        newState = {
          total_unique: totalGenerated,
          total_physical: totalPhysical,
          paired_mode: !!mPairedMode,
          regions: regionDetails,
          batch_label: batchLabel,
        };
        break;
      }

      case "allocate_to_office": {
        targetType = "office_allocation";
        const { region: aRegion, office_id: aOfficeId, office_name: aOfficeName, quantity: aQuantity, allocation_mode: aMode, quota_limit: aQuota } = extra || {};

        if (!aRegion || !aOfficeId || !aOfficeName || !aQuantity) {
          throw new Error("Missing allocation parameters");
        }

        if (aMode === "quota") {
          // Just record the quota allocation
          await adminClient.from("office_allocations").insert({
            region: aRegion,
            office_id: aOfficeId,
            office_name: aOfficeName,
            quantity: aQuantity,
            allocation_mode: "quota",
            quota_limit: aQuota || aQuantity,
            allocated_by: user.id,
          });

          oldState = { action: "allocate_quota" };
          newState = { office: aOfficeName, quota: aQuota || aQuantity };
        } else {
          // Transfer mode: find N available regional serials and move to office
          // Get unique serials (pair_index = 1 or null) from regional stock
          const { data: availableSerials } = await adminClient
            .from("rent_card_serial_stock")
            .select("id, serial_number, pair_index")
            .eq("region", aRegion)
            .eq("stock_type", "regional")
            .eq("status", "available")
            .order("serial_number", { ascending: true })
            .limit(aQuantity * 2 + 100); // Get extra to cover both pair indices

          if (!availableSerials || availableSerials.length === 0) {
            throw new Error("No available regional stock for this region");
          }

          // Group by serial number to find pairs
          const serialMap = new Map<string, any[]>();
          (availableSerials as any[]).forEach((s: any) => {
            if (!serialMap.has(s.serial_number)) serialMap.set(s.serial_number, []);
            serialMap.get(s.serial_number)!.push(s);
          });

          // Take first N unique serials
          const serialsToTransfer: string[] = [];
          const idsToUpdate: string[] = [];
          let count = 0;
          for (const [sn, rows] of serialMap) {
            if (count >= aQuantity) break;
            serialsToTransfer.push(sn);
            rows.forEach((r: any) => idsToUpdate.push(r.id));
            count++;
          }

          if (serialsToTransfer.length === 0) {
            throw new Error("Not enough available regional stock");
          }

          // Create allocation record
          const { data: allocRecord } = await adminClient.from("office_allocations").insert({
            region: aRegion,
            office_id: aOfficeId,
            office_name: aOfficeName,
            quantity: serialsToTransfer.length,
            allocation_mode: "transfer",
            start_serial: serialsToTransfer[0],
            end_serial: serialsToTransfer[serialsToTransfer.length - 1],
            serial_numbers: serialsToTransfer,
            allocated_by: user.id,
          }).select("id").single();

          // Update serials in batches
          for (let i = 0; i < idsToUpdate.length; i += 500) {
            const batch = idsToUpdate.slice(i, i + 500);
            await adminClient
              .from("rent_card_serial_stock")
              .update({
                stock_type: "office",
                office_name: aOfficeName,
                office_allocation_id: (allocRecord as any)?.id || null,
              })
              .in("id", batch);
          }

          oldState = { action: "allocate_transfer" };
          newState = {
            office: aOfficeName,
            transferred: serialsToTransfer.length,
            first_serial: serialsToTransfer[0],
            last_serial: serialsToTransfer[serialsToTransfer.length - 1],
          };
        }
        break;
      }

      case "revoke_batch": {
        targetType = "serial_stock";
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
        const { data: serial } = await adminClient
          .from("rent_card_serial_stock")
          .select("id, status, assigned_to_card_id, serial_number")
          .eq("serial_number", target_id)
          .single();

        if (!serial) throw new Error("Serial not found");
        if (serial.status !== "assigned") throw new Error("Serial is not in 'assigned' status");

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
              throw new Error("Cannot unassign: serial is linked to an active tenancy.");
            }
          }

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

      case "delete_account": {
        const delAccountType = extra?.account_type;
        if (!delAccountType || !["landlord", "tenant", "admin"].includes(delAccountType)) {
          throw new Error("Must specify account_type: landlord, tenant, or admin");
        }
        targetType = delAccountType;

        if (delAccountType === "admin") {
          // Delete admin staff account
          const { data: staffRecord } = await adminClient
            .from("admin_staff")
            .select("id, admin_type, user_id")
            .eq("user_id", target_id)
            .single();

          if (!staffRecord) throw new Error("Admin account not found");
          if ((staffRecord as any).user_id === user.id) throw new Error("Cannot delete your own admin account");

          oldState = { admin_type: (staffRecord as any).admin_type };

          // Remove from admin_staff
          await adminClient.from("admin_staff").delete().eq("user_id", target_id);
          // Remove from user_roles
          await adminClient.from("user_roles").delete().eq("user_id", target_id);
          // Delete profile
          await adminClient.from("profiles").delete().eq("user_id", target_id);
          // Ban the auth user
          await adminClient.auth.admin.deleteUser(target_id);

          newState = { status: "deleted" };
        } else {
          // Delete landlord/tenant account
          const delTable = delAccountType === "landlord" ? "landlords" : "tenants";
          const tenancyField = delAccountType === "landlord" ? "landlord_user_id" : "tenant_user_id";

          const { data: delAccount } = await adminClient
            .from(delTable)
            .select("*")
            .eq("user_id", target_id)
            .single();

          if (!delAccount) throw new Error(`${delAccountType} account not found`);

          // Check active tenancies
          const { data: activeTenancies } = await adminClient
            .from("tenancies")
            .select("id")
            .eq(tenancyField, target_id)
            .in("status", ["pending", "active"]);

          if (activeTenancies && activeTenancies.length > 0) {
            throw new Error(`Cannot delete: ${activeTenancies.length} active tenancies exist`);
          }

          oldState = { account_status: (delAccount as any).account_status || "active" };

          // Delete from role table
          await adminClient.from(delTable).delete().eq("user_id", target_id);
          // Remove from user_roles
          await adminClient.from("user_roles").delete().eq("user_id", target_id);
          // Delete profile
          await adminClient.from("profiles").delete().eq("user_id", target_id);
          // Ban the auth user
          await adminClient.auth.admin.deleteUser(target_id);

          newState = { status: "deleted" };
        }
        break;
      }

      case "delete_complaint": {
        targetType = "complaint";
        const { data: complaint } = await adminClient.from("complaints").select("id").eq("id", target_id).single();
        if (!complaint) throw new Error("Complaint not found");
        oldState = { id: target_id };
        await adminClient.from("complaints").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_landlord_complaint": {
        targetType = "landlord_complaint";
        const { data: lc } = await adminClient.from("landlord_complaints").select("id").eq("id", target_id).single();
        if (!lc) throw new Error("Landlord complaint not found");
        oldState = { id: target_id };
        await adminClient.from("landlord_complaints").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_application": {
        targetType = "application";
        const { data: app } = await adminClient.from("landlord_applications").select("id").eq("id", target_id).single();
        if (!app) throw new Error("Application not found");
        oldState = { id: target_id };
        await adminClient.from("landlord_applications").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_property": {
        targetType = "property";
        const { data: prop } = await adminClient.from("properties").select("id").eq("id", target_id).single();
        if (!prop) throw new Error("Property not found");
        oldState = { id: target_id };
        // Delete related data first
        await adminClient.from("property_images").delete().eq("property_id", target_id);
        await adminClient.from("property_assessments").delete().eq("property_id", target_id);
        await adminClient.from("property_events").delete().eq("property_id", target_id);
        await adminClient.from("property_location_edits").delete().eq("property_id", target_id);
        await adminClient.from("units").delete().eq("property_id", target_id);
        await adminClient.from("properties").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_agreement": {
        targetType = "tenancy";
        const { data: tenancy } = await adminClient.from("tenancies").select("id, status").eq("id", target_id).single();
        if (!tenancy) throw new Error("Agreement/tenancy not found");
        if ((tenancy as any).status === "active") throw new Error("Cannot delete an active tenancy");
        oldState = { id: target_id, status: (tenancy as any).status };
        await adminClient.from("tenancies").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_assessment": {
        targetType = "rent_assessment";
        const { data: ra } = await adminClient.from("rent_assessments").select("id").eq("id", target_id).single();
        if (!ra) throw new Error("Rent assessment not found");
        oldState = { id: target_id };
        await adminClient.from("rent_assessments").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_rent_review": {
        targetType = "rent_review";
        const { data: rr } = await adminClient.from("rent_increase_requests").select("id").eq("id", target_id).single();
        if (!rr) throw new Error("Rent review not found");
        oldState = { id: target_id };
        await adminClient.from("rent_increase_requests").delete().eq("id", target_id);
        newState = { status: "deleted" };
        break;
      }

      case "delete_termination": {
        targetType = "termination";
        const { data: ta } = await adminClient.from("termination_applications").select("id").eq("id", target_id).single();
        if (!ta) throw new Error("Termination application not found");
        oldState = { id: target_id };
        await adminClient.from("termination_applications").delete().eq("id", target_id);
        newState = { status: "deleted" };
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
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

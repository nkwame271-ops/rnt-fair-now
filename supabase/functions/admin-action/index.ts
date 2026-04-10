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

    // --- Handle claim_pending_tenancy early (no admin role or password required) ---
    const rawBody = await req.json();
    if (rawBody.action === "claim_pending_tenancy") {
      const claimPhone = rawBody.phone;
      const newUserId = rawBody.new_user_id;
      if (!claimPhone || !newUserId) {
        return new Response(JSON.stringify({ error: "Missing phone or new_user_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find pending tenant records matching this phone
      const { data: pendingRows, error: pendErr } = await adminClient
        .from("pending_tenants")
        .select("id, tenancy_id")
        .eq("phone", claimPhone)
        .is("claimed_by", null);

      if (pendErr || !pendingRows || pendingRows.length === 0) {
        return new Response(JSON.stringify({ success: true, claimed: 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let claimed = 0;
      for (const row of pendingRows) {
        // Link the tenancy to the new user
        if (row.tenancy_id) {
          await adminClient
            .from("tenancies")
            .update({ tenant_user_id: newUserId })
            .eq("id", row.tenancy_id);
        }

        // Mark pending_tenant as claimed
        await adminClient
          .from("pending_tenants")
          .update({ claimed_by: newUserId, claimed_at: new Date().toISOString() })
          .eq("id", row.id);

        claimed++;
      }

      // Audit log
      await adminClient.from("admin_audit_log").insert({
        admin_user_id: user.id,
        action: "claim_pending_tenancy",
        target_type: "pending_tenants",
        target_id: newUserId,
        reason: `Auto-claim on registration for phone ${claimPhone}`,
        old_state: { pending_ids: pendingRows.map((r: any) => r.id) },
        new_state: { claimed },
      });

      return new Response(JSON.stringify({ success: true, claimed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is main_admin
    const { data: adminStaff } = await adminClient
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", user.id)
      .single();

    if (!adminStaff || (adminStaff.admin_type !== "main_admin" && adminStaff.admin_type !== "super_admin")) {
      throw new Error("Only Main Admin can perform this action");
    }

    const body = rawBody;
    const { action, target_id, reason, password, extra } = body;

    if (!action || !target_id || !reason) {
      throw new Error("Missing required fields: action, target_id, reason");
    }

    // Actions that don't require password re-authentication
    const NO_PASSWORD_ACTIONS = ["create_payout_recipient"];
    const requiresPassword = !NO_PASSWORD_ACTIONS.includes(action);

    if (requiresPassword) {
      if (!password) throw new Error("Missing required field: password");
      // Re-authenticate admin via password
      const verifyClient = createClient(supabaseUrl, anonKey);
      const { error: reAuthError } = await verifyClient.auth.signInWithPassword({
        email: user.email!,
        password,
      });
      if (reAuthError) throw new Error("Password verification failed");
    }

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
        const { region: aRegion, office_id: aOfficeId, office_name: aOfficeName, quantity: aQuantity, allocation_mode: aMode, quota_limit: aQuota, start_serial: aStartSerial, end_serial: aEndSerial } = extra || {};

        if (!aRegion || !aOfficeId || !aOfficeName || !aQuantity) {
          throw new Error("Missing allocation parameters");
        }

        if (aMode === "quota" || aMode === "quantity_transfer") {
          // Quota / quantity_transfer mode: pure accounting entry — no serial transfers
          await adminClient.from("office_allocations").insert({
            region: aRegion,
            office_id: aOfficeId,
            office_name: aOfficeName,
            quantity: aQuantity,
            allocation_mode: aMode,
            quota_limit: aQuantity,
            allocated_by: user.id,
          });

          oldState = { action: aMode === "quota" ? "allocate_quota" : "allocate_quantity_transfer" };
          newState = {
            office: aOfficeName,
            quota: aQuantity,
            mode: "pool_based",
            allocation_mode: aMode,
          };
        } else if (aMode === "range_transfer") {
          // Range transfer mode: transfer serials within a specific range
          if (!aStartSerial || !aEndSerial) {
            throw new Error("Missing start_serial or end_serial for range transfer");
          }

          if (aStartSerial > aEndSerial) {
            throw new Error("Invalid serial range: end must be >= start");
          }

          const { data: availableSerials, error: fetchErr } = await adminClient
            .from("rent_card_serial_stock")
            .select("id, serial_number, pair_index")
            .eq("region", aRegion)
            .eq("stock_type", "regional")
            .eq("status", "available")
            .gte("serial_number", aStartSerial)
            .lte("serial_number", aEndSerial)
            .order("serial_number", { ascending: true })
            .limit(2000);

          if (fetchErr) throw new Error(`Failed to query serials: ${fetchErr.message}`);
          if (!availableSerials || availableSerials.length === 0) {
            throw new Error(`No available regional serials found in range ${aStartSerial}–${aEndSerial}`);
          }

          // Group by serial_number
          const serialMap = new Map<string, any[]>();
          (availableSerials as any[]).forEach((s: any) => {
            if (!serialMap.has(s.serial_number)) serialMap.set(s.serial_number, []);
            serialMap.get(s.serial_number)!.push(s);
          });

          if (serialMap.size === 0) {
            throw new Error(`No available serials found in range ${aStartSerial}–${aEndSerial}`);
          }

          const serialsToTransfer: string[] = [];
          const idsToUpdate: string[] = [];
          for (const [sn, rows] of serialMap) {
            serialsToTransfer.push(sn);
            rows.forEach((r: any) => idsToUpdate.push(r.id));
          }

          // Create allocation record
          const { data: allocRecord } = await adminClient.from("office_allocations").insert({
            region: aRegion,
            office_id: aOfficeId,
            office_name: aOfficeName,
            quantity: serialsToTransfer.length,
            allocation_mode: "range_transfer",
            start_serial: aStartSerial,
            end_serial: aEndSerial,
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

          oldState = { action: "allocate_range_transfer" };
          newState = {
            office: aOfficeName,
            transferred: serialsToTransfer.length,
            start_serial: aStartSerial,
            end_serial: aEndSerial,
            allocation_mode: "range_transfer",
          };
        } else {
          // Transfer mode: find N available regional serials and move to office
          const { data: availableSerials } = await adminClient
            .from("rent_card_serial_stock")
            .select("id, serial_number, pair_index")
            .eq("region", aRegion)
            .eq("stock_type", "regional")
            .eq("status", "available")
            .order("serial_number", { ascending: true })
            .limit(aQuantity * 2 + 100);

          if (!availableSerials || availableSerials.length === 0) {
            throw new Error("No available regional stock for this region");
          }

          const serialMap = new Map<string, any[]>();
          (availableSerials as any[]).forEach((s: any) => {
            if (!serialMap.has(s.serial_number)) serialMap.set(s.serial_number, []);
            serialMap.get(s.serial_number)!.push(s);
          });

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

          const { data: allocRecord } = await adminClient.from("office_allocations").insert({
            region: aRegion,
            office_id: aOfficeId,
            office_name: aOfficeName,
            quantity: serialsToTransfer.length,
            allocation_mode: aMode || "transfer",
            start_serial: serialsToTransfer[0],
            end_serial: serialsToTransfer[serialsToTransfer.length - 1],
            serial_numbers: serialsToTransfer,
            allocated_by: user.id,
          }).select("id").single();

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
        // Paginate to handle batches with >1000 serials
        let allRevokeIds: string[] = [];
        let rFrom = 0;
        const R_PAGE = 1000;
        while (true) {
          const { data: page } = await adminClient
            .from("rent_card_serial_stock")
            .select("id")
            .eq("batch_label", target_id)
            .eq("status", "available")
            .range(rFrom, rFrom + R_PAGE - 1);
          if (!page || page.length === 0) break;
          allRevokeIds = allRevokeIds.concat(page.map((s: any) => s.id));
          if (page.length < R_PAGE) break;
          rFrom += R_PAGE;
        }

        if (allRevokeIds.length === 0) {
          throw new Error("No available (unused) serials found in this batch");
        }

        oldState = { batch_label: target_id, count: allRevokeIds.length, status: "available" };

        for (let i = 0; i < allRevokeIds.length; i += 500) {
          const batch = allRevokeIds.slice(i, i + 500);
          const { error: updateErr } = await adminClient
            .from("rent_card_serial_stock")
            .update({
              status: "revoked",
              revoked_at: new Date().toISOString(),
              revoked_by: user.id,
              revoke_reason: reason,
            })
            .in("id", batch);
          if (updateErr) throw updateErr;
        }

        newState = { status: "revoked", revoked_count: allRevokeIds.length };
        break;
      }

      case "unassign_serial": {
        targetType = "serial_stock";

        // Use the atomic unassign function for full pair reset
        const { data: unassignResult, error: unassignError } = await adminClient
          .rpc("unassign_serial_atomic", { p_serial_number: target_id });

        if (unassignError) {
          throw new Error(unassignError.message);
        }

        const result = unassignResult as any;
        if (!result?.success) {
          throw new Error("Unassign failed unexpectedly");
        }

        oldState = { serial_number: target_id };
        newState = {
          status: "available",
          cards_reset: result.cards_reset,
          stock_rows_reset: result.stock_rows_reset,
        };
        break;
      }

      case "void_upload": {
        targetType = "serial_stock";
        // Paginate to handle batches with >1000 serials
        let allVoidIds: string[] = [];
        let vFrom = 0;
        const V_PAGE = 1000;
        while (true) {
          const { data: page } = await adminClient
            .from("rent_card_serial_stock")
            .select("id")
            .eq("batch_label", target_id)
            .eq("status", "available")
            .range(vFrom, vFrom + V_PAGE - 1);
          if (!page || page.length === 0) break;
          allVoidIds = allVoidIds.concat(page.map((s: any) => s.id));
          if (page.length < V_PAGE) break;
          vFrom += V_PAGE;
        }

        if (allVoidIds.length === 0) {
          throw new Error("No unused serials found in this batch to void");
        }

        oldState = { batch_label: target_id, count: allVoidIds.length };

        for (let i = 0; i < allVoidIds.length; i += 500) {
          const batch = allVoidIds.slice(i, i + 500);
          const { error: updateErr } = await adminClient
            .from("rent_card_serial_stock")
            .update({
              status: "revoked",
              revoked_at: new Date().toISOString(),
              revoked_by: user.id,
              revoke_reason: `Voided upload: ${reason}`,
            })
            .in("id", batch);
          if (updateErr) throw updateErr;
        }

        newState = { status: "revoked", voided_count: allVoidIds.length };
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

      case "adjust_office_quota": {
        targetType = "office_quota";
        const { office_id: qOfficeId, office_name: qOfficeName, region: qRegion, new_quota: qNewQuota } = extra || {};

        if (!qOfficeId || !qRegion || qNewQuota === undefined || qNewQuota === null) {
          throw new Error("Missing parameters: office_id, region, new_quota");
        }

        // Sum existing quota entries for this office (both quota and quantity_transfer)
        const { data: existingQuotas } = await adminClient
          .from("office_allocations")
          .select("quota_limit, allocation_mode")
          .eq("office_id", qOfficeId)
          .in("allocation_mode", ["quota", "quantity_transfer"]);

        const currentTotal = (existingQuotas || []).reduce((sum: number, a: any) => sum + (a.quota_limit || 0), 0);

        // Count used from serial_assignments
        const { data: usageData } = await adminClient
          .from("serial_assignments")
          .select("card_count")
          .eq("office_id", qOfficeId);

        const usedCount = (usageData || []).reduce((sum: number, a: any) => sum + (a.card_count || 0), 0);

        if (qNewQuota < usedCount) {
          throw new Error(`Cannot reduce quota below used count (${usedCount}). Office has already assigned ${usedCount} serials.`);
        }

        const delta = qNewQuota - currentTotal;
        if (delta === 0) {
          throw new Error("No change — new quota equals current quota");
        }

        // Insert adjustment record
        await adminClient.from("office_allocations").insert({
          region: qRegion,
          office_id: qOfficeId,
          office_name: qOfficeName || qOfficeId,
          quantity: delta,
          allocation_mode: "quota",
          quota_limit: delta,
          allocated_by: user.id,
        });

        oldState = { total_quota: currentTotal, used: usedCount };
        newState = { total_quota: qNewQuota, delta, used: usedCount };
        break;
      }

      case "create_payout_recipient": {
        targetType = "office_payout_account";
        const { office_id: prOfficeId } = extra || {};
        if (!prOfficeId) throw new Error("Missing office_id");

        const { data: payoutAccount } = await adminClient
          .from("office_payout_accounts")
          .select("*")
          .eq("office_id", prOfficeId)
          .single();

        if (!payoutAccount) throw new Error("No payout account found for this office");

        const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (!PAYSTACK_SK) throw new Error("Paystack secret key not configured");

        const recipientPayload: any = {
          type: (payoutAccount as any).payment_method === "momo" ? "mobile_money" : "nuban",
          name: (payoutAccount as any).account_name || "Office Account",
          currency: "GHS",
        };

        if ((payoutAccount as any).payment_method === "momo") {
          recipientPayload.account_number = (payoutAccount as any).momo_number;
          const provider = ((payoutAccount as any).momo_provider || "").toLowerCase();
          recipientPayload.bank_code = provider === "mtn" ? "MTN" : provider === "vodafone" ? "VOD" : provider === "airteltigo" ? "ATL" : (payoutAccount as any).momo_provider;
        } else {
          recipientPayload.account_number = (payoutAccount as any).account_number;
          recipientPayload.bank_code = (payoutAccount as any).bank_name;
        }

        const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
          method: "POST",
          headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
          body: JSON.stringify(recipientPayload),
        });
        const recipientData = await recipientRes.json();

        if (!recipientData.status || !recipientData.data?.recipient_code) {
          throw new Error(`Paystack recipient creation failed: ${recipientData.message || "Unknown error"}`);
        }

        const recipientCode = recipientData.data.recipient_code;
        await adminClient
          .from("office_payout_accounts")
          .update({ paystack_recipient_code: recipientCode })
          .eq("office_id", prOfficeId);

        oldState = { paystack_recipient_code: (payoutAccount as any).paystack_recipient_code || null };
        newState = { paystack_recipient_code: recipientCode };
        break;
      }

      case "reset_office_quota_usage": {
        targetType = "office_quota";
        const { office_id: rOfficeId, office_name: rOfficeName } = extra || {};

        if (!rOfficeId) {
          throw new Error("Missing parameter: office_id");
        }

        // Count current usage
        const { data: usageRows } = await adminClient
          .from("serial_assignments")
          .select("id, card_count")
          .eq("office_id", rOfficeId);

        const totalUsed = (usageRows || []).reduce((sum: number, a: any) => sum + (a.card_count || 0), 0);

        if (totalUsed === 0) {
          throw new Error("No used quota to reset for this office");
        }

        oldState = { office_id: rOfficeId, office_name: rOfficeName, used_count: totalUsed, assignment_rows: (usageRows || []).length };

        // Delete all serial_assignments for this office
        const assignmentIds = (usageRows || []).map((r: any) => r.id);
        for (let i = 0; i < assignmentIds.length; i += 500) {
          const batch = assignmentIds.slice(i, i + 500);
          await adminClient
            .from("serial_assignments")
            .delete()
            .in("id", batch);
        }

        newState = { office_id: rOfficeId, office_name: rOfficeName, reset_count: totalUsed, deleted_rows: assignmentIds.length };
        break;
      }

      case "clear_allocation_history": {
        targetType = "office_allocations";
        const clearRegion = extra?.region;
        if (!clearRegion) throw new Error("Missing region for clearing allocation history");

        const { data: existingAllocs } = await adminClient
          .from("office_allocations")
          .select("id")
          .eq("region", clearRegion);

        oldState = { region: clearRegion, record_count: existingAllocs?.length || 0 };

        const { error: delErr } = await adminClient
          .from("office_allocations")
          .delete()
          .eq("region", clearRegion);

        if (delErr) throw new Error(`Failed to clear history: ${delErr.message}`);

        newState = { region: clearRegion, records_deleted: existingAllocs?.length || 0 };
        break;
      }

      case "inventory_adjustment": {
        targetType = "inventory_adjustment";
        const { office_id: iaOfficeId, office_name: iaOfficeName, region: iaRegion, adjustment_type: iaType, quantity: iaQty, note: iaNote, idempotency_key: iaIdemKey, reference_id: iaRefId, correction_tag: iaCorrTag } = extra || {};

        if (!iaOfficeId || !iaOfficeName || !iaRegion || !iaType || !iaQty) {
          throw new Error("Missing inventory adjustment parameters");
        }
        if (!["increase", "decrease"].includes(iaType)) {
          throw new Error("adjustment_type must be 'increase' or 'decrease'");
        }
        if (iaQty <= 0 || iaQty > 10000) {
          throw new Error("Quantity must be between 1 and 10,000");
        }

        // Use the atomic RPC for both increase and decrease
        const { data: adjResult, error: adjError } = await adminClient.rpc(
          "inventory_adjustment_atomic",
          {
            p_adjustment_type: iaType,
            p_office_id: iaOfficeId,
            p_office_name: iaOfficeName,
            p_region: iaRegion,
            p_quantity: iaQty,
            p_reason: reason,
            p_performed_by: user.id,
            p_note: iaNote || null,
            p_idempotency_key: iaIdemKey || null,
            p_reference_id: iaRefId || null,
            p_correction_tag: iaCorrTag || null,
          }
        );

        if (adjError) throw new Error(adjError.message);
        const adjRes = adjResult as any;
        if (!adjRes?.success) throw new Error("Adjustment failed unexpectedly");

        if (adjRes.idempotent) {
          oldState = { action: "inventory_adjustment", idempotent: true };
          newState = { existing_id: adjRes.existing_id, message: adjRes.message };
        } else {
          oldState = { action: "inventory_adjustment" };
          newState = {
            office: iaOfficeName,
            adjustment_type: iaType,
            quantity: adjRes.pairs_affected,
            adjustment_id: adjRes.adjustment_id,
            note: iaNote,
            reference_id: iaRefId || null,
            correction_tag: iaCorrTag || null,
          };
        }
        break;
      }

      case "reset_staff_password": {
        targetType = "admin_staff";
        const newPassword = extra?.new_password;
        if (!newPassword || newPassword.length < 8) {
          throw new Error("New password must be at least 8 characters");
        }
        // Verify target is a staff member
        const { data: targetStaff } = await adminClient
          .from("admin_staff")
          .select("user_id, admin_type")
          .eq("user_id", target_id)
          .single();
        if (!targetStaff) throw new Error("Staff member not found");
        if (target_id === user.id) throw new Error("Cannot reset your own password this way");

        const { error: resetErr } = await adminClient.auth.admin.updateUserById(target_id, { password: newPassword });
        if (resetErr) throw new Error(`Password reset failed: ${resetErr.message}`);

        oldState = { user_id: target_id };
        newState = { password_reset: true };
        break;
      }

      case "freeze_staff": {
        targetType = "admin_staff";
        const { data: freezeStaff } = await adminClient
          .from("admin_staff")
          .select("user_id, admin_type")
          .eq("user_id", target_id)
          .single();
        if (!freezeStaff) throw new Error("Staff member not found");
        if (target_id === user.id) throw new Error("Cannot freeze your own account");

        oldState = { admin_type: (freezeStaff as any).admin_type };

        // Ban user in auth (prevents login)
        const { error: banErr } = await adminClient.auth.admin.updateUserById(target_id, { ban_duration: "876000h" });
        if (banErr) throw new Error(`Failed to freeze: ${banErr.message}`);

        newState = { status: "frozen", banned: true };
        break;
      }

      case "unfreeze_staff": {
        targetType = "admin_staff";
        const { data: unfreezeStaff } = await adminClient
          .from("admin_staff")
          .select("user_id, admin_type")
          .eq("user_id", target_id)
          .single();
        if (!unfreezeStaff) throw new Error("Staff member not found");

        const { error: unbanErr } = await adminClient.auth.admin.updateUserById(target_id, { ban_duration: "none" });
        if (unbanErr) throw new Error(`Failed to unfreeze: ${unbanErr.message}`);

        oldState = { status: "frozen" };
        newState = { status: "active", unbanned: true };
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

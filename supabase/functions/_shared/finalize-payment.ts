/**
 * Shared idempotent payment finalization pipeline.
 * Used by both paystack-webhook and verify-payment.
 *
 * Steps:
 * 1. Mark escrow completed (idempotent)
 * 2. Load split_plan from escrow metadata
 * 3. Create escrow_splits if missing
 * 4. Create receipt if missing
 * 5. Create payout_transfers if missing
 * 6. Handle payment-type-specific side effects
 */

// Recipient → system settlement account type mapping
const RECIPIENT_TO_ACCOUNT_TYPE: Record<string, string> = {
  rent_control: "igf",
  admin: "admin",
  platform: "platform",
  gra: "gra",
};

interface FinalizeOpts {
  supabaseAdmin: any;
  reference: string;
  amountPaid: number;
  transactionId: string;
  logError: (opts: any) => Promise<void>;
}

interface SplitItem {
  recipient: string;
  amount: number;
  description?: string;
}

export async function finalizePayment({ supabaseAdmin, reference, amountPaid, transactionId, logError }: FinalizeOpts): Promise<{ verified: boolean; status: string }> {
  // 1. Find escrow
  const { data: escrow } = await supabaseAdmin
    .from("escrow_transactions")
    .select("id, status, payment_type, user_id, total_amount, related_property_id, related_tenancy_id, related_complaint_id, reference, metadata, office_id, case_id")
    .eq("reference", reference)
    .maybeSingle();

  if (!escrow) throw new Error("Transaction not found");

  const escrowId = escrow.id;
  const userId = escrow.user_id;
  const paymentType = escrow.payment_type;
  const meta = (escrow.metadata as any) || {};
  const officeId = escrow.office_id || meta.office_id || null;

  // 2. Mark completed (idempotent — only if still pending)
  if (escrow.status !== "completed") {
    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed", completed_at: new Date().toISOString(), paystack_transaction_id: transactionId })
      .eq("id", escrowId)
      .in("status", ["pending", "processing"]);
  }

  // 3. Handle payment-type-specific side effects
  await handleSideEffects(supabaseAdmin, { paymentType, userId, meta, escrow, amountPaid, transactionId });

  // 4. Load split plan from metadata
  const splitPlan: SplitItem[] = Array.isArray(meta.split_plan) && meta.split_plan.length > 0
    ? meta.split_plan
    : [{ recipient: "platform", amount: amountPaid, description: `${paymentType} payment` }];

  // 5. Create escrow_splits if missing
  const { data: existingSplits } = await supabaseAdmin
    .from("escrow_splits")
    .select("id, recipient, amount, disbursement_status")
    .eq("escrow_transaction_id", escrowId);

  let splits = existingSplits || [];

  if (splits.length === 0 && splitPlan.length > 0) {
    // Get office payout mode
    let autoRelease = false;
    try {
      const { data: flag } = await supabaseAdmin
        .from("feature_flags")
        .select("is_enabled")
        .eq("feature_key", "office_payout_mode")
        .single();
      autoRelease = flag?.is_enabled ?? false;
    } catch {}

    // Payment types where office attribution is deferred until service is handled
    const DEFERRED_OFFICE_TYPES = ["rent_card", "rent_card_bulk", "add_tenant_fee", "declare_existing_tenancy_fee", "agreement_sale"];
    const isDeferredOffice = DEFERRED_OFFICE_TYPES.includes(paymentType);

    const splitRows = splitPlan.map((s: SplitItem) => {
      const isAdmin = s.recipient === "admin";
      const releaseMode = (isAdmin && autoRelease) ? "auto" : "manual";

      let disbStatus: string;
      if (isAdmin && isDeferredOffice) {
        // Defer office split until the responsible office is determined
        disbStatus = "deferred";
      } else if (s.recipient === "landlord") {
        disbStatus = "held";
      } else if (isAdmin && !autoRelease) {
        disbStatus = "held";
      } else {
        disbStatus = "pending_transfer";
      }

      return {
        escrow_transaction_id: escrowId,
        recipient: s.recipient,
        amount: s.amount,
        description: s.description || "",
        disbursement_status: disbStatus,
        released_at: null,
        office_id: isDeferredOffice && isAdmin ? null : officeId,
        release_mode: releaseMode,
      };
    });

    const { data: inserted } = await supabaseAdmin
      .from("escrow_splits")
      .insert(splitRows)
      .select("id, recipient, amount, disbursement_status");

    splits = inserted || [];

    // Auto-release office fund request if needed
    if (autoRelease && officeId) {
      const adminTotal = splitPlan
        .filter(s => s.recipient === "admin")
        .reduce((sum, s) => sum + s.amount, 0);

      if (adminTotal > 0) {
        // Check if auto fund request already exists
        const { data: existingReq } = await supabaseAdmin
          .from("office_fund_requests")
          .select("id")
          .eq("payout_reference", `auto_${reference}`)
          .maybeSingle();

        if (!existingReq) {
          await supabaseAdmin.from("office_fund_requests").insert({
            office_id: officeId,
            amount: adminTotal,
            purpose: `Auto-released from ${paymentType.replace(/_/g, " ")} payment`,
            requested_by: userId,
            status: "approved",
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            reviewer_notes: "Auto-approved by system (Auto Release Mode)",
            payout_reference: `auto_${reference}`,
          });
        }
      }
    }
  }

  // 6. Create receipt if missing
  const { data: existingReceipt } = await supabaseAdmin
    .from("payment_receipts")
    .select("id")
    .eq("escrow_transaction_id", escrowId)
    .maybeSingle();

  if (!existingReceipt) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", userId)
      .single();

    const splitBreakdown = splitPlan.map((s: SplitItem) => ({ recipient: s.recipient, amount: s.amount }));

    await supabaseAdmin.from("payment_receipts").insert({
      escrow_transaction_id: escrowId,
      user_id: userId,
      payer_name: profile?.full_name || "Customer",
      payer_email: profile?.email || "",
      total_amount: amountPaid,
      payment_type: paymentType,
      description: meta.description || `Payment for ${paymentType.replace(/_/g, " ")}`,
      split_breakdown: splitBreakdown.length > 0 ? splitBreakdown : null,
      qr_code_data: `https://www.rentcontrolghana.com/verify/receipt/${reference}`,
      status: "active",
      office_id: officeId,
      tenancy_id: escrow.related_tenancy_id || null,
    });
  }

  // 7. Create notification if missing
  const { data: existingNotif } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .ilike("body", `%${reference.slice(0, 12)}%`)
    .maybeSingle();

  if (!existingNotif) {
    const notifMap: Record<string, { title: string; body: string; link: string }> = {
      tenant_registration: { title: "Registration Confirmed!", body: "Your tenant registration payment has been confirmed. Your account is now active.", link: "/tenant/dashboard" },
      landlord_registration: { title: "Registration Confirmed!", body: "Your landlord registration payment has been confirmed. Your account is now active.", link: "/landlord/dashboard" },
      listing_fee: { title: "Property Listed!", body: "Your property has been listed on the marketplace.", link: "/landlord/my-properties" },
      rent_card_bulk: { title: "Rent Cards Purchased", body: `${meta.quantity || 1} Rent Card(s) purchased successfully for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
      rent_card: { title: "Rent Card Purchased", body: `Rent Card purchased for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/rent-cards" },
      add_tenant_fee: { title: "Add Tenant Fee Paid", body: `Add tenant fee of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/landlord/add-tenant" },
      complaint_fee: { title: "Complaint Filed", body: `Your complaint filing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed. Your case is now under review.`, link: "/tenant/my-cases" },
      viewing_fee: { title: "Viewing Request Sent", body: `Your viewing fee of GH₵ ${amountPaid.toFixed(2)} has been confirmed.`, link: "/tenant/marketplace" },
      agreement_sale: { title: "Agreement Form Purchased", body: `Agreement form purchased for GH₵ ${amountPaid.toFixed(2)}.`, link: "/landlord/agreements" },
      termination_fee: { title: "Termination Fee Paid", body: `Termination request fee of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/termination" },
      rent_tax: { title: "Rent Tax Paid", body: `Rent tax payment of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/payments" },
      rent_tax_bulk: { title: "Bulk Rent Tax Paid", body: `Bulk advance rent tax of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/payments" },
      renewal_payment: { title: "Renewal Payment Confirmed", body: `Tenancy renewal payment of GH₵ ${amountPaid.toFixed(2)} confirmed.`, link: "/tenant/dashboard" },
    };
    const notif = notifMap[paymentType];
    if (notif) {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: notif.title,
        body: notif.body,
        link: notif.link,
      });
    }
  }

  // 8. Update case status
  if (escrow.case_id) {
    await supabaseAdmin
      .from("cases")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", escrow.case_id)
      .neq("status", "completed");
  }

  // 9. Trigger payout transfers if missing
  try {
    const { data: existingPayouts } = await supabaseAdmin
      .from("payout_transfers")
      .select("id")
      .eq("escrow_transaction_id", escrowId)
      .limit(1);

    if (!existingPayouts || existingPayouts.length === 0) {
      const PAYSTACK_SK = Deno.env.get("PAYSTACK_SECRET_KEY");
      if (PAYSTACK_SK && splits.length > 0) {
        for (const split of splits) {
          if (split.recipient === "landlord" || split.disbursement_status === "held" || split.disbursement_status === "deferred" || split.amount <= 0) continue;

          const accountType = RECIPIENT_TO_ACCOUNT_TYPE[split.recipient];
          let recipientCode: string | null = null;
          let recipientType = split.recipient;

          if (accountType) {
            const { data: account } = await supabaseAdmin
              .from("system_settlement_accounts")
              .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
              .eq("account_type", accountType)
              .single();

            if (account) {
              recipientCode = account.paystack_recipient_code;
              if (!recipientCode) {
                recipientCode = await createPaystackRecipient(PAYSTACK_SK, account);
                if (recipientCode) {
                  await supabaseAdmin.from("system_settlement_accounts").update({ paystack_recipient_code: recipientCode }).eq("account_type", accountType);
                }
              }
              recipientType = accountType;
            }
          } else if (split.recipient === "admin" && officeId) {
            // Office payout account
            const { data: officeAccount } = await supabaseAdmin
              .from("office_payout_accounts")
              .select("payment_method, account_name, bank_name, account_number, momo_number, momo_provider, paystack_recipient_code")
              .eq("office_id", officeId)
              .single();

            if (officeAccount) {
              recipientCode = officeAccount.paystack_recipient_code;
              if (!recipientCode) {
                recipientCode = await createPaystackRecipient(PAYSTACK_SK, officeAccount);
                if (recipientCode) {
                  await supabaseAdmin.from("office_payout_accounts").update({ paystack_recipient_code: recipientCode }).eq("office_id", officeId);
                }
              }
              recipientType = "office";
            }
          }

          const payoutRef = `fpayout_${escrowId.slice(0, 8)}_${(split.id || "").slice(0, 8)}_${Date.now()}`;

          if (recipientCode) {
            try {
              const tRes = await fetch("https://api.paystack.co/transfer", {
                method: "POST",
                headers: { Authorization: `Bearer ${PAYSTACK_SK}`, "Content-Type": "application/json" },
                body: JSON.stringify({ source: "balance", amount: Math.round(split.amount * 100), recipient: recipientCode, reason: `${recipientType} share`, reference: payoutRef, currency: "GHS" }),
              });
              const tData = await tRes.json();

              await supabaseAdmin.from("payout_transfers").insert({
                escrow_split_id: split.id || null,
                escrow_transaction_id: escrowId,
                recipient_type: recipientType,
                recipient_code: recipientCode,
                transfer_code: tData.data?.transfer_code || null,
                amount: split.amount,
                status: tData.status ? "pending" : "failed",
                paystack_reference: payoutRef,
                failure_reason: tData.status ? null : (tData.message || "Transfer failed"),
              });

              if (tData.status && split.id) {
                await supabaseAdmin.from("escrow_splits").update({ disbursement_status: "released", released_at: new Date().toISOString() }).eq("id", split.id);
              }
            } catch (e: any) {
              await supabaseAdmin.from("payout_transfers").insert({
                escrow_split_id: split.id || null,
                escrow_transaction_id: escrowId,
                recipient_type: recipientType,
                recipient_code: recipientCode,
                amount: split.amount,
                status: "failed",
                paystack_reference: payoutRef,
                failure_reason: e.message || "Transfer error",
              });
            }
          } else {
            await supabaseAdmin.from("payout_transfers").insert({
              escrow_split_id: split.id || null,
              escrow_transaction_id: escrowId,
              recipient_type: recipientType,
              recipient_code: null,
              amount: split.amount,
              status: "failed",
              paystack_reference: payoutRef,
              failure_reason: "No payout account configured for " + recipientType,
            });
          }
        }
      }
    }
  } catch (payoutErr: any) {
    console.error("Payout trigger error:", payoutErr.message);
    await logError({ escrow_transaction_id: escrowId, reference, error_stage: "payout_trigger", error_message: payoutErr.message || String(payoutErr), severity: "critical" });
  }

  // 10. Validate allocation consistency (log warning only)
  try {
    const storedSplitPlan = meta.split_plan;
    if (Array.isArray(storedSplitPlan) && storedSplitPlan.length > 0) {
      const storedTotal = storedSplitPlan.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      if (Math.abs(storedTotal - amountPaid) > 0.5) {
        await logError({
          escrow_transaction_id: escrowId,
          reference,
          error_stage: "allocation_validation",
          error_message: `Split plan total (${storedTotal}) differs from paid amount (${amountPaid}) by ${Math.abs(storedTotal - amountPaid).toFixed(2)}`,
          severity: "warning",
          error_context: { stored_total: storedTotal, paid: amountPaid },
        });
      }
    }
  } catch {}

  return { verified: true, status: "completed" };
}

// Handle payment-type-specific side effects (updating tenants, landlords, etc.)
async function handleSideEffects(supabaseAdmin: any, opts: { paymentType: string; userId: string; meta: any; escrow: any; amountPaid: number; transactionId: string }) {
  const { paymentType, userId, meta, escrow, amountPaid, transactionId } = opts;

  if (paymentType === "tenant_registration") {
    const { data: tenant } = await supabaseAdmin.from("tenants").select("registration_fee_paid").eq("user_id", userId).single();
    if (tenant && !tenant.registration_fee_paid) {
      await supabaseAdmin.from("tenants").update({
        registration_fee_paid: true,
        registration_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("user_id", userId);
    }
  } else if (paymentType === "landlord_registration") {
    const { data: landlord } = await supabaseAdmin.from("landlords").select("registration_fee_paid").eq("user_id", userId).maybeSingle();
    const regData = {
      registration_fee_paid: true,
      registration_date: new Date().toISOString(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    if (landlord && !landlord.registration_fee_paid) {
      await supabaseAdmin.from("landlords").update(regData).eq("user_id", userId);
    } else if (!landlord) {
      // Defensive: create landlord record if missing
      const landlordId = "LL-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
      await supabaseAdmin.from("landlords").insert({ user_id: userId, landlord_id: landlordId, ...regData });
    }
  } else if (paymentType === "listing_fee") {
    const propertyId = escrow.related_property_id;
    if (propertyId) {
      await supabaseAdmin.from("properties").update({ listed_on_marketplace: true }).eq("id", propertyId);
    }
  } else if (paymentType === "complaint_fee") {
    const complaintId = meta?.complaintId || escrow.related_complaint_id;
    if (complaintId) {
      await supabaseAdmin.from("complaints").update({ status: "submitted" }).eq("id", complaintId).eq("status", "pending_payment");
    }
  } else if (paymentType === "viewing_fee") {
    const viewingRequestId = meta?.viewingRequestId;
    if (viewingRequestId) {
      await supabaseAdmin.from("viewing_requests").update({ status: "pending" }).eq("id", viewingRequestId).eq("status", "awaiting_payment");
    }
  } else if (paymentType === "rent_tax_bulk") {
    const tenancyId = escrow.related_tenancy_id;
    if (tenancyId) {
      const paymentIds = meta?.paymentIds;
      if (Array.isArray(paymentIds) && paymentIds.length > 0) {
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", receiver: transactionId,
        }).in("id", paymentIds).eq("tenant_marked_paid", false);
      } else {
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", receiver: transactionId,
        }).eq("tenancy_id", tenancyId).eq("tenant_marked_paid", false);
      }
    }
  } else if (paymentType === "rent_tax") {
    const paymentIds = meta?.paymentIds;
    if (Array.isArray(paymentIds) && paymentIds.length > 0) {
      await supabaseAdmin.from("rent_payments").update({
        tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", amount_paid: amountPaid, receiver: transactionId,
      }).in("id", paymentIds);
    } else {
      const ref = escrow.reference || "";
      if (ref.startsWith("rent_")) {
        const paymentId = ref.replace("rent_", "");
        await supabaseAdmin.from("rent_payments").update({
          tenant_marked_paid: true, status: "tenant_paid", paid_date: new Date().toISOString(), payment_method: "Paystack", amount_paid: amountPaid, receiver: transactionId,
        }).eq("id", paymentId);
      }
    }
  } else if (paymentType === "rent_card_bulk" || paymentType === "rent_card") {
    const qty = meta?.quantity || 1;
    const cardCount = qty * 2;
    const { data: existingCards } = await supabaseAdmin.from("rent_cards").select("id").eq("escrow_transaction_id", escrow.id);
    if (!existingCards || existingCards.length === 0) {
      const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
      const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
      const rentCards = [];
      for (let i = 0; i < cardCount; i++) {
        rentCards.push({
          landlord_user_id: userId,
          status: "awaiting_serial",
          escrow_transaction_id: escrow.id,
          serial_number: null,
          purchase_id: purchaseId,
        });
      }
      await supabaseAdmin.from("rent_cards").insert(rentCards);
    }
  } else if (paymentType === "renewal_payment") {
    const tenancyId = escrow.related_tenancy_id || meta?.tenancyId;
    if (tenancyId) {
      // Check if renewal already processed (new tenancy exists)
      const { data: existingRenewal } = await supabaseAdmin
        .from("tenancies")
        .select("id")
        .eq("previous_tenancy_id", tenancyId)
        .maybeSingle();

      if (!existingRenewal) {
        const { data: oldTenancy } = await supabaseAdmin.from("tenancies").select("*").eq("id", tenancyId).single();
        if (oldTenancy) {
          const rent = Number(oldTenancy.proposed_rent ?? oldTenancy.agreed_rent);
          const months = oldTenancy.renewal_duration_months ?? 12;
          const advanceMonths = Math.min(oldTenancy.advance_months ?? 6, 6);

          const newStart = new Date(oldTenancy.end_date);
          const newEnd = new Date(newStart);
          newEnd.setMonth(newEnd.getMonth() + months);

          const { data: newTenancy, error: insertErr } = await supabaseAdmin
            .from("tenancies")
            .insert({
              tenant_user_id: oldTenancy.tenant_user_id,
              landlord_user_id: oldTenancy.landlord_user_id,
              unit_id: oldTenancy.unit_id,
              agreed_rent: rent,
              advance_months: advanceMonths,
              start_date: newStart.toISOString().split("T")[0],
              end_date: newEnd.toISOString().split("T")[0],
              move_in_date: newStart.toISOString().split("T")[0],
              tenant_id_code: oldTenancy.tenant_id_code,
              registration_code: `REN-${oldTenancy.registration_code}`,
              status: "active",
              tenancy_type: "renewal",
              previous_tenancy_id: tenancyId,
              tenant_accepted: true,
              landlord_accepted: true,
              office_id: oldTenancy.office_id || null,
            })
            .select("id")
            .single();

          if (!insertErr && newTenancy) {
            await supabaseAdmin.from("tenancies").update({ status: "expired" }).eq("id", tenancyId);
            const payments = [];
            for (let i = 0; i < months; i++) {
              const dueDate = new Date(newStart);
              dueDate.setMonth(dueDate.getMonth() + i);
              const taxAmount = rent * 0.08;
              payments.push({
                tenancy_id: newTenancy.id,
                due_date: dueDate.toISOString().split("T")[0],
                month_label: dueDate.toLocaleString("en-GB", { month: "long", year: "numeric" }),
                monthly_rent: rent,
                tax_amount: taxAmount,
                amount_to_landlord: rent,
                status: i < advanceMonths ? "tenant_paid" : "pending",
                tenant_marked_paid: i < advanceMonths,
              });
            }
            if (payments.length > 0) await supabaseAdmin.from("rent_payments").insert(payments);

            await supabaseAdmin.from("notifications").insert([
              { user_id: oldTenancy.tenant_user_id, title: "Tenancy Renewed!", body: `Your tenancy has been renewed at GH₵ ${rent.toLocaleString()}/month for ${months} months.`, link: "/tenant/dashboard" },
              { user_id: oldTenancy.landlord_user_id, title: "Tenancy Renewed", body: `Tenancy ${oldTenancy.registration_code} has been renewed for ${months} months.`, link: "/landlord/dashboard" },
            ]);
          }
        }
      }
    }
  }
}

// Create a Paystack transfer recipient
async function createPaystackRecipient(secretKey: string, account: any): Promise<string | null> {
  try {
    const payload: any = {
      type: account.payment_method === "momo" ? "mobile_money" : "nuban",
      name: account.account_name || "Settlement Account",
      currency: "GHS",
    };
    if (account.payment_method === "momo") {
      payload.account_number = account.momo_number;
      const p = (account.momo_provider || "").toLowerCase();
      payload.bank_code = p === "mtn" ? "MTN" : p === "vodafone" ? "VOD" : p === "airteltigo" ? "ATL" : account.momo_provider;
    } else {
      payload.account_number = account.account_number;
      payload.bank_code = account.bank_name;
    }

    const res = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.status && data.data?.recipient_code) {
      return data.data.recipient_code;
    }
    return null;
  } catch {
    return null;
  }
}

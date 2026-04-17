import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── STAGE 1: FEE DETERMINATION ───
// Sole authority on what the user pays. Uses feature_flags for flat fees,
// rent_bands for band-based fees (agreement_sale, add_tenant_fee).

const BAND_BASED_TYPES = new Set(["agreement_sale", "add_tenant_fee"]);

const FEE_KEY_TO_PAYMENT_TYPE: Record<string, string> = {
  tenant_registration_fee: "tenant_registration",
  landlord_registration_fee: "landlord_registration",
  rent_card_fee: "rent_card",
  agreement_sale_fee: "agreement_sale",
  complaint_fee: "complaint_fee",
  listing_fee: "listing_fee",
  viewing_fee: "viewing_fee",
  add_tenant_fee: "add_tenant_fee",
  termination_fee: "termination_fee",
  archive_search_fee: "archive_search_fee",
};

interface DeterminedFee {
  amount: number;
  enabled: boolean;
  rentBandId: string | null;
  paymentType: string;
}

const determineFee = async (
  supabaseAdmin: any,
  feeKey: string,
  monthlyRent?: number
): Promise<DeterminedFee> => {
  const paymentType = FEE_KEY_TO_PAYMENT_TYPE[feeKey] || feeKey;

  // Get enabled status from feature_flags
  const { data: flagData } = await supabaseAdmin
    .from("feature_flags")
    .select("fee_amount, fee_enabled")
    .eq("feature_key", feeKey)
    .single();

  const enabled = flagData?.fee_enabled ?? true;

  // For band-based types, amount MUST come from rent_bands — never from feature_flags
  if (BAND_BASED_TYPES.has(paymentType)) {
    if (monthlyRent == null || monthlyRent <= 0) {
      throw new Error("Monthly rent is required to determine the fee for this payment type.");
    }

    const { data: bands } = await supabaseAdmin
      .from("rent_bands")
      .select("id, min_rent, max_rent, fee_amount")
      .order("min_rent", { ascending: true });

    if (bands && bands.length > 0) {
      for (const band of bands) {
        const min = Number(band.min_rent);
        const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
        if (monthlyRent >= min && monthlyRent <= max) {
          return { amount: Number(band.fee_amount), enabled, rentBandId: band.id, paymentType };
        }
      }
    }

    // No matching band found — error, do NOT fall back to flat fee
    throw new Error(`No rent band configured for monthly rent of GH₵ ${monthlyRent}. Please configure rent bands in Engine Room.`);
  }

  // Flat fee from feature_flags (only for non-band-based types)
  const amount = flagData?.fee_amount ?? 0;
  return { amount, enabled, rentBandId: null, paymentType };
};

// ─── STAGE 2: ALLOCATION (Split Engine) ───
// Determines how the payable amount is distributed.
// For band-based types → uses rent_band_allocations
// For flat types → uses split_configurations (proportional shares)
// NEVER overrides the payable amount.

interface SplitItem {
  recipient: string;
  amount: number;
  description: string;
}

const loadAllocation = async (
  supabaseAdmin: any,
  paymentType: string,
  payableAmount: number,
  rentBandId: string | null
): Promise<SplitItem[]> => {
  // For band-based types with a matched band, load from rent_band_allocations
  if (rentBandId && BAND_BASED_TYPES.has(paymentType)) {
    const { data: bandAllocations } = await supabaseAdmin
      .from("rent_band_allocations")
      .select("recipient, amount, description")
      .eq("rent_band_id", rentBandId)
      .eq("payment_type", paymentType)
      .order("sort_order", { ascending: true });

    if (bandAllocations && bandAllocations.length > 0) {
      const splits: SplitItem[] = bandAllocations.map((a: any) => ({
        recipient: a.recipient,
        amount: Number(a.amount),
        description: a.description || "",
      }));

      // Strict validation: sum MUST equal payableAmount
      const total = splits.reduce((s, r) => s + r.amount, 0);
      const diff = Math.abs(total - payableAmount);
      if (diff > 0.02) {
        throw new Error(`Allocation configuration error: band allocations total (GH₵ ${total.toFixed(2)}) does not match fee amount (GH₵ ${payableAmount.toFixed(2)}). Please update allocations in Engine Room.`);
      }

      return splits;
    }
  }

  // For flat types or when no band allocations exist, use split_configurations
  const { data: dbSplits } = await supabaseAdmin
    .from("split_configurations")
    .select("recipient, amount, description, is_platform_fee, amount_type")
    .eq("payment_type", paymentType)
    .order("sort_order", { ascending: true });

  if (!dbSplits || dbSplits.length === 0) {
    // Fallback: assign full amount to admin when no split config exists
    // This allows bundle fee components (register_tenant_fee, filing_fee) to work
    // even before explicit splits are configured
    return [{ recipient: "admin", amount: payableAmount, description: `${paymentType} (default)` }];
  }

  // Treat split amounts as proportional shares
  const dbTotal = dbSplits.reduce((s: number, r: any) => s + Number(r.amount), 0);
  if (dbTotal <= 0) {
    throw new Error(`Split configuration total is zero for ${paymentType}.`);
  }

  const splits: SplitItem[] = dbSplits.map((s: any) => ({
    recipient: s.recipient,
    amount: Math.round((payableAmount * Number(s.amount) / dbTotal) * 100) / 100,
    description: s.description || "",
  }));

  // Ensure rounding doesn't create mismatch
  const splitTotal = splits.reduce((s, r) => s + r.amount, 0);
  const roundingDiff = payableAmount - splitTotal;
  if (Math.abs(roundingDiff) > 0.001 && splits.length > 0) {
    splits[0].amount = Math.round((splits[0].amount + roundingDiff) * 100) / 100;
  }

  return splits;
};

// Build tax splits from DB config (percentage-based)
const getTaxSplitPlan = async (supabaseAdmin: any, taxAmount: number, description: string): Promise<SplitItem[]> => {
  const { data } = await supabaseAdmin
    .from("split_configurations")
    .select("recipient, amount, description, is_platform_fee, amount_type")
    .eq("payment_type", "rent_tax")
    .order("sort_order", { ascending: true });

  if (data && data.length > 0) {
    const totalPct = data.reduce((s: number, r: any) => s + Number(r.amount), 0);
    if (totalPct > 0) {
      return data.map((s: any) => ({
        recipient: s.recipient,
        amount: Math.round((taxAmount * Number(s.amount) / totalPct) * 100) / 100,
        description: s.description || description,
      }));
    }
  }
  return [{ recipient: "rent_control", amount: taxAmount, description }];
};

// Resolve office_id from property or region
const resolveOffice = async (supabaseAdmin: any, opts: { propertyId?: string; region?: string; area?: string; userId?: string }): Promise<string> => {
  try {
    if (opts.propertyId) {
      const { data: prop } = await supabaseAdmin
        .from("properties")
        .select("area, region, office_id")
        .eq("id", opts.propertyId)
        .single();
      if (prop?.office_id) return prop.office_id;
      if (prop) {
        const { data: officeId } = await supabaseAdmin.rpc("resolve_office_id", { p_region: prop.region, p_area: prop.area });
        return officeId || "accra_central";
      }
    }
    if (opts.region) {
      const { data: officeId } = await supabaseAdmin.rpc("resolve_office_id", { p_region: opts.region, p_area: opts.area || null });
      return officeId || "accra_central";
    }
    if (opts.userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("delivery_region, delivery_area")
        .eq("user_id", opts.userId)
        .single();
      if (profile?.delivery_region) {
        const { data: officeId } = await supabaseAdmin.rpc("resolve_office_id", { p_region: profile.delivery_region, p_area: profile.delivery_area || null });
        return officeId || "accra_central";
      }
    }
  } catch (e) {
    console.error("Office resolution error:", e);
  }
  return "accra_central";
};

const createCase = async (supabaseAdmin: any, opts: { officeId: string; userId: string; caseType: string; relatedPropertyId?: string; relatedTenancyId?: string; relatedComplaintId?: string; metadata?: any }): Promise<{ caseId: string; caseNumber: string }> => {
  try {
    const { data: caseNumber } = await supabaseAdmin.rpc("generate_case_number");
    const { data: caseRecord } = await supabaseAdmin
      .from("cases")
      .insert({
        case_number: caseNumber || `CASE-${Date.now()}`,
        office_id: opts.officeId,
        user_id: opts.userId,
        case_type: opts.caseType,
        related_property_id: opts.relatedPropertyId || null,
        related_tenancy_id: opts.relatedTenancyId || null,
        related_complaint_id: opts.relatedComplaintId || null,
        metadata: opts.metadata || {},
      })
      .select("id, case_number")
      .single();
    return { caseId: caseRecord?.id || "", caseNumber: caseRecord?.case_number || caseNumber || "" };
  } catch (e) {
    console.error("Case creation error:", e);
    return { caseId: "", caseNumber: "" };
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) throw new Error("Not authenticated");
    const userId = authUser.id;

    const body = await req.json();
    const { type } = body;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone, delivery_region, delivery_area")
      .eq("user_id", userId)
      .single();

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let totalAmount: number;
    let description: string;
    let reference: string;
    let callbackPath: string;
    let splitPlan: SplitItem[] = [];
    let relatedTenancyId: string | null = null;
    let relatedComplaintId: string | null = null;
    let relatedPropertyId: string | null = null;
    let metadata: Record<string, any> = {};
    let officeId: string = "accra_central";
    let caseType: string = type;

    if (type === "rent_tax_bulk") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy, error: tErr } = await supabaseAdmin
        .from("tenancies")
        .select("id, tenant_user_id, registration_code, advance_months, agreed_rent, unit_id")
        .eq("id", tenancyId)
        .single();

      if (tErr || !tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const { data: unit } = await supabaseAdmin.from("units").select("property_id").eq("id", (tenancy as any).unit_id).single();
      if (unit) officeId = await resolveOffice(supabaseAdmin, { propertyId: unit.property_id });

      const maxLawful = Number((tenancy as any).agreed_rent) * 6;

      const advanceMonths = Number((tenancy as any).advance_months) || 6;
      const { data: unpaidPayments, error: pErr } = await supabaseAdmin
        .from("rent_payments")
        .select("id, tax_amount, tenant_marked_paid")
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false)
        .order("due_date", { ascending: true })
        .limit(advanceMonths);

      if (pErr) throw new Error("Failed to fetch payments");
      if (!unpaidPayments || unpaidPayments.length === 0) throw new Error("No unpaid payments found");

      const seenIds = new Set<string>();
      const dedupedPayments = unpaidPayments.filter((p: any) => {
        if (seenIds.has(p.id)) return false;
        seenIds.add(p.id);
        return true;
      });

      totalAmount = dedupedPayments.reduce((sum: number, p: any) => sum + Number(p.tax_amount), 0);

      const totalAdvanceAmount = Number((tenancy as any).agreed_rent) * (tenancy as any).advance_months;
      if (totalAdvanceAmount > maxLawful) {
        await supabaseAdmin.from("illegal_payment_attempts").insert({
          tenancy_id: tenancyId,
          user_id: userId,
          attempted_amount: totalAdvanceAmount,
          max_lawful_amount: maxLawful,
          description: `Bulk tax payment attempted for advance exceeding 6-month limit.`,
        });
        throw new Error(`Advance exceeds the maximum lawful limit of GH₵ ${maxLawful.toLocaleString()}`);
      }

      splitPlan = await getTaxSplitPlan(supabaseAdmin, totalAmount, "Rent tax (bulk advance)");
      description = `Bulk advance rent tax (${dedupedPayments.length} months) - ${(tenancy as any).registration_code}`;
      reference = `rentbulk_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;
      metadata = { paymentIds: dedupedPayments.map((p: any) => p.id) };
      caseType = "rent_tax";

    } else if (type === "rent_tax") {
      const { paymentId } = body;
      if (!paymentId) throw new Error("paymentId is required");

      const { data: payment, error: payErr } = await supabaseAdmin
        .from("rent_payments")
        .select("*, tenancy:tenancies(tenant_user_id, registration_code, unit_id)")
        .eq("id", paymentId)
        .single();

      if (payErr || !payment) throw new Error("Payment not found");
      if ((payment as any).tenancy.tenant_user_id !== userId) throw new Error("Unauthorized");
      if (payment.tenant_marked_paid) throw new Error("Already paid");

      const { data: unit } = await supabaseAdmin.from("units").select("property_id").eq("id", (payment as any).tenancy.unit_id).single();
      if (unit) officeId = await resolveOffice(supabaseAdmin, { propertyId: unit.property_id });

      totalAmount = Number(payment.tax_amount);
      splitPlan = await getTaxSplitPlan(supabaseAdmin, totalAmount, `Rent tax - ${payment.month_label}`);
      description = `Rent tax for ${payment.month_label} - ${(payment as any).tenancy.registration_code}`;
      reference = `rent_${paymentId}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = payment.tenancy_id;

    } else if (type === "rent_payment") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, agreed_rent, registration_code, unit_id")
        .eq("id", tenancyId)
        .single();

      if (!tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const { data: unit } = await supabaseAdmin.from("units").select("property_id").eq("id", (tenancy as any).unit_id).single();
      if (unit) officeId = await resolveOffice(supabaseAdmin, { propertyId: unit.property_id });

      totalAmount = Number((tenancy as any).agreed_rent);
      splitPlan = [{ recipient: "landlord", amount: totalAmount, description: "Monthly rent (held in escrow)" }];
      description = `Monthly rent - ${(tenancy as any).registration_code}`;
      reference = `rentpay_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "rent_combined") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, agreed_rent, registration_code, unit_id")
        .eq("id", tenancyId)
        .single();

      if (!tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const { data: unit } = await supabaseAdmin
        .from("units")
        .select("property_id")
        .eq("id", (tenancy as any).unit_id)
        .single();

      let taxRate = 0.08;
      if (unit) {
        officeId = await resolveOffice(supabaseAdmin, { propertyId: unit.property_id });
        const { data: prop } = await supabaseAdmin
          .from("properties")
          .select("property_category")
          .eq("id", unit.property_id)
          .single();
        if (prop?.property_category === "commercial") taxRate = 0.15;
      }

      const rent = Number((tenancy as any).agreed_rent);
      const taxAmount = rent * taxRate;
      totalAmount = rent + taxAmount;
      const taxSplits = await getTaxSplitPlan(supabaseAdmin, taxAmount, `Rent tax (${taxRate * 100}%)`);
      splitPlan = [
        ...taxSplits,
        { recipient: "landlord", amount: rent, description: "Monthly rent (held in escrow)" },
      ];
      description = `Rent + Tax combined - ${(tenancy as any).registration_code}`;
      reference = `rentcombo_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "rent_card_bulk") {
      const { quantity: qty } = body;
      const cardQty = Math.min(Math.max(parseInt(qty) || 1, 1), 50);
      const fee = await determineFee(supabaseAdmin, "rent_card_fee");

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "rent_card";

      if (!fee.enabled) {
        const cardCount = cardQty * 2;
        const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
        const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
        const rentCards = [];
        for (let i = 0; i < cardCount; i++) {
          rentCards.push({
            landlord_user_id: userId,
            status: "awaiting_serial",
            purchase_id: purchaseId,
            purchased_at: new Date().toISOString(),
            qr_token: crypto.randomUUID(),
          });
        }
        await supabaseAdmin.from("rent_cards").insert(rentCards);
        return new Response(JSON.stringify({ skipped: true, message: `Rent card fee is currently waived. ${cardCount} cards created!` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const perCardAllocation = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      totalAmount = fee.amount * cardQty;
      splitPlan = perCardAllocation.map(s => ({ ...s, amount: Math.round(s.amount * cardQty * 100) / 100 }));
      description = `Rent Card Purchase (${cardQty} cards × GH₵ ${fee.amount})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";
      metadata = { quantity: cardQty };

    } else if (type === "rent_card") {
      const fee = await determineFee(supabaseAdmin, "rent_card_fee");
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "rent_card";

      if (!fee.enabled) {
        const cardCount = 2;
        const { data: purchaseIdData } = await supabaseAdmin.rpc("generate_purchase_id");
        const purchaseId = purchaseIdData || `PUR-${Date.now()}`;
        const rentCards = [];
        for (let i = 0; i < cardCount; i++) {
          rentCards.push({
            landlord_user_id: userId,
            status: "awaiting_serial",
            purchase_id: purchaseId,
            purchased_at: new Date().toISOString(),
            qr_token: crypto.randomUUID(),
          });
        }
        await supabaseAdmin.from("rent_cards").insert(rentCards);
        return new Response(JSON.stringify({ skipped: true, message: `Rent card fee is currently waived. ${cardCount} cards created!` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Rent Card Purchase (GH₵ ${fee.amount})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";

    } else if (type === "agreement_sale") {
      // Band-based fee: uses rent bands when monthlyRent is provided
      const { tenancyId, monthlyRent: bodyMonthlyRent, propertyId: bodyPropertyId } = body;

      if (bodyPropertyId) {
        officeId = await resolveOffice(supabaseAdmin, { propertyId: bodyPropertyId });
        relatedPropertyId = bodyPropertyId;
      } else {
        officeId = await resolveOffice(supabaseAdmin, { userId });
      }
      caseType = "tenancy";

      // Stage 1: Determine fee (band-based if monthlyRent provided)
      const fee = await determineFee(supabaseAdmin, "agreement_sale_fee", bodyMonthlyRent ? Number(bodyMonthlyRent) : undefined);
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Agreement fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Stage 2: Load allocation for this fee amount
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Tenancy Agreement Form (GH₵ ${fee.amount})`;
      reference = `agrsale_${tenancyId || userId}_${Date.now()}`;
      callbackPath = body.callbackPath || "/landlord/agreements?status=success";
      relatedTenancyId = tenancyId || null;

    } else if (type === "tenant_registration") {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (!tenant) throw new Error("Tenant record not found");
      if (tenant.registration_fee_paid) throw new Error("Registration fee already paid");

      officeId = await resolveOffice(supabaseAdmin, { userId, region: profile?.delivery_region || undefined, area: profile?.delivery_area || undefined });
      caseType = "registration";

      const fee = await determineFee(supabaseAdmin, "tenant_registration_fee");
      if (!fee.enabled || fee.amount === 0) {
        await supabaseAdmin.from("tenants").update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("user_id", userId);
        return new Response(JSON.stringify({ skipped: true, message: "Registration fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Tenant Registration Fee (GH₵ ${fee.amount})`;
      reference = `treg_${userId}_${Date.now()}`;
      callbackPath = "/tenant/dashboard?status=success";

    } else if (type === "landlord_registration") {
      let { data: landlord } = await supabase
        .from("landlords")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .maybeSingle();

      // Defensive: auto-create landlord record if missing but user has landlord role
      if (!landlord) {
        const landlordId = "LL-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));
        const { data: created, error: createErr } = await supabaseAdmin
          .from("landlords")
          .insert({ user_id: userId, landlord_id: landlordId, registration_fee_paid: false })
          .select("id, registration_fee_paid")
          .single();
        if (createErr) throw new Error("Failed to create landlord record: " + createErr.message);
        landlord = created;
      }

      if (landlord.registration_fee_paid) throw new Error("Registration fee already paid");

      officeId = await resolveOffice(supabaseAdmin, { userId, region: profile?.delivery_region || undefined, area: profile?.delivery_area || undefined });
      caseType = "registration";

      const fee = await determineFee(supabaseAdmin, "landlord_registration_fee");
      if (!fee.enabled || fee.amount === 0) {
        await supabaseAdmin.from("landlords").update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("user_id", userId);
        return new Response(JSON.stringify({ skipped: true, message: "Registration fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Landlord Registration Fee (GH₵ ${fee.amount})`;
      reference = `lreg_${userId}_${Date.now()}`;
      callbackPath = "/landlord/dashboard?status=success";

    } else if (type === "complaint_fee") {
      const { complaintId } = body;
      if (!complaintId) throw new Error("complaintId is required");

      // Try tenant complaints first
      let complaint: any = null;
      let isLandlordComplaint = false;
      const { data: tComp } = await supabaseAdmin
        .from("complaints")
        .select("id, status, payment_status, tenant_user_id, region, office_id, outstanding_amount")
        .eq("id", complaintId)
        .maybeSingle();
      if (tComp) {
        complaint = tComp;
      } else {
        const { data: lComp } = await supabaseAdmin
          .from("landlord_complaints")
          .select("id, status, payment_status, landlord_user_id, region, office_id, outstanding_amount")
          .eq("id", complaintId)
          .maybeSingle();
        complaint = lComp;
        isLandlordComplaint = true;
      }

      if (!complaint) throw new Error("Complaint not found");
      const ownerId = isLandlordComplaint ? complaint.landlord_user_id : complaint.tenant_user_id;
      if (ownerId !== userId) throw new Error("Unauthorized");
      if (complaint.payment_status !== "pending" || complaint.status !== "pending_payment") {
        throw new Error("This complaint is not awaiting payment");
      }
      const serverAmount = Number(complaint.outstanding_amount || 0);
      if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
        throw new Error("No payment amount has been set by the admin yet");
      }

      officeId = complaint.office_id || await resolveOffice(supabaseAdmin, { region: complaint.region });
      caseType = "complaint";
      relatedComplaintId = complaintId;

      // Trusted server-side amount; ignore any client-supplied figure
      totalAmount = serverAmount;
      splitPlan = await loadAllocation(supabaseAdmin, "complaint_fee", totalAmount, null);
      description = `Complaint Filing Fee (GH₵ ${totalAmount.toFixed(2)})`;
      reference = `comp_${complaintId}_${Date.now()}`;
      callbackPath = "/tenant/my-cases?status=success";
      metadata = { ...metadata, complaintId, isLandlordComplaint };

    } else if (type === "listing_fee") {
      const { propertyId } = body;
      if (!propertyId) throw new Error("propertyId is required");

      const { data: prop } = await supabaseAdmin
        .from("properties")
        .select("id, landlord_user_id, listed_on_marketplace")
        .eq("id", propertyId)
        .single();

      if (!prop) throw new Error("Property not found");
      if (prop.landlord_user_id !== userId) throw new Error("Unauthorized");
      if (prop.listed_on_marketplace) throw new Error("Already listed");

      officeId = await resolveOffice(supabaseAdmin, { propertyId });
      caseType = "listing";
      relatedPropertyId = propertyId;

      const fee = await determineFee(supabaseAdmin, "listing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Listing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Property Listing Fee (GH₵ ${fee.amount})`;
      reference = `list_${propertyId}_${Date.now()}`;
      callbackPath = "/landlord/my-properties?status=listed";

    } else if (type === "viewing_fee") {
      const { viewingRequestId } = body;
      if (!viewingRequestId) throw new Error("viewingRequestId is required");

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "viewing";

      const fee = await determineFee(supabaseAdmin, "viewing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Viewing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Property Viewing Request Fee (GH₵ ${fee.amount})`;
      reference = `view_${viewingRequestId}`;
      callbackPath = "/tenant/marketplace?status=viewing_paid";

    } else if (type === "add_tenant_fee") {
      // Band-based fee: uses rent bands when monthlyRent is provided
      // Now splits into individual fee components like existing_tenancy_bundle
      const { monthlyRent: bodyMonthlyRent } = body;

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "tenancy";

      const mr = bodyMonthlyRent ? Number(bodyMonthlyRent) : undefined;

      // Look up add_tenant band for component breakdown
      let matchedBand: any = null;
      if (mr && mr > 0) {
        const { data: bands } = await supabaseAdmin
          .from("rent_bands")
          .select("id, min_rent, max_rent, register_fee, filing_fee, agreement_fee, fee_amount")
          .eq("band_type", "add_tenant")
          .order("min_rent", { ascending: true });

        if (bands) {
          for (const band of bands) {
            const min = Number(band.min_rent);
            const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
            if (mr >= min && mr <= max) { matchedBand = band; break; }
          }
        }
      }

      if (matchedBand) {
        // Component-based: split into individual fee types
        const regFee = Number(matchedBand.register_fee ?? 0);
        const filFee = Number(matchedBand.filing_fee ?? 0);
        const agrFee = Number(matchedBand.agreement_fee ?? 0);
        totalAmount = regFee + filFee + agrFee;

        if (totalAmount <= 0) {
          return new Response(JSON.stringify({ skipped: true, message: "Add tenant fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const feeComponents: { type: string; amount: number; allocations?: SplitItem[] }[] = [];
        if (regFee > 0) feeComponents.push({ type: "register_tenant_fee", amount: regFee });
        if (filFee > 0) feeComponents.push({ type: "filing_fee", amount: filFee });
        if (agrFee > 0) feeComponents.push({ type: "agreement_sale", amount: agrFee });

        splitPlan = [];
        for (const fc of feeComponents) {
          const alloc = await loadAllocation(supabaseAdmin, fc.type, fc.amount, matchedBand.id);
          fc.allocations = alloc;
          splitPlan.push(...alloc.map(a => ({ ...a, description: `${a.description || a.recipient} (${fc.type})` })));
        }

        metadata = { bandId: matchedBand.id, fee_components: feeComponents };
      } else {
        // Fallback: use old flat fee approach
        const fee = await determineFee(supabaseAdmin, "add_tenant_fee", mr);
        if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Add tenant fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        totalAmount = fee.amount;
        splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      }

      description = `Add Tenant Fee (GH₵ ${totalAmount})`;
      reference = `addten_${userId}_${Date.now()}`;
      callbackPath = "/landlord/add-tenant?status=fee_paid";

    } else if (type === "termination_fee") {
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "termination";

      const fee = await determineFee(supabaseAdmin, "termination_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Termination fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Termination Request Fee (GH₵ ${fee.amount})`;
      reference = `term_${userId}_${Date.now()}`;
      callbackPath = "/tenant/termination?status=fee_paid";

    } else if (type === "renewal_payment") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy, error: tErr } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, registration_code, proposed_rent, agreed_rent, renewal_duration_months, advance_months, unit_id")
        .eq("id", tenancyId)
        .single();

      if (tErr || !tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const { data: unit } = await supabaseAdmin.from("units").select("property_id").eq("id", (tenancy as any).unit_id).single();
      if (unit) officeId = await resolveOffice(supabaseAdmin, { propertyId: unit.property_id });
      caseType = "renewal";

      const rent = Number((tenancy as any).proposed_rent ?? (tenancy as any).agreed_rent);
      const advanceMonths = Math.min((tenancy as any).advance_months ?? 6, 6);

      totalAmount = rent * advanceMonths * 0.08;
      splitPlan = await getTaxSplitPlan(supabaseAdmin, totalAmount, `Renewal tax (${advanceMonths} months)`);
      description = `Renewal tax (${advanceMonths} months advance) - ${(tenancy as any).registration_code}`;
      reference = `renew_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/renewal?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "archive_search_fee") {
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "archive_search";

      const fee = await determineFee(supabaseAdmin, "archive_search_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Archive search fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `Archive Search Fee (GH₵ ${fee.amount})`;
      reference = `archsearch_${userId}_${Date.now()}`;
      callbackPath = "/landlord/applications?status=success";

    } else if (type === "existing_tenancy_bundle") {
      // Composite fee for Declare Existing Tenancy: register_tenant_fee + filing_fee + optional agreement_sale
      const { monthlyRent: bodyMonthlyRent, propertyId: bodyPropertyId, agreementChoice: bodyAgreementChoice } = body;
      if (!bodyMonthlyRent || Number(bodyMonthlyRent) <= 0) throw new Error("Monthly rent is required");

      if (bodyPropertyId) {
        officeId = await resolveOffice(supabaseAdmin, { propertyId: bodyPropertyId });
        relatedPropertyId = bodyPropertyId;
      } else {
        officeId = await resolveOffice(supabaseAdmin, { userId });
      }
      caseType = "tenancy";

      // Look up existing_tenancy band
      const mr = Number(bodyMonthlyRent);
      const { data: bands } = await supabaseAdmin
        .from("rent_bands")
        .select("id, min_rent, max_rent, register_fee, filing_fee, agreement_fee")
        .eq("band_type", "existing_tenancy")
        .order("min_rent", { ascending: true });

      let matchedBand: any = null;
      if (bands) {
        for (const band of bands) {
          const min = Number(band.min_rent);
          const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
          if (mr >= min && mr <= max) { matchedBand = band; break; }
        }
      }
      if (!matchedBand) throw new Error(`No existing tenancy rent band configured for monthly rent of GH₵ ${mr}`);

      const regFee = Number(matchedBand.register_fee ?? 0);
      const filFee = Number(matchedBand.filing_fee ?? 0);
      const agrFee = bodyAgreementChoice === "buy" ? Number(matchedBand.agreement_fee ?? 0) : 0;
      totalAmount = regFee + filFee + agrFee;

      if (totalAmount <= 0) {
        return new Response(JSON.stringify({ skipped: true, message: "Existing tenancy fees are currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Build split plan from each fee's band allocations
      const feeComponents: { type: string; amount: number; allocations?: SplitItem[] }[] = [];
      if (regFee > 0) feeComponents.push({ type: "register_tenant_fee", amount: regFee });
      if (filFee > 0) feeComponents.push({ type: "filing_fee", amount: filFee });
      if (agrFee > 0) feeComponents.push({ type: "agreement_sale", amount: agrFee });

      splitPlan = [];
      for (const fc of feeComponents) {
        if (fc.amount <= 0) continue;
        const alloc = await loadAllocation(supabaseAdmin, fc.type, fc.amount, matchedBand.id);
        fc.allocations = alloc;
        splitPlan.push(...alloc.map(a => ({ ...a, description: `${a.description || a.recipient} (${fc.type})` })));
      }

      description = `Existing Tenancy Registration (GH₵ ${totalAmount})`;
      reference = `extbundle_${userId}_${Date.now()}`;
      callbackPath = body.callbackPath || "/landlord/declare-existing-tenancy?status=fee_paid";
      metadata = { agreementChoice: bodyAgreementChoice, bandId: matchedBand.id, fee_components: feeComponents };

    } else {
      throw new Error("Invalid payment type");
    }

    // Create a Case record
    const { caseId, caseNumber } = await createCase(supabaseAdmin, {
      officeId,
      userId,
      caseType,
      relatedPropertyId: relatedPropertyId || undefined,
      relatedTenancyId: relatedTenancyId || undefined,
      relatedComplaintId: relatedComplaintId || undefined,
      metadata: { payment_type: type, description },
    });

    // Create escrow transaction record with office_id and case_id
    const { error: escrowErr } = await supabaseAdmin
      .from("escrow_transactions")
      .insert({
        user_id: userId,
        payment_type: type,
        reference,
        total_amount: totalAmount,
        status: "pending",
        related_tenancy_id: relatedTenancyId,
        related_complaint_id: relatedComplaintId,
        related_property_id: relatedPropertyId,
        office_id: officeId,
        case_id: caseId || null,
        metadata: { ...metadata, split_plan: splitPlan, description, case_number: caseNumber, office_id: officeId },
      });

    if (escrowErr) console.error("Escrow record creation error:", escrowErr.message);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const origin = req.headers.get("origin") || "https://www.rentcontrolghana.com";
    const callbackUrl = `${origin}${callbackPath}`;
    const amountInPesewas = Math.round(totalAmount * 100);

    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !e.endsWith(".local");
    const paystackEmail =
      (profile?.email && isValidEmail(profile.email)) ? profile.email
      : (authUser.email && isValidEmail(authUser.email)) ? authUser.email
      : `user-${userId.slice(0, 8)}@rentcontrolghana.com`;

    const payload: any = {
      email: paystackEmail,
      amount: amountInPesewas,
      currency: "GHS",
      reference,
      callback_url: callbackUrl,
      metadata: {
        type,
        userId,
        caseId,
        caseNumber,
        officeId,
        custom_fields: [
          { display_name: "Description", variable_name: "description", value: description },
          { display_name: "Customer", variable_name: "customer_name", value: profile?.full_name || "Customer" },
          { display_name: "Case", variable_name: "case_number", value: caseNumber },
          { display_name: "Office", variable_name: "office", value: officeId },
        ],
      },
    };

    console.log("Paystack init payload:", JSON.stringify(payload));

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("Paystack response:", JSON.stringify(result));

    if (!response.ok || !result.status) {
      throw new Error(result.message || `Paystack error (HTTP ${response.status})`);
    }

    return new Response(JSON.stringify({
      authorization_url: result.data.authorization_url,
      access_code: result.data.access_code,
      reference: result.data.reference,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Checkout error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

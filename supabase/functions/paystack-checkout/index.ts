import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PUBLIC_URL, ROOT_DOMAIN } from "../_shared/project-domain.ts";
import { detectPayerSegment, isGraTaxEnabled, resolveServiceFee } from "../_shared/service-fee.ts";

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
  student_registration: "student_registration",
  student_complaint_fee: "student_complaint_fee",
  rentcare_assistance: "rentcare_application_fee",
};

// Student-only payment types — fully isolated from office/HQ routing & escrow.
const STUDENT_PAYMENT_TYPES = new Set(["student_registration", "student_complaint_fee", "rentcare_application_fee", "student_safety_report_fee"]);

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

    // GRA Tax kill-switch — server-side source of truth. When off, single-month
    // tax payments are rejected; rent_combined and rent_tax_bulk fall through
    // and collapse to plain rent flowing to the landlord.
    const graTaxOn = await isGraTaxEnabled(supabaseAdmin);
    if (!graTaxOn && type === "rent_tax") {
      return new Response(
        JSON.stringify({ ok: false, error: "GRA tax is currently disabled by the regulator." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
      const taxAmount = graTaxOn ? rent * taxRate : 0;
      totalAmount = rent + taxAmount;
      if (graTaxOn && taxAmount > 0) {
        const taxSplits = await getTaxSplitPlan(supabaseAdmin, taxAmount, `Rent tax (${taxRate * 100}%)`);
        splitPlan = [
          ...taxSplits,
          { recipient: "landlord", amount: rent, description: "Monthly rent (held in escrow)" },
        ];
      } else {
        splitPlan = [{ recipient: "landlord", amount: rent, description: "Monthly rent (held in escrow)" }];
      }
      description = graTaxOn ? `Rent + Tax combined - ${(tenancy as any).registration_code}` : `Monthly rent - ${(tenancy as any).registration_code}`;
      reference = `rentcombo_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "rent_card_bulk") {
      const { quantity: qty } = body;
      const cardQty = Math.min(Math.max(parseInt(qty) || 1, 1), 50);
      const fee = await determineFee(supabaseAdmin, "rent_card_fee");

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "rent_card";

      // NUGS rent-card revenue routing: if the buyer is a NUGS sub-admin,
      // reroute the office/admin share to the central NUGS settlement account
      // and flag the escrow row as NUGS revenue.
      const { data: nugsRow } = await supabaseAdmin
        .from("nugs_staff")
        .select("permissions")
        .eq("user_id", userId)
        .maybeSingle();
      const isNugsBuyer = !!nugsRow;
      if (isNugsBuyer) {
        const perms = (nugsRow?.permissions as any) || {};
        if (perms.rent_card !== true) {
          return new Response(JSON.stringify({ ok: false, error: "You do not have permission to purchase rent cards. Contact a Super Admin." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

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
      if (isNugsBuyer) {
        splitPlan = splitPlan.map(s => (
          (s.recipient === "office" || s.recipient === "admin")
            ? { ...s, recipient: "nugs", description: `${s.description || "Office share"} (NUGS)`, is_nugs_revenue: true } as any
            : s
        ));
      }
      description = `Rent Card Purchase (${cardQty} cards × GH₵ ${fee.amount})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";
      metadata = { quantity: cardQty };

    } else if (type === "rent_card") {
      const fee = await determineFee(supabaseAdmin, "rent_card_fee");
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "rent_card";

      // NUGS rent-card revenue routing (single-pair purchase)
      const { data: nugsRowSingle } = await supabaseAdmin
        .from("nugs_staff")
        .select("permissions")
        .eq("user_id", userId)
        .maybeSingle();
      const isNugsBuyerSingle = !!nugsRowSingle;
      if (isNugsBuyerSingle) {
        const perms = (nugsRowSingle?.permissions as any) || {};
        if (perms.rent_card !== true) {
          return new Response(JSON.stringify({ ok: false, error: "You do not have permission to purchase rent cards. Contact a Super Admin." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

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
      if (isNugsBuyerSingle) {
        splitPlan = splitPlan.map(s => (
          (s.recipient === "office" || s.recipient === "admin")
            ? { ...s, recipient: "nugs", description: `${s.description || "Office share"} (NUGS)`, is_nugs_revenue: true } as any
            : s
        ));
      }
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

    } else if (type === "tenant_registration" || type === "student_registration") {
      let { data: tenant } = await supabase
        .from("tenants")
        .select("id, registration_fee_paid, is_student")
        .eq("user_id", userId)
        .maybeSingle();

      // Defensive: auto-create tenant record if missing. Heals registrations where the
      // client-side tenants insert silently failed (e.g. RLS / session timing right after
      // signUp) but auth + profile succeeded — otherwise the user is stuck unable to pay
      // AND unable to re-register (phone already taken).
      if (!tenant) {
        const { data: genId, error: genErr } = await supabaseAdmin.rpc("generate_tenant_id");
        if (genErr || !genId) throw new Error("Failed to generate tenant ID: " + (genErr?.message ?? "unknown"));
        const { data: created, error: createErr } = await supabaseAdmin
          .from("tenants")
          .insert({ user_id: userId, tenant_id: String(genId), registration_fee_paid: false, is_student: type === "student_registration" })
          .select("id, registration_fee_paid, is_student")
          .single();
        if (createErr) throw new Error("Failed to create tenant record: " + createErr.message);
        tenant = created;
      }

      if (tenant.registration_fee_paid) throw new Error("Registration fee already paid");

      // Force student_registration type when tenant is flagged as a student.
      const effectiveType = (tenant as any).is_student ? "student_registration" : "tenant_registration";
      caseType = "registration";

      if (effectiveType === "student_registration") {
        // Student revenue: never tied to an office.
        officeId = "accra_central";
      } else {
        officeId = await resolveOffice(supabaseAdmin, { userId, region: profile?.delivery_region || undefined, area: profile?.delivery_area || undefined });
      }

      const feeKey = effectiveType === "student_registration" ? "student_registration" : "tenant_registration_fee";
      const fee = await determineFee(supabaseAdmin, feeKey);
      if (!fee.enabled || fee.amount === 0) {
        await supabaseAdmin.from("tenants").update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("user_id", userId);
        return new Response(JSON.stringify({ skipped: true, message: "Registration fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, fee.paymentType, fee.amount, fee.rentBandId);
      description = `${effectiveType === "student_registration" ? "Student" : "Tenant"} Registration Fee (GH₵ ${fee.amount})`;
      reference = `${effectiveType === "student_registration" ? "streg" : "treg"}_${userId}_${Date.now()}`;
      callbackPath = "/tenant/dashboard?status=success";
      // Mutate the outer `type` so escrow_transactions.payment_type matches the actual fee.
      (body as any).type = effectiveType;

    } else if (type === "landlord_registration") {
      let { data: landlord } = await supabase
        .from("landlords")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .maybeSingle();

      // Defensive: auto-create landlord record if missing but user has landlord role
      if (!landlord) {
        const { data: genId, error: genErr } = await supabaseAdmin.rpc("generate_landlord_id");
        if (genErr || !genId) throw new Error("Failed to generate landlord ID: " + (genErr?.message ?? "unknown"));
        const { data: created, error: createErr } = await supabaseAdmin
          .from("landlords")
          .insert({ user_id: userId, landlord_id: String(genId), registration_fee_paid: false })
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
        .select("id, status, payment_status, tenant_user_id, complainant_user_id, complainant_role, region, office_id, outstanding_amount")
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
      const isLandlordComplainantOnTenantTable = !isLandlordComplaint && complaint.complainant_role === "landlord";
      const ownerId = isLandlordComplaint
        ? complaint.landlord_user_id
        : (isLandlordComplainantOnTenantTable
            ? complaint.complainant_user_id
            : (complaint.tenant_user_id || complaint.complainant_user_id));
      if (ownerId !== userId) throw new Error("Unauthorized");

      if (complaint.payment_status !== "pending" || complaint.status !== "pending_payment") {
        throw new Error("This complaint is not awaiting payment");
      }
      const serverAmount = Number(complaint.outstanding_amount || 0);
      if (!Number.isFinite(serverAmount) || serverAmount <= 0) {
        throw new Error("No payment amount has been set by the admin yet");
      }

      // Detect if filer is a student — switch to student_complaint_fee for isolated revenue
      let isStudentComplaint = false;
      if (!isLandlordComplaint && !isLandlordComplainantOnTenantTable) {
        const { data: filerTenant } = await supabaseAdmin
          .from("tenants")
          .select("is_student")
          .eq("user_id", ownerId)
          .maybeSingle();
        isStudentComplaint = !!filerTenant?.is_student;
      }

      if (isStudentComplaint) {
        officeId = "accra_central"; // student revenue not tied to office
      } else {
        officeId = complaint.office_id || await resolveOffice(supabaseAdmin, { region: complaint.region });
      }
      caseType = "complaint";
      relatedComplaintId = complaintId;

      // Trusted server-side amount; ignore any client-supplied figure
      totalAmount = serverAmount;

      if (isStudentComplaint) {
        // Student complaints use the dedicated 4-way flat split (IGF / NUGS / Platform / CM)
        // proportionally scaled to the actual outstanding amount.
        splitPlan = await loadAllocation(supabaseAdmin, "student_complaint_fee", totalAmount, null);
        description = `Student Complaint Filing Fee (GH₵ ${totalAmount.toFixed(2)})`;
        reference = `streetcomp_${complaintId}_${Date.now()}`;
        callbackPath = "/nugs/my-complaints?status=success";
        metadata = { ...metadata, complaintId, isStudentComplaint: true };
        (body as any).type = "student_complaint_fee";
      } else {
        // Try basket-driven per-item split plan first; fall back to legacy single allocation.
        const { data: basketRows } = await supabaseAdmin
          .from("complaint_basket_items")
          .select("id, kind, label, amount, igf_pct, admin_pct, platform_pct, is_nugs_revenue, fee_scope")
          .eq("complaint_id", complaintId)
          .eq("complaint_table", isLandlordComplaint ? "landlord_complaints" : "complaints")
          .order("created_at");

        if (Array.isArray(basketRows) && basketRows.length > 0) {
          const basketSum = basketRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
          if (Math.abs(basketSum - serverAmount) > 0.01) {
            throw new Error(`Basket total (GH₵ ${basketSum.toFixed(2)}) does not match the outstanding amount (GH₵ ${serverAmount.toFixed(2)})`);
          }
          const perItemSplits: any[] = [];
          for (const row of basketRows) {
            const amt = Number(row.amount) || 0;
            const igf = +(amt * (Number(row.igf_pct) || 0) / 100).toFixed(2);
            const adm = +(amt * (Number(row.admin_pct) || 0) / 100).toFixed(2);
            const plat = +(amt * (Number(row.platform_pct) || 0) / 100).toFixed(2);
            // NUGS-tagged items: re-route the "admin" share to a central NUGS pool (no office split)
            const adminRecipient = row.is_nugs_revenue ? "nugs" : "admin";
            const adminLabel = row.is_nugs_revenue ? "NUGS" : "Admin";
            if (igf > 0) perItemSplits.push({ recipient: "rent_control", amount: igf, description: `${row.label} (IGF)`, complaint_basket_item_id: row.id });
            if (adm > 0) perItemSplits.push({ recipient: adminRecipient, amount: adm, description: `${row.label} (${adminLabel})`, complaint_basket_item_id: row.id, is_nugs_revenue: !!row.is_nugs_revenue });
            if (plat > 0) perItemSplits.push({ recipient: "platform", amount: plat, description: `${row.label} (Platform)`, complaint_basket_item_id: row.id });
          }
          splitPlan = perItemSplits;
        } else {
          splitPlan = await loadAllocation(supabaseAdmin, "complaint_fee", totalAmount, null);
        }

        description = `Complaint Filing Fee (GH₵ ${totalAmount.toFixed(2)})`;
        reference = `comp_${complaintId}_${Date.now()}`;
        callbackPath = (isLandlordComplaint || isLandlordComplainantOnTenantTable) ? "/landlord/complaints?status=success" : "/tenant/my-cases?status=success";
        metadata = { ...metadata, complaintId, isLandlordComplaint: isLandlordComplaint || isLandlordComplainantOnTenantTable, complainant_role: complaint.complainant_role || (isLandlordComplaint ? "landlord" : null), basket_items: (basketRows || []).map((r: any) => r.id) };
      }
    } else if (type === "admin_complaint_filing") {
      // Officer-initiated filing fee checkout from Admin Portal File Complaint review stage.
      // The officer authenticates and opens checkout on behalf of the named payer.
      const { complaintId, payerEmail, payerPhone, payerName, payerRole } = body;
      if (!complaintId) throw new Error("complaintId is required");

      // Authorize: caller must be staff (any admin row)
      const { data: staffRow } = await supabaseAdmin
        .from("admin_staff")
        .select("user_id, admin_type")
        .eq("user_id", userId)
        .maybeSingle();
      if (!staffRow) throw new Error("Only Rent Control staff may open this checkout");

      // Try tenant complaints first, then fall back to landlord_complaints
      let complaint: any = null;
      let complaintTable: "complaints" | "landlord_complaints" = "complaints";
      const { data: tComp } = await supabaseAdmin
        .from("complaints")
        .select("id, status, payment_status, filing_fee_paid, region, office_id, complainant_user_id, tenant_user_id, complainant_role")
        .eq("id", complaintId)
        .maybeSingle();
      if (tComp) {
        complaint = tComp;
        complaintTable = "complaints";
      } else {
        const { data: lComp } = await supabaseAdmin
          .from("landlord_complaints")
          .select("id, status, payment_status, filing_fee_paid, region, office_id, landlord_user_id, admin_filer_user_id, complainant_role")
          .eq("id", complaintId)
          .maybeSingle();
        if (lComp) {
          complaint = { ...lComp, complainant_user_id: lComp.landlord_user_id, complainant_role: lComp.complainant_role || "landlord" };
          complaintTable = "landlord_complaints";
        }
      }
      if (!complaint) throw new Error("Complaint not found");
      if (complaint.filing_fee_paid) throw new Error("Filing fee has already been paid for this complaint");

      const isLandlordComplaint = complaintTable === "landlord_complaints" || complaint.complainant_role === "landlord";

      const { data: basketRows } = await supabaseAdmin
        .from("complaint_basket_items")
        .select("id, kind, label, amount, igf_pct, admin_pct, platform_pct, is_nugs_revenue, fee_scope, paid_at")
        .eq("complaint_id", complaintId)
        .eq("complaint_table", complaintTable)
        .is("paid_at", null)
        .order("created_at");
      const unpaidRows = Array.isArray(basketRows) ? basketRows : [];
      if (unpaidRows.length === 0) {
        throw new Error("No unpaid basket items — set the fee type before opening checkout");
      }
      totalAmount = unpaidRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
      if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
        throw new Error("Basket total must be greater than zero");
      }

      officeId = complaint.office_id || await resolveOffice(supabaseAdmin, { region: complaint.region });
      caseType = "complaint";
      relatedComplaintId = complaintId;

      // Per-item splits (mirrors the complaint_fee branch)
      const perItemSplits: any[] = [];
      for (const row of unpaidRows) {
        const amt = Number(row.amount) || 0;
        const igf = +(amt * (Number(row.igf_pct) || 0) / 100).toFixed(2);
        const adm = +(amt * (Number(row.admin_pct) || 0) / 100).toFixed(2);
        const plat = +(amt * (Number(row.platform_pct) || 0) / 100).toFixed(2);
        const adminRecipient = row.is_nugs_revenue ? "nugs" : "admin";
        const adminLabel = row.is_nugs_revenue ? "NUGS" : "Admin";
        if (igf > 0) perItemSplits.push({ recipient: "rent_control", amount: igf, description: `${row.label} (IGF)`, complaint_basket_item_id: row.id });
        if (adm > 0) perItemSplits.push({ recipient: adminRecipient, amount: adm, description: `${row.label} (${adminLabel})`, complaint_basket_item_id: row.id, is_nugs_revenue: !!row.is_nugs_revenue });
        if (plat > 0) perItemSplits.push({ recipient: "platform", amount: plat, description: `${row.label} (Platform)`, complaint_basket_item_id: row.id });
      }
      splitPlan = perItemSplits;

      // Bring the complaint into the standard payment-pending state so finalize-payment treats it identically.
      await supabaseAdmin
        .from(complaintTable)
        .update({
          payment_status: "pending",
          outstanding_amount: totalAmount,
          basket_total: totalAmount,
          // keep status as draft_awaiting_filing_payment until finalize flips to ready_for_scheduling
        })
        .eq("id", complaintId);

      description = `Filing Fee — ${payerName || "Payer"} (GH₵ ${totalAmount.toFixed(2)})`;
      reference = `admincomp_${complaintId}_${Date.now()}`;
      callbackPath = `/regulator/complaints/${complaintId}?status=success`;
      metadata = {
        ...metadata,
        complaintId,
        complaint_table: complaintTable,
        filed_by_admin: true,
        admin_user_id: userId,
        payer_name: payerName || null,
        payer_phone: payerPhone || null,
        payer_email: payerEmail || null,
        payer_role: payerRole || complaint.complainant_role || null,
        complainant_role: complaint.complainant_role || payerRole || null,
        isLandlordComplaint,
        basket_items: unpaidRows.map((r: any) => r.id),
      };

      // Route finalize-payment through the standard complaint_fee path
      (body as any).type = "complaint_fee";

      // If a payer email was provided, use it so the Paystack receipt goes to them
      const isValidEmailFn = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !e.endsWith(".local");
      if (payerEmail && isValidEmailFn(payerEmail) && profile) {
        (profile as any).email = payerEmail;
      }
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
      // Band-based fee: uses rent bands per unit.
      // Preferred: items[] = [{ monthlyRent, unitId? }] — fees compound STRICTLY per unit (each unit's own band).
      // Legacy fallback: monthlyRent + quantity (used by single-unit entry points like accept-application).
      const { monthlyRent: bodyMonthlyRent, quantity: bodyQty, unitIds: bodyUnitIds, items: bodyItems } = body;

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "tenancy";

      // Build per-unit items list
      const items: { monthlyRent: number; unitId?: string }[] =
        Array.isArray(bodyItems) && bodyItems.length > 0
          ? bodyItems.map((it: any) => ({ monthlyRent: Number(it.monthlyRent) || 0, unitId: it.unitId }))
          : (bodyMonthlyRent && Number(bodyMonthlyRent) > 0
              ? Array.from({ length: Math.max(1, Number(bodyQty) || 1) }, () => ({ monthlyRent: Number(bodyMonthlyRent) }))
              : []);

      if (items.length === 0) throw new Error("At least one unit (monthlyRent) is required");
      if (items.some(it => it.monthlyRent <= 0)) throw new Error("Each unit must have a positive monthly rent");

      // Load all add_tenant bands once
      const { data: bands } = await supabaseAdmin
        .from("rent_bands")
        .select("id, min_rent, max_rent, register_fee, filing_fee, agreement_fee, fee_amount")
        .eq("band_type", "add_tenant")
        .order("min_rent", { ascending: true });

      const matchBand = (mr: number) => {
        if (!bands) return null;
        for (const band of bands as any[]) {
          const min = Number(band.min_rent);
          const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
          if (mr >= min && mr <= max) return band;
        }
        return null;
      };

      // Aggregate per-unit fees → component totals
      let totalReg = 0, totalFil = 0, totalAgr = 0, totalFlat = 0;
      let firstBandId: string | null = null;
      const itemBreakdown: any[] = [];
      let allBandsHaveComponents = true;

      for (const it of items) {
        const band = matchBand(it.monthlyRent);
        if (!band) {
          // No band match → fall back to flat fee for this unit
          const fee = await determineFee(supabaseAdmin, "add_tenant_fee", it.monthlyRent);
          if (!fee.enabled) continue;
          totalFlat += Number(fee.amount);
          itemBreakdown.push({ monthlyRent: it.monthlyRent, unitId: it.unitId, flat_fee: Number(fee.amount), bandId: null });
          allBandsHaveComponents = false;
          continue;
        }
        if (!firstBandId) firstBandId = band.id;
        const r = Number(band.register_fee ?? 0);
        const f = Number(band.filing_fee ?? 0);
        const a = Number(band.agreement_fee ?? 0);
        const flat = Number(band.fee_amount ?? 0);
        if (r === 0 && f === 0 && a === 0 && flat > 0) {
          // Band only has fee_amount, no components
          totalFlat += flat;
          itemBreakdown.push({ monthlyRent: it.monthlyRent, unitId: it.unitId, flat_fee: flat, bandId: band.id });
          allBandsHaveComponents = false;
        } else {
          totalReg += r;
          totalFil += f;
          totalAgr += a;
          itemBreakdown.push({ monthlyRent: it.monthlyRent, unitId: it.unitId, bandId: band.id, register_fee: r, filing_fee: f, agreement_fee: a });
        }
      }

      totalReg = Math.round(totalReg * 100) / 100;
      totalFil = Math.round(totalFil * 100) / 100;
      totalAgr = Math.round(totalAgr * 100) / 100;
      totalFlat = Math.round(totalFlat * 100) / 100;
      totalAmount = Math.round((totalReg + totalFil + totalAgr + totalFlat) * 100) / 100;

      if (totalAmount <= 0) {
        return new Response(JSON.stringify({ skipped: true, message: "Add tenant fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const feeComponents: { type: string; amount: number; allocations?: SplitItem[] }[] = [];
      if (totalReg > 0) feeComponents.push({ type: "register_tenant_fee", amount: totalReg });
      if (totalFil > 0) feeComponents.push({ type: "filing_fee", amount: totalFil });
      if (totalAgr > 0) feeComponents.push({ type: "agreement_sale", amount: totalAgr });

      splitPlan = [];
      for (const fc of feeComponents) {
        if (fc.amount <= 0) continue;
        const alloc = await loadAllocation(supabaseAdmin, fc.type, fc.amount, firstBandId);
        fc.allocations = alloc;
        splitPlan.push(...alloc.map(a => ({ ...a, description: `${a.description || a.recipient} (${fc.type})` })));
      }

      // Add flat-fee splits if any band lacked components
      if (totalFlat > 0) {
        const flatAlloc = await loadAllocation(supabaseAdmin, "add_tenant_fee", totalFlat, firstBandId);
        splitPlan.push(...flatAlloc.map(a => ({ ...a, description: `${a.description || a.recipient} (add_tenant_fee)` })));
      }

      metadata = {
        items: itemBreakdown,
        fee_components: feeComponents,
        quantity: items.length,
        unitIds: bodyUnitIds || items.map(it => it.unitId).filter(Boolean),
      };

      description = `Add Tenant Fee (${items.length} unit${items.length > 1 ? "s" : ""} — GH₵ ${totalAmount})`;
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
      // Supports either a single tenancy (monthlyRent + agreementChoice) or a batch (items[] of { monthlyRent, agreementChoice }).
      const { monthlyRent: bodyMonthlyRent, propertyId: bodyPropertyId, agreementChoice: bodyAgreementChoice, items: bodyItems } = body;

      const items: { monthlyRent: number; agreementChoice: string }[] =
        Array.isArray(bodyItems) && bodyItems.length > 0
          ? bodyItems.map((it: any) => ({ monthlyRent: Number(it.monthlyRent) || 0, agreementChoice: it.agreementChoice || "upload" }))
          : (bodyMonthlyRent && Number(bodyMonthlyRent) > 0
              ? [{ monthlyRent: Number(bodyMonthlyRent), agreementChoice: bodyAgreementChoice || "upload" }]
              : []);

      if (items.length === 0) throw new Error("Monthly rent is required");
      if (items.some(it => it.monthlyRent <= 0)) throw new Error("Each item must have a positive monthly rent");

      if (bodyPropertyId) {
        officeId = await resolveOffice(supabaseAdmin, { propertyId: bodyPropertyId });
        relatedPropertyId = bodyPropertyId;
      } else {
        officeId = await resolveOffice(supabaseAdmin, { userId });
      }
      caseType = "tenancy";

      // Load all existing_tenancy bands once
      const { data: bands } = await supabaseAdmin
        .from("rent_bands")
        .select("id, min_rent, max_rent, register_fee, filing_fee, agreement_fee")
        .eq("band_type", "existing_tenancy")
        .order("min_rent", { ascending: true });

      const matchBand = (mr: number) => {
        if (!bands) return null;
        for (const band of bands as any[]) {
          const min = Number(band.min_rent);
          const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
          if (mr >= min && mr <= max) return band;
        }
        return null;
      };

      // Aggregate component totals across all items
      let totalReg = 0, totalFil = 0, totalAgr = 0;
      let firstBandId: string | null = null;
      const itemBreakdown: any[] = [];

      for (const it of items) {
        const band = matchBand(it.monthlyRent);
        if (!band) throw new Error(`No existing tenancy rent band configured for monthly rent of GH₵ ${it.monthlyRent}`);
        if (!firstBandId) firstBandId = band.id;
        const r = Number(band.register_fee ?? 0);
        const f = Number(band.filing_fee ?? 0);
        const a = it.agreementChoice === "buy" ? Number(band.agreement_fee ?? 0) : 0;
        totalReg += r;
        totalFil += f;
        totalAgr += a;
        itemBreakdown.push({ monthlyRent: it.monthlyRent, agreementChoice: it.agreementChoice, bandId: band.id, register_fee: r, filing_fee: f, agreement_fee: a });
      }

      totalReg = Math.round(totalReg * 100) / 100;
      totalFil = Math.round(totalFil * 100) / 100;
      totalAgr = Math.round(totalAgr * 100) / 100;
      totalAmount = totalReg + totalFil + totalAgr;

      if (totalAmount <= 0) {
        return new Response(JSON.stringify({ skipped: true, message: "Existing tenancy fees are currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const feeComponents: { type: string; amount: number; allocations?: SplitItem[] }[] = [];
      if (totalReg > 0) feeComponents.push({ type: "register_tenant_fee", amount: totalReg });
      if (totalFil > 0) feeComponents.push({ type: "filing_fee", amount: totalFil });
      if (totalAgr > 0) feeComponents.push({ type: "agreement_sale", amount: totalAgr });

      splitPlan = [];
      for (const fc of feeComponents) {
        if (fc.amount <= 0) continue;
        const alloc = await loadAllocation(supabaseAdmin, fc.type, fc.amount, firstBandId);
        fc.allocations = alloc;
        splitPlan.push(...alloc.map(a => ({ ...a, description: `${a.description || a.recipient} (${fc.type})` })));
      }

      description = `Existing Tenancy Registration (${items.length} unit${items.length > 1 ? "s" : ""} — GH₵ ${totalAmount})`;
      reference = `extbundle_${userId}_${Date.now()}`;
      callbackPath = body.callbackPath || "/landlord/declare-existing-tenancy?status=fee_paid";
      metadata = { items: itemBreakdown, fee_components: feeComponents, quantity: items.length };

    } else if (type === "student_complaint_draft") {
      // Payment-first model for student complaints — the actual complaint row
      // is materialized in finalize-payment after Paystack confirms success.
      const { draftId } = body;
      if (!draftId) throw new Error("draftId is required");

      const { data: draft, error: dErr } = await supabaseAdmin
        .from("pending_complaint_drafts")
        .select("id, tenant_user_id, payload, status")
        .eq("id", draftId)
        .maybeSingle();
      if (dErr || !draft) throw new Error("Complaint draft not found");
      if (draft.tenant_user_id !== userId) throw new Error("Unauthorized");
      if (draft.status !== "pending_payment") throw new Error("This complaint draft is no longer awaiting payment");

      // Server-side fee determination — never trust client
      const fee = await determineFee(supabaseAdmin, "student_complaint_fee");
      if (!fee.enabled || fee.amount <= 0) {
        throw new Error("Student complaint fee is not currently configured. Please contact support.");
      }

      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, "student_complaint_fee", totalAmount, null);
      description = `Student Complaint Filing Fee (GH₵ ${totalAmount.toFixed(2)})`;
      reference = `studcompdraft_${draftId}_${Date.now()}`;
      callbackPath = "/nugs/my-complaints?status=success";
      caseType = "complaint";
      officeId = "accra_central"; // student revenue is office-agnostic
      metadata = { ...metadata, draft_id: draftId, isStudentComplaintDraft: true };
      (body as any).type = "student_complaint_fee"; // routes finalize through student logic

      // Persist amount + reference on the draft for traceability
      await supabaseAdmin
        .from("pending_complaint_drafts")
        .update({ amount: totalAmount, reference })
        .eq("id", draftId);

    } else if (type === "rentcare_application_fee") {
      const { applicationId } = body;
      if (!applicationId) throw new Error("applicationId is required");

      const { data: app, error: appErr } = await supabaseAdmin
        .from("rentcare_applications")
        .select("id, applicant_user_id, status, payment_status, payment_reference")
        .eq("id", applicationId)
        .maybeSingle();
      if (appErr || !app) throw new Error("RentCare application not found");
      if (app.applicant_user_id !== userId) throw new Error("Unauthorized");
      if (app.payment_status === "paid" || app.payment_status === "reconciled") {
        throw new Error("This application has already been paid for");
      }

      const fee = await determineFee(supabaseAdmin, "rentcare_assistance");
      if (!fee.enabled || fee.amount <= 0) {
        throw new Error("RentCare application fee is not currently configured.");
      }

      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, "rentcare_application_fee", totalAmount, null);
      description = `RentCare Assistance Application Fee (GH₵ ${totalAmount.toFixed(2)})`;
      reference = `rentcare_${applicationId}_${Date.now()}`;
      callbackPath = `/nugs/rentcare?status=success&app=${applicationId}`;
      caseType = "rentcare";
      officeId = "accra_central"; // student revenue is office-agnostic
      metadata = { ...metadata, application_id: applicationId, isRentCare: true };

      await supabaseAdmin
        .from("rentcare_applications")
        .update({
          payment_status: "pending",
          payment_reference: reference,
          fee_amount_snapshot: totalAmount,
          status: "awaiting_application_fee_payment",
        })
        .eq("id", applicationId);

    } else if (type === "safety_report_draft" || type === "student_safety_report_draft") {
      // Payment-first model for Safety Reports — the actual safety_reports row
      // is materialized in finalize-payment after Paystack confirms success.
      // Emergency Panic alerts do NOT go through this path (they remain free).
      const { draftId } = body;
      if (!draftId) throw new Error("draftId is required");

      const { data: draft, error: dErr } = await supabaseAdmin
        .from("pending_safety_report_drafts")
        .select("id, user_id, user_role, payload, status")
        .eq("id", draftId)
        .maybeSingle();
      if (dErr || !draft) throw new Error("Safety report draft not found");
      if (draft.user_id !== userId) throw new Error("Unauthorized");
      if (draft.status !== "pending_payment") throw new Error("This safety report draft is no longer awaiting payment");

      const isStudent = type === "student_safety_report_draft" || draft.user_role === "student";
      const feeKey = isStudent ? "student_safety_report_fee" : "safety_report_fee";

      const fee = await determineFee(supabaseAdmin, feeKey);
      if (!fee.enabled || fee.amount <= 0) {
        throw new Error("Safety Report fee is not currently configured. Please contact support.");
      }

      totalAmount = fee.amount;
      splitPlan = await loadAllocation(supabaseAdmin, feeKey, totalAmount, null);
      description = `${isStudent ? "Student " : ""}Safety Report Fee (GH₵ ${totalAmount.toFixed(2)})`;
      reference = `safetydraft_${draftId}_${Date.now()}`;
      callbackPath = body.callbackPath || (isStudent ? "/nugs/dashboard?status=safety_paid" : `/${draft.user_role}/dashboard?status=safety_paid`);
      caseType = "safety_report";
      if (isStudent) officeId = "accra_central";
      metadata = { ...metadata, draft_id: draftId, isSafetyReportDraft: true, safety_role: draft.user_role };
      (body as any).type = feeKey; // routes finalize through correct revenue logic

      await supabaseAdmin
        .from("pending_safety_report_drafts")
        .update({ amount: totalAmount, reference })
        .eq("id", draftId);

    } else {
      throw new Error("Invalid payment type");
    }

    // ─── SERVICE FEE ENGINE ───
    // Per-payment-type, percentage-based, admin-controlled. Fee is additive
    // (never subtracted from rent). Splits land in escrow_splits with
    // is_service_fee=true so receipts can exclude them.
    const baseAmount = totalAmount;
    const effectivePaymentTypeForFee = (body as any).type || type;
    const payerSegment = await detectPayerSegment(supabaseAdmin, userId, effectivePaymentTypeForFee);
    const serviceFee = await resolveServiceFee(
      supabaseAdmin,
      effectivePaymentTypeForFee,
      baseAmount,
      payerSegment,
    );
    if (serviceFee.enabled && serviceFee.fee > 0) {
      totalAmount = Math.round((baseAmount + serviceFee.fee) * 100) / 100;
      splitPlan = [...splitPlan, ...serviceFee.splits];
      metadata = {
        ...metadata,
        service_fee: {
          amount: serviceFee.fee,
          percentage: serviceFee.percentage,
          segment: serviceFee.segment,
          base_amount: baseAmount,
        },
      };
    }

    // Quote mode — return the breakdown without initializing a Paystack transaction.
    // Used by the checkout confirmation dialog to show the payer what they'll be charged.
    if (body?.quote === true) {
      return new Response(JSON.stringify({
        ok: true,
        quote: true,
        breakdown: {
          base_amount: baseAmount,
          service_fee: serviceFee.fee,
          service_fee_percentage: serviceFee.percentage,
          service_fee_enabled: serviceFee.enabled,
          payer_segment: serviceFee.segment,
          total: totalAmount,
          description,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
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

    // Re-read type from body so it reflects any in-flight remap (e.g. tenant→student)
    const effectivePaymentType = (body as any).type || type;
    const isStudentRevenue = STUDENT_PAYMENT_TYPES.has(effectivePaymentType);

    // Create escrow transaction record with office_id and case_id
    const { error: escrowErr } = await supabaseAdmin
      .from("escrow_transactions")
      .insert({
        user_id: userId,
        payment_type: effectivePaymentType,
        reference,
        total_amount: totalAmount,
        status: "pending",
        related_tenancy_id: relatedTenancyId,
        related_complaint_id: relatedComplaintId,
        related_property_id: relatedPropertyId,
        office_id: isStudentRevenue ? null : officeId,
        case_id: caseId || null,
        is_student_revenue: isStudentRevenue,
        sales_channel_id: (body as any).sales_channel_id || null,
        metadata: { ...metadata, split_plan: splitPlan, description, case_number: caseNumber, office_id: isStudentRevenue ? null : officeId, is_student_revenue: isStudentRevenue, sales_channel_id: (body as any).sales_channel_id || null },
      });

    if (escrowErr) console.error("Escrow record creation error:", escrowErr.message);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const origin = req.headers.get("origin") || PUBLIC_URL;
    const callbackUrl = `${origin}${callbackPath}`;
    const amountInPesewas = Math.round(totalAmount * 100);

    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) && !e.endsWith(".local");
    const paystackEmail =
      (profile?.email && isValidEmail(profile.email)) ? profile.email
      : (authUser.email && isValidEmail(authUser.email)) ? authUser.email
      : `user-${userId.slice(0, 8)}@${ROOT_DOMAIN}`;

    const payload: any = {
      email: paystackEmail,
      amount: amountInPesewas,
      currency: "GHS",
      reference,
      callback_url: callbackUrl,
      metadata: {
        type: effectivePaymentType,
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
      ok: true,
      authorization_url: result.data.authorization_url,
      access_code: result.data.access_code,
      reference: result.data.reference,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Checkout error:", error.message);
    // Return as 200 with { ok:false, error } so the Supabase JS client doesn't
    // mask the real message with the generic "non-2xx status code" error.
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

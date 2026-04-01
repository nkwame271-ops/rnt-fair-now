import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLATFORM_FIXED_FEE = 10; // GHS — always isolated first from registration payments

// Default fee structure & split rules (used as fallback if DB lookup fails)
const DEFAULT_SPLIT_RULES: Record<string, { total: number; splits: { recipient: string; amount: number; description: string }[] }> = {
  tenant_registration: {
    total: 40,
    splits: [
      { recipient: "platform", amount: 10, description: "Platform fixed fee" },
      { recipient: "rent_control", amount: 19.5, description: "IGF - Rent Control" },
      { recipient: "admin", amount: 7.5, description: "Admin fee" },
      { recipient: "platform", amount: 3, description: "Platform share" },
    ],
  },
  landlord_registration: {
    total: 30,
    splits: [
      { recipient: "platform", amount: 10, description: "Platform fixed fee" },
      { recipient: "rent_control", amount: 13, description: "IGF - Rent Control" },
      { recipient: "admin", amount: 5, description: "Admin fee" },
      { recipient: "platform", amount: 2, description: "Platform share" },
    ],
  },
  rent_card: {
    total: 25,
    splits: [
      { recipient: "rent_control", amount: 15, description: "Rent Control - Rent Card" },
      { recipient: "admin", amount: 10, description: "Admin - Rent Card" },
    ],
  },
  agreement_sale: {
    total: 30,
    splits: [
      { recipient: "rent_control", amount: 10, description: "Rent Control - Agreement" },
      { recipient: "admin", amount: 20, description: "Admin - Agreement" },
    ],
  },
  complaint_fee: {
    total: 2,
    splits: [
      { recipient: "rent_control", amount: 1.00, description: "IGF - Complaint" },
      { recipient: "admin", amount: 0.60, description: "Admin - Complaint" },
      { recipient: "platform", amount: 0.40, description: "Platform - Complaint" },
    ],
  },
  listing_fee: {
    total: 2,
    splits: [
      { recipient: "rent_control", amount: 1.00, description: "IGF - Listing" },
      { recipient: "admin", amount: 0.60, description: "Admin - Listing" },
      { recipient: "platform", amount: 0.40, description: "Platform - Listing" },
    ],
  },
  viewing_fee: {
    total: 2,
    splits: [
      { recipient: "rent_control", amount: 1.00, description: "IGF - Viewing" },
      { recipient: "admin", amount: 0.60, description: "Admin - Viewing" },
      { recipient: "platform", amount: 0.40, description: "Platform - Viewing" },
    ],
  },
  add_tenant_fee: {
    total: 5,
    splits: [
      { recipient: "rent_control", amount: 2.50, description: "IGF - Add Tenant" },
      { recipient: "admin", amount: 1.50, description: "Admin - Add Tenant" },
      { recipient: "platform", amount: 1.00, description: "Platform - Add Tenant" },
    ],
  },
  termination_fee: {
    total: 5,
    splits: [
      { recipient: "rent_control", amount: 2.50, description: "IGF - Termination" },
      { recipient: "admin", amount: 1.50, description: "Admin - Termination" },
      { recipient: "platform", amount: 1.00, description: "Platform - Termination" },
    ],
  },
  archive_search_fee: {
    total: 20,
    splits: [
      { recipient: "rent_control", amount: 12, description: "Rent Control - Archive Search" },
      { recipient: "admin", amount: 8, description: "Admin - Archive Search" },
    ],
  },
};

// Calculate registration splits with platform fee isolation
const calculateRegistrationSplits = (totalAmount: number, _feeKey: string): { recipient: string; amount: number; description: string }[] => {
  const platformFee = Math.min(PLATFORM_FIXED_FEE, totalAmount);
  const remainder = totalAmount - platformFee;
  if (remainder <= 0) {
    return [{ recipient: "platform", amount: platformFee, description: "Platform fixed fee" }];
  }
  // Split remainder: 65% IGF, 25% admin, 10% platform
  const igf = Math.round(remainder * 0.65 * 100) / 100;
  const admin = Math.round(remainder * 0.25 * 100) / 100;
  const platformShare = Math.round((remainder - igf - admin) * 100) / 100;
  return [
    { recipient: "platform", amount: platformFee, description: "Platform fixed fee" },
    { recipient: "rent_control", amount: igf, description: "IGF - Rent Control" },
    { recipient: "admin", amount: admin, description: "Admin fee" },
    { recipient: "platform", amount: platformShare, description: "Platform share" },
  ];
};

// Fetch split configuration from DB, falling back to hardcoded defaults
const getSplitConfigFromDB = async (supabaseAdmin: any, paymentType: string): Promise<{ recipient: string; amount: number; description: string; is_platform_fee: boolean }[] | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("split_configurations")
      .select("recipient, amount, description, is_platform_fee, amount_type")
      .eq("payment_type", paymentType)
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return null;
    return data.map((s: any) => ({
      recipient: s.recipient,
      amount: Number(s.amount),
      description: s.description || "",
      is_platform_fee: s.is_platform_fee || false,
    }));
  } catch {
    return null;
  }
};

// Fetch rent band fee based on monthly rent
const getRentBandFee = async (supabaseAdmin: any, monthlyRent: number): Promise<number | null> => {
  try {
    const { data, error } = await supabaseAdmin
      .from("rent_bands")
      .select("fee_amount")
      .lte("min_rent", monthlyRent)
      .order("min_rent", { ascending: false })
      .limit(10);
    if (error || !data || data.length === 0) return null;
    // Find the band where monthlyRent >= min_rent and (max_rent is null OR monthlyRent <= max_rent)
    // Since we ordered by min_rent desc, the first match with valid max_rent wins
    // But we need the full data. Let's re-query properly.
    const { data: bands } = await supabaseAdmin
      .from("rent_bands")
      .select("min_rent, max_rent, fee_amount")
      .order("min_rent", { ascending: true });
    if (!bands) return null;
    for (const band of bands) {
      const min = Number(band.min_rent);
      const max = band.max_rent !== null ? Number(band.max_rent) : Infinity;
      if (monthlyRent >= min && monthlyRent <= max) {
        return Number(band.fee_amount);
      }
    }
    return null;
  } catch {
    return null;
  }
};

// Build tax splits from DB config (percentage-based)
const getTaxSplitPlan = async (supabaseAdmin: any, taxAmount: number, description: string): Promise<{ recipient: string; amount: number; description: string }[]> => {
  const dbSplits = await getSplitConfigFromDB(supabaseAdmin, "rent_tax");
  if (dbSplits && dbSplits.length > 0) {
    // These are percentage-based splits
    const totalPct = dbSplits.reduce((s, r) => s + r.amount, 0);
    if (totalPct > 0) {
      return dbSplits.map(s => ({
        recipient: s.recipient,
        amount: Math.round((taxAmount * s.amount / totalPct) * 100) / 100,
        description: s.description || description,
      }));
    }
  }
  // Fallback: all to rent_control
  return [{ recipient: "rent_control", amount: taxAmount, description }];
};

// Helper to get dynamic fee from DB, falling back to defaults
const getDynamicFee = async (supabaseAdmin: any, feeKey: string): Promise<{ total: number; enabled: boolean; splits: { recipient: string; amount: number; description: string }[] }> => {
  try {
    const { data } = await supabaseAdmin
      .from("feature_flags")
      .select("fee_amount, fee_enabled")
      .eq("feature_key", feeKey)
      .single();

    // Map fee key to payment type for split_configurations lookup
    const feeKeyToPaymentType: Record<string, string> = {
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

    const paymentType = feeKeyToPaymentType[feeKey] || feeKey;
    const isRegistration = feeKey === "tenant_registration_fee" || feeKey === "landlord_registration_fee";
    const defaultRule = DEFAULT_SPLIT_RULES[paymentType];

    // Try DB split configs first
    const dbSplits = await getSplitConfigFromDB(supabaseAdmin, paymentType);

    if (!data || data.fee_amount === null) {
      const total = defaultRule?.total ?? 0;
      if (dbSplits) {
        return { total, enabled: true, splits: dbSplits };
      }
      const splits = isRegistration
        ? calculateRegistrationSplits(total, feeKey)
        : (defaultRule?.splits ?? []);
      return { total, enabled: true, splits };
    }

    const total = data.fee_amount;

    // If DB split configs exist, scale them proportionally to the dynamic fee total
    if (dbSplits) {
      const dbTotal = dbSplits.reduce((s: number, r: any) => s + r.amount, 0);
      if (dbTotal > 0 && dbTotal !== total) {
        // For registration types, isolate platform fee first then scale remainder
        if (isRegistration) {
          return { total, enabled: data.fee_enabled, splits: calculateRegistrationSplits(total, feeKey) };
        }
        const ratio = total / dbTotal;
        const scaled = dbSplits.map((s: any) => ({ ...s, amount: Math.round(s.amount * ratio * 100) / 100 }));
        return { total, enabled: data.fee_enabled, splits: scaled };
      }
      return { total, enabled: data.fee_enabled, splits: dbSplits };
    }

    if (isRegistration) {
      return { total, enabled: data.fee_enabled, splits: calculateRegistrationSplits(total, feeKey) };
    }

    const ratio = defaultRule ? total / defaultRule.total : 1;
    const splits = defaultRule
      ? defaultRule.splits.map(s => ({ ...s, amount: Math.round(s.amount * ratio * 100) / 100 }))
      : [{ recipient: "platform", amount: total, description: feeKey.replace(/_/g, " ") }];

    return { total, enabled: data.fee_enabled, splits };
  } catch {
    const defaultRule = DEFAULT_SPLIT_RULES[feeKey];
    return { total: defaultRule?.total ?? 0, enabled: true, splits: defaultRule?.splits ?? [] };
  }
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
    let splitPlan: { recipient: string; amount: number; description: string }[] = [];
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
      splitPlan = [
        { recipient: "rent_control", amount: taxAmount, description: `Rent tax (${taxRate * 100}%)` },
        { recipient: "landlord", amount: rent, description: "Monthly rent (held in escrow)" },
      ];
      description = `Rent + Tax combined - ${(tenancy as any).registration_code}`;
      reference = `rentcombo_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "rent_card_bulk") {
      const { quantity: qty } = body;
      const cardQty = Math.min(Math.max(parseInt(qty) || 1, 1), 50);
      const fee = await getDynamicFee(supabaseAdmin, "rent_card_fee");

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
      totalAmount = fee.total * cardQty;
      splitPlan = fee.splits.map(s => ({ ...s, amount: s.amount * cardQty }));
      description = `Rent Card Purchase (${cardQty} cards × GH₵ ${fee.total})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";
      metadata = { quantity: cardQty };

    } else if (type === "rent_card") {
      const fee = await getDynamicFee(supabaseAdmin, "rent_card_fee");
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
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Rent Card Purchase (GH₵ ${fee.total})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";

    } else if (type === "agreement_sale") {
      const { tenancyId } = body;
      const fee = await getDynamicFee(supabaseAdmin, "agreement_sale_fee");
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "tenancy";

      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Agreement fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Tenancy Agreement Form (GH₵ ${fee.total})`;
      reference = `agrsale_${tenancyId || userId}_${Date.now()}`;
      callbackPath = "/landlord/agreements?status=success";
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

      const fee = await getDynamicFee(supabaseAdmin, "tenant_registration_fee");
      if (!fee.enabled || fee.total === 0) {
        await supabaseAdmin.from("tenants").update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("user_id", userId);
        return new Response(JSON.stringify({ skipped: true, message: "Registration fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Tenant Registration Fee (GH₵ ${fee.total})`;
      reference = `treg_${userId}_${Date.now()}`;
      callbackPath = "/tenant/dashboard?status=success";

    } else if (type === "landlord_registration") {
      const { data: landlord } = await supabase
        .from("landlords")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (!landlord) throw new Error("Landlord record not found");
      if (landlord.registration_fee_paid) throw new Error("Registration fee already paid");

      officeId = await resolveOffice(supabaseAdmin, { userId, region: profile?.delivery_region || undefined, area: profile?.delivery_area || undefined });
      caseType = "registration";

      const fee = await getDynamicFee(supabaseAdmin, "landlord_registration_fee");
      if (!fee.enabled || fee.total === 0) {
        await supabaseAdmin.from("landlords").update({ registration_fee_paid: true, registration_date: new Date().toISOString(), expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("user_id", userId);
        return new Response(JSON.stringify({ skipped: true, message: "Registration fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Landlord Registration Fee (GH₵ ${fee.total})`;
      reference = `lreg_${userId}_${Date.now()}`;
      callbackPath = "/landlord/dashboard?status=success";

    } else if (type === "complaint_fee") {
      const { complaintId } = body;
      if (!complaintId) throw new Error("complaintId is required");

      const { data: complaint } = await supabase
        .from("complaints")
        .select("id, status, tenant_user_id, region")
        .eq("id", complaintId)
        .single();

      if (!complaint) throw new Error("Complaint not found");
      if (complaint.tenant_user_id !== userId) throw new Error("Unauthorized");
      if (complaint.status !== "pending_payment") throw new Error("Complaint not awaiting payment");

      officeId = await resolveOffice(supabaseAdmin, { region: (complaint as any).region });
      caseType = "complaint";
      relatedComplaintId = complaintId;

      const fee = await getDynamicFee(supabaseAdmin, "complaint_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Complaint fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Complaint Filing Fee (GH₵ ${fee.total})`;
      reference = `comp_${complaintId}`;
      callbackPath = "/tenant/my-cases?status=success";

    } else if (type === "listing_fee") {
      const { propertyId } = body;
      if (!propertyId) throw new Error("propertyId is required");

      const { data: prop } = await supabase
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

      const fee = await getDynamicFee(supabaseAdmin, "listing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Listing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Property Listing Fee (GH₵ ${fee.total})`;
      reference = `list_${propertyId}_${Date.now()}`;
      callbackPath = "/landlord/my-properties?status=listed";

    } else if (type === "viewing_fee") {
      const { viewingRequestId } = body;
      if (!viewingRequestId) throw new Error("viewingRequestId is required");

      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "viewing";

      const fee = await getDynamicFee(supabaseAdmin, "viewing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Viewing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Property Viewing Request Fee (GH₵ ${fee.total})`;
      reference = `view_${viewingRequestId}`;
      callbackPath = "/tenant/marketplace?status=viewing_paid";

    } else if (type === "add_tenant_fee") {
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "tenancy";

      const fee = await getDynamicFee(supabaseAdmin, "add_tenant_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Add tenant fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Add Tenant Fee (GH₵ ${fee.total})`;
      reference = `addten_${userId}_${Date.now()}`;
      callbackPath = "/landlord/add-tenant?status=fee_paid";

    } else if (type === "termination_fee") {
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "termination";

      const fee = await getDynamicFee(supabaseAdmin, "termination_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Termination fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Termination Request Fee (GH₵ ${fee.total})`;
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
      splitPlan = [{ recipient: "rent_control", amount: totalAmount, description: `Renewal tax (${advanceMonths} months)` }];
      description = `Renewal tax (${advanceMonths} months advance) - ${(tenancy as any).registration_code}`;
      reference = `renew_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/renewal?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "archive_search_fee") {
      officeId = await resolveOffice(supabaseAdmin, { userId });
      caseType = "archive_search";

      const fee = await getDynamicFee(supabaseAdmin, "archive_search_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Archive search fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Archive Search Fee (GH₵ ${fee.total})`;
      reference = `archsearch_${userId}_${Date.now()}`;
      callbackPath = "/landlord/applications?status=success";

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

    const payload = {
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Default fee structure & split rules (used as fallback if DB lookup fails)
const DEFAULT_SPLIT_RULES: Record<string, { total: number; splits: { recipient: string; amount: number; description: string }[] }> = {
  tenant_registration: {
    total: 40,
    splits: [
      { recipient: "rent_control", amount: 15, description: "Rent Control registration fee" },
      { recipient: "admin", amount: 15, description: "Admin registration fee" },
      { recipient: "platform", amount: 10, description: "Platform fee" },
    ],
  },
  landlord_registration: {
    total: 30,
    splits: [
      { recipient: "rent_control", amount: 13, description: "Rent Control registration fee" },
      { recipient: "admin", amount: 7, description: "Admin registration fee" },
      { recipient: "platform", amount: 10, description: "Platform fee" },
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
    splits: [{ recipient: "platform", amount: 2, description: "Complaint filing fee" }],
  },
  listing_fee: {
    total: 2,
    splits: [{ recipient: "platform", amount: 2, description: "Listing fee" }],
  },
  viewing_fee: {
    total: 2,
    splits: [{ recipient: "platform", amount: 2, description: "Viewing fee" }],
  },
  add_tenant_fee: {
    total: 5,
    splits: [{ recipient: "platform", amount: 5, description: "Add tenant fee" }],
  },
  termination_fee: {
    total: 5,
    splits: [{ recipient: "platform", amount: 5, description: "Termination request fee" }],
  },
};

// Helper to get dynamic fee from DB, falling back to defaults
const getDynamicFee = async (supabaseAdmin: any, feeKey: string): Promise<{ total: number; enabled: boolean; splits: { recipient: string; amount: number; description: string }[] }> => {
  try {
    const { data } = await supabaseAdmin
      .from("feature_flags")
      .select("fee_amount, fee_enabled")
      .eq("feature_key", feeKey)
      .single();

    const defaultRule = DEFAULT_SPLIT_RULES[feeKey];
    if (!data || data.fee_amount === null) {
      return { total: defaultRule?.total ?? 0, enabled: true, splits: defaultRule?.splits ?? [] };
    }

    const ratio = defaultRule ? data.fee_amount / defaultRule.total : 1;
    const splits = defaultRule
      ? defaultRule.splits.map(s => ({ ...s, amount: Math.round(s.amount * ratio * 100) / 100 }))
      : [{ recipient: "platform", amount: data.fee_amount, description: feeKey.replace(/_/g, " ") }];

    return { total: data.fee_amount, enabled: data.fee_enabled, splits };
  } catch {
    const defaultRule = DEFAULT_SPLIT_RULES[feeKey];
    return { total: defaultRule?.total ?? 0, enabled: true, splits: defaultRule?.splits ?? [] };
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
      .select("full_name, email, phone")
      .eq("user_id", userId)
      .single();

    // Service role client for escrow record creation
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

    if (type === "rent_tax_bulk") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy, error: tErr } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, registration_code, advance_months, agreed_rent")
        .eq("id", tenancyId)
        .single();

      if (tErr || !tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const maxLawful = Number((tenancy as any).agreed_rent) * 6;

      const { data: unpaidPayments, error: pErr } = await supabase
        .from("rent_payments")
        .select("id, tax_amount, tenant_marked_paid")
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false)
        .order("due_date", { ascending: true });

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

      splitPlan = [{ recipient: "rent_control", amount: totalAmount, description: "Rent tax (bulk advance)" }];
      description = `Bulk advance rent tax (${dedupedPayments.length} months) - ${(tenancy as any).registration_code}`;
      reference = `rentbulk_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;
      metadata = { paymentIds: dedupedPayments.map((p: any) => p.id) };

    } else if (type === "rent_tax") {
      const { paymentId } = body;
      if (!paymentId) throw new Error("paymentId is required");

      const { data: payment, error: payErr } = await supabase
        .from("rent_payments")
        .select("*, tenancy:tenancies(tenant_user_id, registration_code)")
        .eq("id", paymentId)
        .single();

      if (payErr || !payment) throw new Error("Payment not found");
      if ((payment as any).tenancy.tenant_user_id !== userId) throw new Error("Unauthorized");
      if (payment.tenant_marked_paid) throw new Error("Already paid");

      totalAmount = Number(payment.tax_amount);
      splitPlan = [{ recipient: "rent_control", amount: totalAmount, description: `Rent tax - ${payment.month_label}` }];
      description = `Rent tax for ${payment.month_label} - ${(payment as any).tenancy.registration_code}`;
      reference = `rent_${paymentId}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = payment.tenancy_id;

    } else if (type === "rent_payment") {
      // Pay rent only (held in escrow for landlord)
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, agreed_rent, registration_code")
        .eq("id", tenancyId)
        .single();

      if (!tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      totalAmount = Number((tenancy as any).agreed_rent);
      splitPlan = [{ recipient: "landlord", amount: totalAmount, description: "Monthly rent (held in escrow)" }];
      description = `Monthly rent - ${(tenancy as any).registration_code}`;
      reference = `rentpay_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";
      relatedTenancyId = tenancyId;

    } else if (type === "rent_combined") {
      // Pay tax + rent combined
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      const { data: tenancy } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, agreed_rent, registration_code, unit_id")
        .eq("id", tenancyId)
        .single();

      if (!tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      // Determine tax rate from property category
      const { data: unit } = await supabaseAdmin
        .from("units")
        .select("property_id")
        .eq("id", (tenancy as any).unit_id)
        .single();

      let taxRate = 0.08;
      if (unit) {
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
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Rent card fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Rent Card Purchase (GH₵ ${fee.total})`;
      reference = `rcard_${userId}_${Date.now()}`;
      callbackPath = "/landlord/rent-cards?status=success";

    } else if (type === "agreement_sale") {
      const { tenancyId } = body;
      const fee = await getDynamicFee(supabaseAdmin, "agreement_sale_fee");
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

      const fee = await getDynamicFee(supabaseAdmin, "tenant_registration_fee");
      if (!fee.enabled || fee.total === 0) {
        // Auto-mark as paid when fee is disabled or zero
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

      const fee = await getDynamicFee(supabaseAdmin, "landlord_registration_fee");
      if (!fee.enabled || fee.total === 0) {
        // Auto-mark as paid when fee is disabled or zero
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
        .select("id, status, tenant_user_id")
        .eq("id", complaintId)
        .single();

      if (!complaint) throw new Error("Complaint not found");
      if (complaint.tenant_user_id !== userId) throw new Error("Unauthorized");
      if (complaint.status !== "pending_payment") throw new Error("Complaint not awaiting payment");

      const fee = await getDynamicFee(supabaseAdmin, "complaint_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Complaint fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Complaint Filing Fee (GH₵ ${fee.total})`;
      reference = `comp_${complaintId}`;
      callbackPath = "/tenant/my-cases?status=success";
      relatedComplaintId = complaintId;

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

      const fee = await getDynamicFee(supabaseAdmin, "listing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Listing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Property Listing Fee (GH₵ ${fee.total})`;
      reference = `list_${propertyId}_${Date.now()}`;
      callbackPath = "/landlord/my-properties?status=listed";
      relatedPropertyId = propertyId;

    } else if (type === "viewing_fee") {
      const { viewingRequestId } = body;
      if (!viewingRequestId) throw new Error("viewingRequestId is required");

      const fee = await getDynamicFee(supabaseAdmin, "viewing_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Viewing fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Property Viewing Request Fee (GH₵ ${fee.total})`;
      reference = `view_${viewingRequestId}`;
      callbackPath = "/tenant/marketplace?status=viewing_paid";

    } else if (type === "add_tenant_fee") {
      const fee = await getDynamicFee(supabaseAdmin, "add_tenant_fee");
      if (!fee.enabled) return new Response(JSON.stringify({ skipped: true, message: "Add tenant fee is currently waived" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      totalAmount = fee.total;
      splitPlan = fee.splits;
      description = `Add Tenant Fee (GH₵ ${fee.total})`;
      reference = `addten_${userId}_${Date.now()}`;
      callbackPath = "/landlord/add-tenant?status=fee_paid";

    } else if (type === "termination_fee") {
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
        .select("id, tenant_user_id, registration_code, proposed_rent, agreed_rent, renewal_duration_months, advance_months")
        .eq("id", tenancyId)
        .single();

      if (tErr || !tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      const rent = Number((tenancy as any).proposed_rent ?? (tenancy as any).agreed_rent);
      const advanceMonths = Math.min((tenancy as any).advance_months ?? 6, 6);

      totalAmount = rent * advanceMonths * 0.08;
      splitPlan = [{ recipient: "rent_control", amount: totalAmount, description: `Renewal tax (${advanceMonths} months)` }];
      description = `Renewal tax (${advanceMonths} months advance) - ${(tenancy as any).registration_code}`;
      reference = `renew_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/renewal?status=success";
      relatedTenancyId = tenancyId;

    } else {
      throw new Error("Invalid payment type");
    }

    // Create escrow transaction record
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
        metadata: { ...metadata, split_plan: splitPlan, description },
      });

    if (escrowErr) console.error("Escrow record creation error:", escrowErr.message);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const origin = req.headers.get("origin") || "https://www.rentcontrolghana.com";
    const callbackUrl = `${origin}${callbackPath}`;
    const amountInPesewas = Math.round(totalAmount * 100);

    // Build a valid email for Paystack — reject .local synthetic emails
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
        custom_fields: [
          { display_name: "Description", variable_name: "description", value: description },
          { display_name: "Customer", variable_name: "customer_name", value: profile?.full_name || "Customer" },
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

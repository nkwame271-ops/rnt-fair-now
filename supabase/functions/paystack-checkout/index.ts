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
      throw new Error("Not authenticated");
    }

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

    let totalAmount: number;
    let description: string;
    let reference: string;
    let callbackPath: string;

    if (type === "rent_tax_bulk") {
      const { tenancyId } = body;
      if (!tenancyId) throw new Error("tenancyId is required");

      // Verify tenancy belongs to user
      const { data: tenancy, error: tErr } = await supabase
        .from("tenancies")
        .select("id, tenant_user_id, registration_code, advance_months")
        .eq("id", tenancyId)
        .single();

      if (tErr || !tenancy) throw new Error("Tenancy not found");
      if ((tenancy as any).tenant_user_id !== userId) throw new Error("Unauthorized");

      // Get all unpaid advance payments
      const { data: unpaidPayments, error: pErr } = await supabase
        .from("rent_payments")
        .select("id, tax_amount, tenant_marked_paid")
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false)
        .order("due_date", { ascending: true });

      if (pErr) throw new Error("Failed to fetch payments");
      if (!unpaidPayments || unpaidPayments.length === 0) throw new Error("No unpaid payments found");

      totalAmount = unpaidPayments.reduce((sum: number, p: any) => sum + Number(p.tax_amount), 0);
      description = `Bulk advance rent tax (${unpaidPayments.length} months) - ${(tenancy as any).registration_code}`;
      reference = `rentbulk_${tenancyId}_${Date.now()}`;
      callbackPath = "/tenant/payments?status=success";

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
      description = `Rent tax for ${payment.month_label} - ${(payment as any).tenancy.registration_code}`;
      reference = `rent_${paymentId}`;
      callbackPath = "/tenant/payments?status=success";

    } else if (type === "tenant_registration") {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (!tenant) throw new Error("Tenant record not found");
      if (tenant.registration_fee_paid) throw new Error("Registration fee already paid");

      totalAmount = 2;
      description = "Tenant ID Registration - Annual Fee (GH₵ 2)";
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

      totalAmount = 2;
      description = "Landlord ID Registration - Annual Fee (GH₵ 2)";
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

      totalAmount = 2;
      description = "Complaint Filing Fee (GH₵ 2)";
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

      totalAmount = 2;
      description = "Property Listing Fee - Marketplace (GH₵ 2)";
      reference = `list_${propertyId}_${Date.now()}`;
      callbackPath = "/landlord/my-properties?status=listed";

    } else if (type === "viewing_fee") {
      const { viewingRequestId } = body;
      if (!viewingRequestId) throw new Error("viewingRequestId is required");

      totalAmount = 2;
      description = "Property Viewing Request Fee (GH₵ 2)";
      reference = `view_${viewingRequestId}`;
      callbackPath = "/tenant/marketplace?status=viewing_paid";

    } else {
      throw new Error("Invalid payment type");
    }

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) throw new Error("Payment gateway not configured");

    const origin = req.headers.get("origin") || "https://rentcontrol.lovable.app";
    const callbackUrl = `${origin}${callbackPath}`;

    const amountInPesewas = Math.round(totalAmount * 100);

    const payload = {
      email: profile?.email || authUser.email || "customer@rentcontrol.app",
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

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
    const { type } = body; // "rent_tax" | "tenant_registration" | "landlord_registration" | "complaint_fee"

    let totalAmount: number;
    let description: string;
    let clientReference: string;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", userId)
      .single();

    if (type === "rent_tax") {
      // Existing rent tax flow
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
      clientReference = `rent:${paymentId}`;

    } else if (type === "tenant_registration") {
      // Check tenant record exists and fee not paid
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (!tenant) throw new Error("Tenant record not found");
      if (tenant.registration_fee_paid) throw new Error("Registration fee already paid");

      totalAmount = 50;
      description = "Tenant ID Registration - Annual Fee (GH₵ 50)";
      clientReference = `treg:${userId}`;

    } else if (type === "landlord_registration") {
      const { data: landlord } = await supabase
        .from("landlords")
        .select("id, registration_fee_paid")
        .eq("user_id", userId)
        .single();

      if (!landlord) throw new Error("Landlord record not found");
      if (landlord.registration_fee_paid) throw new Error("Registration fee already paid");

      totalAmount = 50;
      description = "Landlord ID Registration - Annual Fee (GH₵ 50)";
      clientReference = `lreg:${userId}`;

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

      totalAmount = 20;
      description = "Complaint Filing Fee (GH₵ 20)";
      clientReference = `comp:${complaintId}`;

    } else {
      throw new Error("Invalid payment type");
    }

    const HUBTEL_CLIENT_ID = Deno.env.get("PAYMENT_API_ID")!;
    const HUBTEL_CLIENT_SECRET = Deno.env.get("PAYMENT_API_KEY")!;
    const HUBTEL_MERCHANT_ACCOUNT = Deno.env.get("HUBTEL_MERCHANT_ACCOUNT")!;
    const auth = btoa(`${HUBTEL_CLIENT_ID}:${HUBTEL_CLIENT_SECRET}`);

    const projectId = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/(.+)\.supabase\.co/)?.[1] || "";
    const callbackUrl = `https://${projectId}.supabase.co/functions/v1/hubtel-webhook`;
    const returnUrl = req.headers.get("origin") || "https://rnt-fair-now.lovable.app";

    // Determine return paths based on type
    let successPath = "/";
    let cancelPath = "/";
    if (type === "rent_tax") {
      successPath = "/tenant/payments?status=success";
      cancelPath = "/tenant/payments?status=cancelled";
    } else if (type === "tenant_registration") {
      successPath = "/register/tenant?status=success";
      cancelPath = "/register/tenant?status=cancelled";
    } else if (type === "landlord_registration") {
      successPath = "/register/landlord?status=success";
      cancelPath = "/register/landlord?status=cancelled";
    } else if (type === "complaint_fee") {
      successPath = "/tenant/my-cases?status=success";
      cancelPath = "/tenant/file-complaint?status=cancelled";
    }

    // Detect channel from phone number
    const phone = (profile?.phone || "").replace(/\s+/g, "");
    let channel = "mtn-gh"; // default
    if (phone.startsWith("020") || phone.startsWith("050")) channel = "vodafone-gh";
    else if (phone.startsWith("026") || phone.startsWith("056") || phone.startsWith("027") || phone.startsWith("057")) channel = "airteltigo-gh";

    const payload = {
      CustomerName: profile?.full_name || "Customer",
      CustomerMsisdn: phone,
      CustomerEmail: profile?.email || "",
      Channel: channel,
      Amount: totalAmount,
      PrimaryCallbackUrl: callbackUrl,
      SecondaryCallbackUrl: callbackUrl,
      Description: description,
      ClientReference: clientReference,
    };

    console.log("Hubtel checkout payload:", JSON.stringify(payload));

    const response = await fetch(
      `https://api.hubtel.com/v1/merchantaccount/merchants/${HUBTEL_MERCHANT_ACCOUNT}/receive/mobilemoney`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();
    console.log("Hubtel raw response:", responseText, "status:", response.status);

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("Hubtel returned non-JSON:", responseText);
      throw new Error(`Hubtel returned invalid response (HTTP ${response.status}): ${responseText.substring(0, 200)}`);
    }

    if (!response.ok) {
      console.error("Hubtel error:", JSON.stringify(result));
      throw new Error(result.Message || result.message || `Hubtel returned HTTP ${response.status}`);
    }

    if (result.ResponseCode !== "0000") {
      console.error("Hubtel non-success:", JSON.stringify(result));
      throw new Error(result.Message || "Payment initiation failed");
    }

    // Mobile money: response is a pending prompt, no checkout URL
    return new Response(JSON.stringify({
      status: result.Status || "pending",
      message: result.Message || "Payment prompt sent to your phone. Please approve.",
      clientReference,
      data: result.Data,
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

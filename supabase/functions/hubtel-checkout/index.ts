import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    const { paymentId } = await req.json();
    if (!paymentId) throw new Error("paymentId is required");

    // Fetch payment and verify ownership
    const { data: payment, error: payErr } = await supabase
      .from("rent_payments")
      .select("*, tenancy:tenancies(tenant_user_id, registration_code)")
      .eq("id", paymentId)
      .single();

    if (payErr || !payment) throw new Error("Payment not found");
    if (payment.tenancy.tenant_user_id !== user.id) throw new Error("Unauthorized");
    if (payment.tenant_marked_paid) throw new Error("Already paid");

    // Get tenant profile for customer info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("user_id", user.id)
      .single();

    const HUBTEL_API_ID = Deno.env.get("PAYMENT_API_ID")!;
    const HUBTEL_API_KEY = Deno.env.get("PAYMENT_API_KEY")!;
    const auth = btoa(`${HUBTEL_API_ID}:${HUBTEL_API_KEY}`);

    const projectId = Deno.env.get("SUPABASE_URL")!.match(/https:\/\/(.+)\.supabase\.co/)?.[1] || "";
    const callbackUrl = `https://${projectId}.supabase.co/functions/v1/hubtel-webhook`;
    const returnUrl = req.headers.get("origin") || "https://rnt-fair-now.lovable.app";

    const payload = {
      totalAmount: Number(payment.tax_amount),
      description: `Rent tax for ${payment.month_label} - ${payment.tenancy.registration_code}`,
      callbackUrl,
      returnUrl: `${returnUrl}/tenant/payments?status=success`,
      cancellationUrl: `${returnUrl}/tenant/payments?status=cancelled`,
      merchantBusinessLogoUrl: `${returnUrl}/favicon.ico`,
      merchantAccountNumber: HUBTEL_API_ID,
      clientReference: paymentId,
      customerName: profile?.full_name || "Tenant",
      customerMsisdn: profile?.phone || "",
      customerEmail: profile?.email || "",
    };

    const response = await fetch(
      "https://payproxyapi.hubtel.com/items/initiate",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();

    if (!response.ok || result.responseCode !== "0000") {
      console.error("Hubtel error:", JSON.stringify(result));
      throw new Error(result.message || "Failed to initiate payment");
    }

    return new Response(JSON.stringify({
      checkoutUrl: result.data?.checkoutUrl,
      checkoutId: result.data?.checkoutId,
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

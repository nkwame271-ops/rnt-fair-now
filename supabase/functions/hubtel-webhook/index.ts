import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log("Hubtel webhook received:", JSON.stringify(body));

    const status = body.Status || body.ResponseCode || body.Data?.Status;
    const clientReference = body.ClientReference || body.Data?.ClientReference;
    const transactionId = body.TransactionId || body.Data?.TransactionId;

    if (!clientReference) {
      console.error("No clientReference in webhook");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isSuccess = status === "Success" || status === "Paid" || body.ResponseCode === "0000";

    if (!isSuccess) {
      console.log("Payment not successful, status:", status);
      return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Parse clientReference to determine payment type
    if (clientReference.startsWith("rent:")) {
      // Rent tax payment
      const paymentId = clientReference.replace("rent:", "");
      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Hubtel",
          amount_paid: body.Amount || body.Data?.Amount || 0,
          receiver: transactionId || "hubtel",
        })
        .eq("id", paymentId);

      if (error) console.error("Rent payment update error:", error.message);
      else console.log("Rent payment confirmed for:", paymentId);

    } else if (clientReference.startsWith("treg:")) {
      // Tenant registration
      const userId = clientReference.replace("treg:", "");
      const { error } = await supabase
        .from("tenants")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      if (error) console.error("Tenant reg update error:", error.message);
      else console.log("Tenant registration confirmed for:", userId);

    } else if (clientReference.startsWith("lreg:")) {
      // Landlord registration
      const userId = clientReference.replace("lreg:", "");
      const { error } = await supabase
        .from("landlords")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      if (error) console.error("Landlord reg update error:", error.message);
      else console.log("Landlord registration confirmed for:", userId);

    } else if (clientReference.startsWith("comp:")) {
      // Complaint fee
      const complaintId = clientReference.replace("comp:", "");
      const { error } = await supabase
        .from("complaints")
        .update({ status: "submitted" })
        .eq("id", complaintId);

      if (error) console.error("Complaint update error:", error.message);
      else console.log("Complaint fee confirmed for:", complaintId);

    } else {
      // Legacy: treat clientReference as rent payment ID directly
      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Hubtel",
          amount_paid: body.Amount || body.Data?.Amount || 0,
          receiver: transactionId || "hubtel",
        })
        .eq("id", clientReference);

      if (error) console.error("Legacy payment update error:", error.message);
      else console.log("Legacy payment confirmed for:", clientReference);
    }

    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }
});

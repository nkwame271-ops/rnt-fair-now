import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return new Response("Server error", { status: 500 });
    }

    const rawBody = await req.text();

    const signature = req.headers.get("x-paystack-signature");
    const hash = createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");

    if (signature !== hash) {
      console.error("Invalid Paystack signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    console.log("Paystack webhook event:", body.event);

    if (body.event !== "charge.success") {
      console.log("Ignoring event:", body.event);
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    const data = body.data;
    const reference = data.reference || "";
    const amountPaid = (data.amount || 0) / 100;
    const transactionId = String(data.id || "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (reference.startsWith("rentbulk_")) {
      // Bulk advance tax payment: reference = rentbulk_<tenancyId>_<timestamp>
      const parts = reference.split("_");
      const tenancyId = parts[1];

      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Paystack",
          receiver: transactionId,
        })
        .eq("tenancy_id", tenancyId)
        .eq("tenant_marked_paid", false);

      if (error) console.error("Bulk rent payment update error:", error.message);
      else console.log("Bulk rent payments confirmed for tenancy:", tenancyId);

    } else if (reference.startsWith("rent_")) {
      const paymentId = reference.replace("rent_", "");
      const { error } = await supabase
        .from("rent_payments")
        .update({
          tenant_marked_paid: true,
          status: "tenant_paid",
          paid_date: new Date().toISOString(),
          payment_method: "Paystack",
          amount_paid: amountPaid,
          receiver: transactionId,
        })
        .eq("id", paymentId);

      if (error) console.error("Rent payment update error:", error.message);
      else console.log("Rent payment confirmed:", paymentId);

    } else if (reference.startsWith("treg_")) {
      const userId = reference.split("_")[1];
      const { error } = await supabase
        .from("tenants")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      if (error) console.error("Tenant reg update error:", error.message);
      else console.log("Tenant registration confirmed:", userId);

    } else if (reference.startsWith("lreg_")) {
      const userId = reference.split("_")[1];
      const { error } = await supabase
        .from("landlords")
        .update({
          registration_fee_paid: true,
          registration_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("user_id", userId);

      if (error) console.error("Landlord reg update error:", error.message);
      else console.log("Landlord registration confirmed:", userId);

    } else if (reference.startsWith("comp_")) {
      const complaintId = reference.replace("comp_", "");
      const { error } = await supabase
        .from("complaints")
        .update({ status: "submitted" })
        .eq("id", complaintId);

      if (error) console.error("Complaint update error:", error.message);
      else console.log("Complaint fee confirmed:", complaintId);

    } else if (reference.startsWith("list_")) {
      const propertyId = reference.split("_")[1];
      const { error } = await supabase
        .from("properties")
        .update({ listed_on_marketplace: true })
        .eq("id", propertyId);

      if (error) console.error("Listing fee update error:", error.message);
      else console.log("Property listed on marketplace:", propertyId);

    } else if (reference.startsWith("view_")) {
      const viewingRequestId = reference.replace("view_", "");
      const { error } = await supabase
        .from("viewing_requests")
        .update({ status: "pending" })
        .eq("id", viewingRequestId)
        .eq("status", "awaiting_payment");

      if (error) console.error("Viewing fee update error:", error.message);
      else console.log("Viewing request activated:", viewingRequestId);

    } else {
      console.log("Unknown reference format:", reference);
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

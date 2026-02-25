import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // Hubtel sends POST webhook callbacks
  if (req.method !== "POST") {
    return new Response("OK", { status: 200 });
  }

  try {
    const body = await req.json();
    console.log("Hubtel webhook received:", JSON.stringify(body));

    // Hubtel webhook payload structure
    const status = body.Status || body.ResponseCode || body.Data?.Status;
    const clientReference = body.ClientReference || body.Data?.ClientReference;
    const transactionId = body.TransactionId || body.Data?.TransactionId;

    if (!clientReference) {
      console.error("No clientReference in webhook");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    }

    // Use service role to update payment status
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const isSuccess = status === "Success" || status === "Paid" || body.ResponseCode === "0000";

    if (isSuccess) {
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

      if (error) console.error("DB update error:", error.message);
      else console.log("Payment confirmed for:", clientReference);
    } else {
      console.log("Payment not successful, status:", status);
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

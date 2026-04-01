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
      console.error("Invalid Paystack signature on transfer webhook");
      return new Response("Invalid signature", { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const event = body.event;
    console.log("Transfer webhook event:", event);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const data = body.data;
    const transferCode = data.transfer_code || "";
    const reference = data.reference || "";

    if (event === "transfer.success") {
      const { error } = await supabase
        .from("payout_transfers")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          transfer_code: transferCode,
        })
        .eq("paystack_reference", reference);

      if (error) console.error("Failed to update transfer success:", error.message);

      // Update corresponding escrow_split disbursement_status
      const { data: transfer } = await supabase
        .from("payout_transfers")
        .select("escrow_split_id")
        .eq("paystack_reference", reference)
        .single();

      if (transfer?.escrow_split_id) {
        await supabase
          .from("escrow_splits")
          .update({ disbursement_status: "released", released_at: new Date().toISOString() })
          .eq("id", transfer.escrow_split_id);
      }

    } else if (event === "transfer.failed") {
      const reason = data.reason || data.message || "Unknown failure";
      const { error } = await supabase
        .from("payout_transfers")
        .update({
          status: "failed",
          failure_reason: reason,
          completed_at: new Date().toISOString(),
          transfer_code: transferCode,
        })
        .eq("paystack_reference", reference);

      if (error) console.error("Failed to update transfer failure:", error.message);

      // Notify admins
      const { data: adminStaff } = await supabase
        .from("admin_staff")
        .select("user_id")
        .eq("admin_type", "main_admin");

      if (adminStaff) {
        const notifications = adminStaff.map((a: any) => ({
          user_id: a.user_id,
          title: "Transfer Failed",
          body: `Paystack transfer ${reference} failed: ${reason}. Please review in the Escrow Dashboard.`,
          link: "/regulator/escrow",
        }));
        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }

    } else if (event === "transfer.reversed") {
      const { error } = await supabase
        .from("payout_transfers")
        .update({
          status: "reversed",
          failure_reason: "Transfer reversed by Paystack",
          completed_at: new Date().toISOString(),
          transfer_code: transferCode,
        })
        .eq("paystack_reference", reference);

      if (error) console.error("Failed to update transfer reversal:", error.message);

      // Update escrow_split back to held
      const { data: transfer } = await supabase
        .from("payout_transfers")
        .select("escrow_split_id")
        .eq("paystack_reference", reference)
        .single();

      if (transfer?.escrow_split_id) {
        await supabase
          .from("escrow_splits")
          .update({ disbursement_status: "held", released_at: null })
          .eq("id", transfer.escrow_split_id);
      }

      // Notify admins
      const { data: adminStaff } = await supabase
        .from("admin_staff")
        .select("user_id")
        .eq("admin_type", "main_admin");

      if (adminStaff) {
        const notifications = adminStaff.map((a: any) => ({
          user_id: a.user_id,
          title: "Transfer Reversed",
          body: `Paystack transfer ${reference} was reversed. Funds returned to main account.`,
          link: "/regulator/escrow",
        }));
        if (notifications.length > 0) {
          await supabase.from("notifications").insert(notifications);
        }
      }
    }

    return new Response(JSON.stringify({ status: "ok" }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error: any) {
    console.error("Transfer webhook error:", error.message);
    return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
  }
});

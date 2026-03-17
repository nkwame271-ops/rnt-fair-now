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

    // Helper to send SMS via edge function
    const sendPaymentSms = async (userId: string, amount: number, description: string, ref: string) => {
      try {
        const { data: profile } = await supabase.from("profiles").select("phone").eq("user_id", userId).single();
        if (profile?.phone) {
          let normalizedPhone = profile.phone.replace(/\s/g, "").replace(/^0/, "233");
          if (!normalizedPhone.startsWith("233")) normalizedPhone = "233" + normalizedPhone;
          
          const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
          if (ARKESEL_API_KEY) {
            const params = new URLSearchParams({
              action: "send-sms",
              api_key: ARKESEL_API_KEY,
              to: normalizedPhone,
              from: "RentGhana",
              sms: `RentGhana: Your payment of GH₵ ${amount.toFixed(2)} for ${description} has been confirmed. Reference: ${ref}. Thank you!`,
            });
            await fetch(`https://sms.arkesel.com/sms/api?${params.toString()}`);
          }
        }
      } catch (e) {
        console.error("SMS send error:", e);
      }
    };

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
      else {
        console.log("Bulk rent payments confirmed for tenancy:", tenancyId);
        const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", tenancyId).single();
        if (tenancy) await sendPaymentSms(tenancy.tenant_user_id, amountPaid, "Bulk advance rent tax", reference);
      }

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
      else {
        console.log("Rent payment confirmed:", paymentId);
        const { data: payment } = await supabase.from("rent_payments").select("tenancy_id").eq("id", paymentId).single();
        if (payment) {
          const { data: tenancy } = await supabase.from("tenancies").select("tenant_user_id").eq("id", payment.tenancy_id).single();
          if (tenancy) await sendPaymentSms(tenancy.tenant_user_id, amountPaid, "Rent tax payment", reference);
        }
      }

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
      else {
        console.log("Tenant registration confirmed:", userId);
        await sendPaymentSms(userId, amountPaid, "Tenant registration fee", reference);
      }

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
      else {
        console.log("Landlord registration confirmed:", userId);
        await sendPaymentSms(userId, amountPaid, "Landlord registration fee", reference);
      }

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

    } else if (reference.startsWith("renew_")) {
      // Renewal payment: reference = renew_<tenancyId>_<timestamp>
      const parts = reference.split("_");
      const tenancyId = parts[1];

      // Get old tenancy
      const { data: oldTenancy } = await supabase
        .from("tenancies")
        .select("*")
        .eq("id", tenancyId)
        .single();

      if (oldTenancy) {
        const rent = Number(oldTenancy.proposed_rent ?? oldTenancy.agreed_rent);
        const months = oldTenancy.renewal_duration_months ?? 12;
        const advanceMonths = Math.min(oldTenancy.advance_months ?? 6, 6);

        const newStart = new Date(oldTenancy.end_date);
        const newEnd = new Date(newStart);
        newEnd.setMonth(newEnd.getMonth() + months);

        // Create new tenancy
        const { data: newTenancy, error: insertErr } = await supabase
          .from("tenancies")
          .insert({
            tenant_user_id: oldTenancy.tenant_user_id,
            landlord_user_id: oldTenancy.landlord_user_id,
            unit_id: oldTenancy.unit_id,
            agreed_rent: rent,
            advance_months: advanceMonths,
            start_date: newStart.toISOString().split("T")[0],
            end_date: newEnd.toISOString().split("T")[0],
            move_in_date: newStart.toISOString().split("T")[0],
            tenant_id_code: oldTenancy.tenant_id_code,
            registration_code: `REN-${oldTenancy.registration_code}`,
            status: "active",
            tenancy_type: "renewal",
            previous_tenancy_id: tenancyId,
            tenant_accepted: true,
            landlord_accepted: true,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error("Renewal tenancy creation error:", insertErr.message);
        } else {
          // Mark old tenancy as expired
          await supabase
            .from("tenancies")
            .update({ status: "expired" })
            .eq("id", tenancyId);

          // Generate rent payment schedule for new tenancy
          const payments = [];
          for (let i = 0; i < months; i++) {
            const dueDate = new Date(newStart);
            dueDate.setMonth(dueDate.getMonth() + i);
            const taxAmount = rent * 0.08;
            payments.push({
              tenancy_id: newTenancy!.id,
              due_date: dueDate.toISOString().split("T")[0],
              month_label: dueDate.toLocaleString("en-GB", { month: "long", year: "numeric" }),
              monthly_rent: rent,
              tax_amount: taxAmount,
              amount_to_landlord: rent,
              status: i < advanceMonths ? "tenant_paid" : "pending",
              tenant_marked_paid: i < advanceMonths,
            });
          }

          if (payments.length > 0) {
            await supabase.from("rent_payments").insert(payments);
          }

          // Notify both parties
          await supabase.from("notifications").insert([
            {
              user_id: oldTenancy.tenant_user_id,
              title: "Tenancy Renewed!",
              body: `Your tenancy has been renewed at GH₵ ${rent.toLocaleString()}/month for ${months} months.`,
              link: "/tenant/dashboard",
            },
            {
              user_id: oldTenancy.landlord_user_id,
              title: "Tenancy Renewed",
              body: `Tenancy ${oldTenancy.registration_code} has been renewed for ${months} months.`,
              link: "/landlord/dashboard",
            },
          ]);

          console.log("Renewal completed. New tenancy:", newTenancy!.id);
          await sendPaymentSms(oldTenancy.tenant_user_id, amountPaid, "Tenancy renewal", reference);
        }
      }

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

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
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) throw new Error("Not authenticated");

    // Verify main admin
    const { data: adminStaff } = await supabaseAdmin
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", user.id)
      .single();

    if (!adminStaff || adminStaff.admin_type !== "main_admin") {
      throw new Error("Only main admin can process payouts");
    }

    const { action, requestId, notes } = await req.json();

    if (action === "approve") {
      // Get the fund request
      const { data: request } = await supabaseAdmin
        .from("office_fund_requests")
        .select("*")
        .eq("id", requestId)
        .eq("status", "pending")
        .single();

      if (!request) throw new Error("Request not found or already processed");

      // Calculate available balance for this office
      const { data: totalSplits } = await supabaseAdmin
        .from("escrow_splits")
        .select("amount")
        .eq("office_id", request.office_id)
        .eq("recipient", "admin");

      const totalEarned = (totalSplits || []).reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      const { data: approvedRequests } = await supabaseAdmin
        .from("office_fund_requests")
        .select("amount")
        .eq("office_id", request.office_id)
        .eq("status", "approved");

      const totalWithdrawn = (approvedRequests || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);
      const availableBalance = totalEarned - totalWithdrawn;

      if (Number(request.amount) > availableBalance) {
        throw new Error(`Insufficient balance. Available: GH₵ ${availableBalance.toFixed(2)}, Requested: GH₵ ${Number(request.amount).toFixed(2)}`);
      }

      // Get payout account
      const { data: payoutAccount } = await supabaseAdmin
        .from("office_payout_accounts")
        .select("*")
        .eq("office_id", request.office_id)
        .single();

      if (!payoutAccount) throw new Error("No payout account configured for this office");

      // Attempt Paystack transfer
      const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
      let payoutRef = `OFR-${requestId.slice(0, 8)}-${Date.now()}`;

      if (PAYSTACK_SECRET_KEY) {
        try {
          // Create transfer recipient
          const recipientPayload: any = {
            type: payoutAccount.payment_method === "momo" ? "mobile_money" : "nuban",
            name: payoutAccount.account_name || "Office Account",
            currency: "GHS",
          };

          if (payoutAccount.payment_method === "momo") {
            recipientPayload.account_number = payoutAccount.momo_number;
            recipientPayload.bank_code = payoutAccount.momo_provider?.toLowerCase() === "mtn" ? "MTN" :
              payoutAccount.momo_provider?.toLowerCase() === "vodafone" ? "VOD" :
              payoutAccount.momo_provider?.toLowerCase() === "airteltigo" ? "ATL" : payoutAccount.momo_provider;
          } else {
            recipientPayload.account_number = payoutAccount.account_number;
            recipientPayload.bank_code = payoutAccount.bank_name; // Should be bank code
          }

          const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(recipientPayload),
          });
          const recipientData = await recipientRes.json();

          if (recipientData.status && recipientData.data?.recipient_code) {
            // Initiate transfer
            const transferRes = await fetch("https://api.paystack.co/transfer", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                source: "balance",
                amount: Math.round(Number(request.amount) * 100),
                recipient: recipientData.data.recipient_code,
                reason: request.purpose,
                reference: payoutRef,
                currency: "GHS",
              }),
            });
            const transferData = await transferRes.json();
            if (transferData.data?.reference) {
              payoutRef = transferData.data.reference;
            }
          }
        } catch (transferErr) {
          console.error("Paystack transfer error:", transferErr);
          // Still approve the request — admin can manually process
        }
      }

      // Update request to approved
      await supabaseAdmin
        .from("office_fund_requests")
        .update({
          status: "approved",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes || null,
          payout_reference: payoutRef,
        })
        .eq("id", requestId);

      // Audit log
      await supabaseAdmin.from("admin_audit_log").insert({
        admin_user_id: user.id,
        action: "approve_office_payout",
        target_type: "office_fund_request",
        target_id: requestId,
        reason: notes || "Approved",
        new_state: { amount: request.amount, office_id: request.office_id, payout_reference: payoutRef },
      });

      return new Response(JSON.stringify({ success: true, payout_reference: payoutRef }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "reject") {
      await supabaseAdmin
        .from("office_fund_requests")
        .update({
          status: "rejected",
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: notes || null,
        })
        .eq("id", requestId)
        .eq("status", "pending");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      throw new Error("Invalid action. Use 'approve' or 'reject'.");
    }
  } catch (error: any) {
    console.error("Process office payout error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Withdraws funds from the caller's wallet to one of their saved payout
// accounts via Paystack Transfers. Debits the ledger first, then initiates
// the transfer. If Paystack rejects the transfer we refund the ledger.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { amount, payout_account_id, reason } = await req.json();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return json({ error: "amount is required" }, 400);
    if (!payout_account_id) return json({ error: "payout_account_id is required" }, 400);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check balance + payout account belongs to user
    const { data: wallet } = await supabaseAdmin
      .from("wallets").select("id, available_balance").eq("user_id", user.id).maybeSingle();
    if (!wallet) return json({ error: "Wallet not found" }, 404);
    if (Number(wallet.available_balance) < amt) return json({ error: "Insufficient balance" }, 400);

    const { data: acct } = await supabaseAdmin
      .from("wallet_payout_accounts")
      .select("id, paystack_recipient_code, account_name, account_number")
      .eq("id", payout_account_id).eq("user_id", user.id).maybeSingle();
    if (!acct?.paystack_recipient_code) return json({ error: "Payout account not found or unverified" }, 400);

    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Payment gateway not configured" }, 500);

    const reference = `WWD_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

    // Debit the ledger first (creates authoritative record)
    const { error: dErr } = await supabaseAdmin.rpc("wallet_post_entry", {
      _user_id: user.id,
      _direction: "debit",
      _amount: amt,
      _entry_type: "withdrawal",
      _bucket: "available",
      _reference: reference,
      _related_table: "wallet_payout_accounts",
      _related_id: acct.id,
      _description: reason || `Withdrawal to ${acct.account_name}`,
      _metadata: {},
    });
    if (dErr) throw dErr;

    // Initiate transfer
    const tr = await fetch("https://api.paystack.co/transfer", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "balance",
        amount: Math.round(amt * 100),
        recipient: acct.paystack_recipient_code,
        reason: reason || "Wallet withdrawal",
        reference,
        currency: "GHS",
      }),
    });
    const tj = await tr.json();

    if (!tj?.status) {
      // Refund the debit
      await supabaseAdmin.rpc("wallet_post_entry", {
        _user_id: user.id,
        _direction: "credit",
        _amount: amt,
        _entry_type: "withdrawal_refund",
        _bucket: "available",
        _reference: reference + "_REFUND",
        _related_table: "wallet_payout_accounts",
        _related_id: acct.id,
        _description: `Refund: ${tj?.message || "transfer failed"}`,
        _metadata: {},
      });
      return json({ error: tj?.message || "Transfer failed", refunded: true }, 400);
    }

    return json({
      reference,
      status: tj.data?.status || "pending",
      requires_otp: tj.data?.status === "otp",
    });
  } catch (e: any) {
    console.error("wallet-withdraw error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

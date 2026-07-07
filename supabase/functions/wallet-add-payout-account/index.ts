// Verifies the account with Paystack, creates a transfer recipient, and
// stores it against the caller's user_id. Supports mobile money and bank.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { account_type, provider_code, provider_name, account_number, account_name } =
      await req.json();

    if (!account_type || !provider_code || !account_number) {
      return json({ error: "account_type, provider_code and account_number are required" }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Payment gateway not configured" }, 500);

    // Resolve the account for banks (mobile money resolve is limited on Paystack GH — skip and accept).
    let resolvedName: string | null = account_name || null;
    if (account_type === "bank") {
      const rr = await fetch(
        `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(account_number)}&bank_code=${encodeURIComponent(provider_code)}`,
        { headers: { Authorization: `Bearer ${key}` } },
      );
      const rj = await rr.json();
      if (rj?.status && rj?.data?.account_name) resolvedName = rj.data.account_name;
      else if (!resolvedName) return json({ error: rj?.message || "Could not verify account" }, 400);
    }
    if (!resolvedName) return json({ error: "account_name is required for mobile money" }, 400);

    // Create transfer recipient
    const rcp = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        type: account_type === "bank" ? "ghipss" : "mobile_money",
        name: resolvedName,
        account_number,
        bank_code: provider_code,
        currency: "GHS",
      }),
    });
    const rj = await rcp.json();
    if (!rj?.status) return json({ error: rj?.message || "Could not save recipient" }, 400);
    const recipientCode = rj.data?.recipient_code;

    // Insert
    const { data: existing } = await supabaseAdmin
      .from("wallet_payout_accounts")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);
    const isFirst = !existing || existing.length === 0;

    const { data: row, error } = await supabaseAdmin
      .from("wallet_payout_accounts")
      .insert({
        user_id: user.id,
        account_type,
        provider_code,
        provider_name: provider_name || null,
        account_number,
        account_name: resolvedName,
        paystack_recipient_code: recipientCode,
        is_verified: true,
        is_default: isFirst,
      })
      .select("id")
      .single();
    if (error) throw error;

    return json({ id: row.id, account_name: resolvedName });
  } catch (e: any) {
    console.error("wallet-add-payout-account error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

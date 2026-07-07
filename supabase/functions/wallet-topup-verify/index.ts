// Verifies a wallet top-up transaction with Paystack and credits the
// recipient's wallet ledger. Safe to call multiple times.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    let reference = url.searchParams.get("reference");
    if (!reference && req.method === "POST") {
      const b = await req.json();
      reference = b?.reference;
    }
    if (!reference) return json({ error: "reference is required" }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: escrow } = await supabaseAdmin
      .from("escrow_transactions")
      .select("id, status, user_id, total_amount, metadata, payment_type")
      .eq("reference", reference)
      .maybeSingle();

    if (!escrow) return json({ error: "Transaction not found" }, 404);

    // Already credited?
    if (escrow.status === "completed") {
      return json({ verified: true, status: "completed", already: true });
    }

    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Payment gateway not configured" }, 500);
    const vr = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const vj = await vr.json();
    if (!vj?.status || vj?.data?.status !== "success") {
      return json({ verified: false, status: vj?.data?.status || "not_paid" });
    }

    const amountPaid = (vj.data.amount || 0) / 100;

    // Credit the wallet via the ledger helper (SECURITY DEFINER).
    const { error: rpcError } = await supabaseAdmin.rpc("wallet_post_entry", {
      _user_id: escrow.user_id,
      _direction: "credit",
      _amount: amountPaid,
      _entry_type: "topup",
      _bucket: "available",
      _reference: reference,
      _related_table: "escrow_transactions",
      _related_id: escrow.id,
      _description: (escrow.metadata as any)?.description || "Wallet top-up",
      _metadata: { channel: vj.data.channel || null, payer_email: (escrow.metadata as any)?.payer_email || null },
    });
    if (rpcError) throw rpcError;

    // Mark escrow completed
    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed" })
      .eq("id", escrow.id);

    // If tied to a payment link, bump its counters
    const linkId = (escrow.metadata as any)?.payment_link_id;
    if (linkId) {
      const { data: link } = await supabaseAdmin
        .from("wallet_payment_links")
        .select("total_collected, payment_count")
        .eq("id", linkId)
        .maybeSingle();
      if (link) {
        await supabaseAdmin
          .from("wallet_payment_links")
          .update({
            total_collected: Number(link.total_collected || 0) + amountPaid,
            payment_count: (link.payment_count || 0) + 1,
          })
          .eq("id", linkId);
      }
    }

    return json({ verified: true, status: "completed", amount: amountPaid });
  } catch (e: any) {
    console.error("wallet-topup-verify error:", e?.message);
    return json({ error: e?.message || String(e), verified: false }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

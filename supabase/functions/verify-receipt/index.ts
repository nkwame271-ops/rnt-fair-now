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
    const { receiptNumber, reference } = await req.json();
    if (!receiptNumber && !reference) throw new Error("receiptNumber or reference is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase
      .from("payment_receipts")
      .select("receipt_number, payer_name, total_amount, payment_type, status, created_at, description");

    if (receiptNumber) {
      query = query.eq("receipt_number", receiptNumber);
    } else {
      // Look up by escrow reference
      const { data: escrow } = await supabase
        .from("escrow_transactions")
        .select("id")
        .eq("reference", reference)
        .maybeSingle();
      if (!escrow) {
        return new Response(JSON.stringify({ error: "Receipt not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = query.eq("escrow_transaction_id", escrow.id);
    }

    const { data: receipt, error } = await query.maybeSingle();

    if (error || !receipt) {
      return new Response(JSON.stringify({ error: "Receipt not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      receipt_number: receipt.receipt_number,
      payer_name: receipt.payer_name,
      total_amount: receipt.total_amount,
      payment_type: receipt.payment_type,
      status: receipt.status,
      created_at: receipt.created_at,
      description: receipt.description,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

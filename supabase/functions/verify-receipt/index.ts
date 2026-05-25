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

    // Determine whether the caller is the receipt owner (auth optional for public QR verification)
    let callerUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await userClient.auth.getUser();
      callerUserId = user?.id ?? null;
    }

    let query = supabase
      .from("payment_receipts")
      .select("receipt_number, payer_name, user_id, total_amount, payment_type, status, created_at, description");

    if (receiptNumber) {
      query = query.eq("receipt_number", receiptNumber);
    } else {
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

    const isOwner = !!callerUserId && (receipt as any).user_id === callerUserId;

    // Public/unauthenticated callers (e.g. QR scan) get the minimum needed to verify the receipt;
    // the owner sees full payer details.
    const body: Record<string, unknown> = {
      receipt_number: receipt.receipt_number,
      total_amount: receipt.total_amount,
      payment_type: receipt.payment_type,
      status: receipt.status,
      created_at: receipt.created_at,
      valid: ["paid", "completed", "success"].includes(String(receipt.status)),
    };
    if (isOwner) {
      body.payer_name = (receipt as any).payer_name;
      body.description = (receipt as any).description;
    }

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

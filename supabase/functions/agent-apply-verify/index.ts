// Verifies an agent application payment and moves the application from
// 'awaiting_payment' to 'pending' (admin review) on success.
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
    if (!reference && (req.method === "POST" || req.method === "PUT")) {
      try {
        const body = await req.json();
        reference = body?.reference || null;
      } catch (_) { /* ignore */ }
    }
    if (!reference) return json({ error: "reference is required" }, 200);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: app } = await supabaseAdmin
      .from("agent_applications")
      .select("id, payment_status, status")
      .eq("payment_reference", reference)
      .maybeSingle();
    if (!app) return json({ error: "Application not found for this reference" }, 200);
    if (app.payment_status === "paid") {
      return json({ verified: true, status: "paid", already: true, application_id: app.id });
    }

    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Payment gateway not configured" }, 200);
    const vr = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${key}` } },
    );
    const vj = await vr.json();
    if (!vj?.status || vj?.data?.status !== "success") {
      return json({ verified: false, status: vj?.data?.status || "not_paid" });
    }

    await supabaseAdmin
      .from("agent_applications")
      .update({ payment_status: "paid", status: "pending" })
      .eq("id", app.id);

    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed" })
      .eq("reference", reference);

    return json({ verified: true, status: "paid", application_id: app.id });
  } catch (e: any) {
    console.error("agent-apply-verify error:", e?.message);
    return json({ error: e?.message || String(e), verified: false }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

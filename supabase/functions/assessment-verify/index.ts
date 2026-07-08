// Verifies a property-assessment fee payment with Paystack and promotes the
// pending draft into a real property_assessment_applications row.
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

    const { data: draft } = await supabaseAdmin
      .from("pending_assessment_drafts")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();
    if (!draft) return json({ error: "Draft not found" }, 404);

    if (draft.status === "promoted") {
      return json({ verified: true, already: true, status: "promoted" });
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

    // Promote draft
    const { error: insErr, data: inserted } = await supabaseAdmin
      .from("property_assessment_applications")
      .insert({
        property_id: draft.property_id,
        requested_by: draft.user_id,
        requester_role: draft.requester_role,
        landlord_user_id: draft.requester_role === "landlord" ? draft.user_id : null,
        reason: draft.reason,
        fee_amount: draft.fee_amount,
        status: "paid",
      })
      .select("id")
      .single();
    if (insErr) throw insErr;

    await supabaseAdmin
      .from("pending_assessment_drafts")
      .update({ status: "promoted" })
      .eq("reference", reference);

    await supabaseAdmin
      .from("escrow_transactions")
      .update({ status: "completed" })
      .eq("reference", reference);

    return json({ verified: true, application_id: inserted?.id, status: "promoted" });
  } catch (e: any) {
    console.error("assessment-verify error:", e?.message);
    return json({ error: e?.message || String(e), verified: false }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

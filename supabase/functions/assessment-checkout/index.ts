// Creates a pending property-assessment draft and returns branded-checkout
// details so the payer completes payment before the assessment application
// is actually created.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const {
      property_id,
      requester_role,
      reason,
      latitude,
      longitude,
      ghana_post_gps,
      address_line,
      landmark,
    } = body || {};
    if (!requester_role) return json({ error: "requester_role is required" }, 400);
    if (!property_id && !address_line) {
      return json({ error: "Either a registered property or an address is required" }, 400);
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

    // Fee from Engine Room feature_flags
    const { data: flag } = await supabaseAdmin
      .from("feature_flags")
      .select("fee_amount, fee_enabled")
      .eq("feature_key", "property_assessment")
      .maybeSingle();
    const feeAmount = Number(flag?.fee_amount || 0);
    const feeEnabled = flag?.fee_enabled ?? true;

    const reference = `PASSMT_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

    // Create draft — will be promoted into property_assessment_applications on payment verify.
    const { error: dErr } = await supabaseAdmin.from("pending_assessment_drafts").insert({
      user_id: user.id,
      property_id: property_id || null,
      requester_role,
      reason: reason || null,
      fee_amount: feeAmount,
      reference,
      status: feeEnabled && feeAmount > 0 ? "pending_payment" : "no_fee",
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      ghana_post_gps: ghana_post_gps || null,
      address_line: address_line || null,
      landmark: landmark || null,
    });
    if (dErr) throw dErr;

    // No fee configured — promote immediately.
    if (!feeEnabled || feeAmount <= 0) {
      await promoteDraft(supabaseAdmin, reference);
      return json({ no_payment: true, reference });
    }

    const email = user.email;
    if (!email) return json({ error: "Your account needs an email address to check out." }, 400);

    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    const PAYSTACK_PUBLIC_KEY = Deno.env.get("PAYSTACK_PUBLIC_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment gateway not configured" }, 500);

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(feeAmount * 100),
        currency: "GHS",
        reference,
        metadata: {
          type: "property_assessment_fee",
          property_id,
          requester_role,
          user_id: user.id,
          description: "Property assessment fee",
        },
      }),
    });
    const initJson = await initRes.json();
    if (!initJson?.status) return json({ error: initJson?.message || "Failed to start payment" }, 400);

    // Escrow record for audit tooling
    try {
      await supabaseAdmin.from("escrow_transactions").insert({
        reference,
        user_id: user.id,
        total_amount: feeAmount,
        currency: "GHS",
        status: "pending",
        payment_type: "property_assessment_fee",
        related_property_id: property_id,
        metadata: { requester_role, reason: reason || null },
      });
    } catch (e) {
      console.warn("assessment-checkout escrow insert failed:", (e as Error).message);
    }

    return json({
      reference,
      access_code: initJson.data?.access_code,
      authorization_url: initJson.data?.authorization_url,
      publicKey: PAYSTACK_PUBLIC_KEY,
      amount: feeAmount,
      currency: "GHS",
      email,
      description: "Property assessment fee",
    });
  } catch (e: any) {
    console.error("assessment-checkout error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

async function promoteDraft(admin: any, reference: string) {
  const { data: draft } = await admin
    .from("pending_assessment_drafts")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (!draft) return;
  if (draft.status === "promoted") return;
  await admin.from("property_assessment_applications").insert({
    property_id: draft.property_id,
    requested_by: draft.user_id,
    requester_role: draft.requester_role,
    landlord_user_id: draft.requester_role === "landlord" ? draft.user_id : null,
    reason: draft.reason,
    fee_amount: draft.fee_amount,
    status: "paid",
    latitude: draft.latitude,
    longitude: draft.longitude,
    ghana_post_gps: draft.ghana_post_gps,
    address_line: draft.address_line,
    landmark: draft.landmark,
  });
  await admin.from("pending_assessment_drafts").update({ status: "promoted" }).eq("reference", reference);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

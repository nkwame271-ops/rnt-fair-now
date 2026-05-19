import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * verify-payment-proof
 * Input: { submission_id }
 * 1. Loads submission row + signed URL of the uploaded proof image
 * 2. Calls Lovable AI Gateway (gemini-3-flash-preview, multimodal) to extract fields & rate authenticity
 * 3. If reference present → calls Paystack /transaction/verify to cross-check
 * 4. Writes verdict + updates submission_status to awaiting_admin (never auto-approves)
 * 5. Notifies admins with reconcile_payment permission
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id is required");

    const { data: sub, error: subErr } = await admin
      .from("payment_proof_submissions")
      .select("*")
      .eq("id", submission_id)
      .maybeSingle();
    if (subErr || !sub) throw new Error("submission not found");

    // Signed URL for the image so the AI can fetch it
    const { data: signed } = await admin.storage
      .from("payment-proofs")
      .createSignedUrl(sub.proof_file_path, 600);
    if (!signed?.signedUrl) throw new Error("could not sign proof url");

    // Fetch image bytes and convert to data URL (gemini multimodal needs inline data)
    const imgRes = await fetch(signed.signedUrl);
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const dataUrl = `data:${contentType};base64,${b64}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI gateway not configured");

    const systemPrompt = `You are a fraud-detection assistant for a Ghanaian rent-control platform that uses Paystack.
The user uploaded a screenshot of an SMS or email they claim is a Paystack/bank payment receipt for an action they took on the platform.
Extract the fields below and judge authenticity. Return STRICT JSON only — no prose.
Schema:
{
  "sender": string | null,
  "amount": number | null,
  "currency": string | null,
  "reference": string | null,
  "transaction_id": string | null,
  "paid_at": string | null,
  "recipient": string | null,
  "card_last4": string | null,
  "looks_authentic": boolean,
  "confidence": number,          // 0..1
  "tampering_signs": string[],
  "reasoning": string
}`;

    const userClaim = `User claims: amount=${sub.claimed_amount ?? "unknown"} GHS, reference=${sub.claimed_reference ?? "unknown"}, paying for "${sub.service_type}".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userClaim },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI gateway error ${aiRes.status}: ${t.slice(0, 200)}`);
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";
    // strip code fences if any
    const cleaned = raw.replace(/```json\s*|\s*```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { reasoning: cleaned, looks_authentic: false, confidence: 0 }; }

    const extractedRef = (parsed.reference || parsed.transaction_id || sub.claimed_reference || "").toString().trim();
    const extractedAmount = Number(parsed.amount ?? sub.claimed_amount ?? 0);

    // Paystack cross-check
    let paystackStatus: string | null = null;
    let paystackBody: any = null;
    if (extractedRef) {
      try {
        const psKey = Deno.env.get("PAYSTACK_SECRET_KEY");
        if (psKey) {
          const psRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(extractedRef)}`, {
            headers: { Authorization: `Bearer ${psKey}` },
          });
          paystackBody = await psRes.json();
          paystackStatus = paystackBody?.data?.status || (paystackBody?.status ? "found" : "not_found");
        }
      } catch (e) {
        paystackStatus = "lookup_error";
        paystackBody = { error: String(e) };
      }
    } else {
      paystackStatus = "no_reference";
    }

    // Decide verdict
    let verdict: string = "needs_admin_review";
    const psAmount = paystackBody?.data?.amount ? paystackBody.data.amount / 100 : null;
    if (paystackStatus === "success" && psAmount !== null && Math.abs(psAmount - extractedAmount) < 0.5) {
      verdict = "ai_verified_high_confidence";
    } else if (paystackStatus === "failed" || paystackStatus === "abandoned" || paystackStatus === "reversed") {
      verdict = "ai_rejected_paystack_says_unpaid";
    } else if (parsed.looks_authentic === false && (parsed.confidence ?? 0) < 0.4) {
      verdict = "ai_rejected_appears_fake";
    }

    await admin.from("payment_proof_submissions").update({
      ai_verdict: verdict,
      ai_confidence: parsed.confidence ?? null,
      ai_extracted_fields: parsed,
      ai_reasoning: parsed.reasoning ?? null,
      paystack_lookup_status: paystackStatus,
      paystack_lookup_response: paystackBody,
      submission_status: "awaiting_admin",
      claimed_reference: sub.claimed_reference || extractedRef || null,
    }).eq("id", submission_id);

    // Notify admins
    const { data: admins } = await admin
      .from("admin_staff")
      .select("user_id, admin_type, payment_permissions");
    const recipients = (admins || []).filter((a: any) =>
      a.admin_type === "main_admin" || a.admin_type === "super_admin"
        || a?.payment_permissions?.reconcile_payment === true
    );
    if (recipients.length) {
      await admin.from("notifications").insert(
        recipients.map((a: any) => ({
          user_id: a.user_id,
          title: "New payment proof submitted",
          body: `A user uploaded a payment receipt for "${sub.service_type}". AI verdict: ${verdict.replace(/_/g, " ")}.`,
          link: "/regulator/payment-reconciliation",
        }))
      );
    }

    return new Response(JSON.stringify({ success: true, verdict, paystack_status: paystackStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("verify-payment-proof error", e);
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

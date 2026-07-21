// Verifies a Premium Service payment and, on success, creates the
// premium_subscriptions row and auto-assigns an approved agent (round-robin
// by region-then-least-loaded).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { reference } = await req.json();
    if (!reference) return json({ error: "reference is required" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdmin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch draft
    const { data: draft, error: dErr } = await supabaseAdmin
      .from("pending_premium_drafts")
      .select("*")
      .eq("reference", reference)
      .maybeSingle();
    if (dErr) throw dErr;
    if (!draft) return json({ error: "Draft not found" }, 404);

    // Idempotency: if already promoted, return existing subscription
    if (draft.status === "promoted") {
      const { data: existing } = await supabaseAdmin
        .from("premium_subscriptions")
        .select("*")
        .eq("payment_reference", reference)
        .maybeSingle();
      return json({ subscription: existing, already_active: true });
    }

    // Verify with Paystack
    const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Payment gateway not configured" }, 500);
    const vRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const vJson = await vRes.json();
    const paid = vJson?.data?.status === "success";
    if (!paid) return json({ error: "Payment not completed", status: vJson?.data?.status }, 400);

    // Compute expiry from billing frequency
    const now = new Date();
    const expires = new Date(now);
    if (draft.billing_frequency === "monthly") expires.setDate(expires.getDate() + 30);
    else if (draft.billing_frequency === "yearly") expires.setFullYear(expires.getFullYear() + 1);
    else expires.setDate(expires.getDate() + 30);

    // Auto-assign agent — prefer same region as the property, then least loaded.
    let agentUserId: string | null = null;
    try {
      const { data: prop } = await supabaseAdmin
        .from("properties")
        .select("region")
        .eq("id", draft.property_id)
        .maybeSingle();
      const region = prop?.region || null;

      const { data: agents } = await supabaseAdmin
        .from("agent_staff")
        .select("user_id, region, status")
        .eq("status", "active");

      const pool = (agents || []).filter((a: any) => !region || a.region === region);
      const candidates = pool.length ? pool : (agents || []);

      if (candidates.length > 0) {
        const ids = candidates.map((a: any) => a.user_id);
        const { data: loads } = await supabaseAdmin
          .from("agent_assignments")
          .select("agent_user_id")
          .in("agent_user_id", ids)
          .eq("active", true);
        const counts: Record<string, number> = {};
        ids.forEach((id: string) => counts[id] = 0);
        (loads || []).forEach((l: any) => { counts[l.agent_user_id] = (counts[l.agent_user_id] || 0) + 1; });
        agentUserId = ids.sort((a, b) => counts[a] - counts[b])[0];
      }
    } catch (e) {
      console.warn("premium-verify agent auto-assign failed:", (e as Error).message);
    }

    // Create subscription
    const { data: sub, error: sErr } = await supabaseAdmin
      .from("premium_subscriptions")
      .insert({
        property_id: draft.property_id,
        subscriber_user_id: draft.user_id,
        subscriber_role: draft.subscriber_role,
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
        yearly_fee: draft.fee_amount,
        fee_amount: draft.fee_amount,
        billing_frequency: draft.billing_frequency,
        status: "active",
        management_enabled: true,
        payment_reference: reference,
        assigned_agent_user_id: agentUserId,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    // Persist assignment record
    if (agentUserId) {
      try {
        await supabaseAdmin.from("agent_assignments").insert({
          agent_user_id: agentUserId,
          owner_user_id: draft.user_id,
          owner_role: draft.subscriber_role,
          active: true,
          scope_notes: `Premium Service — property ${draft.property_id}`,
        });
      } catch (e) {
        console.warn("premium-verify agent_assignments insert failed:", (e as Error).message);
      }
      try {
        await supabaseAdmin.from("notifications").insert([
          { user_id: agentUserId, title: "New Premium client assigned", message: `You have been assigned a new Premium Service client.`, type: "agent_assignment" },
          { user_id: draft.user_id, title: "Premium Service active", message: "Your Premium Service is active and an agent has been assigned.", type: "premium_activated" },
        ]);
      } catch { /* non-fatal */ }
    }

    // Mark escrow captured
    try {
      await supabaseAdmin.from("escrow_transactions").update({ status: "captured" }).eq("reference", reference);
    } catch { /* non-fatal */ }

    await supabaseAdmin.from("pending_premium_drafts").update({ status: "promoted" }).eq("reference", reference);

    return json({ subscription: sub, agent_user_id: agentUserId });
  } catch (e: any) {
    console.error("premium-verify error:", e?.message);
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

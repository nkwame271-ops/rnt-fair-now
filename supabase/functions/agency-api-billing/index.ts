// Agency API billing — Paystack subscription lifecycle + webhook receiver.
// Actions (admin JWT): create-checkout, cancel-subscription, change-plan, mark-paid-manual
// Public: POST /webhook (Paystack signature verified)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")!;
const PAYSTACK_BASE = "https://api.paystack.co";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function paystackFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.status === false) {
    throw new Error(body.message || `Paystack error ${res.status}`);
  }
  return body;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const url = new URL(req.url);
  const isWebhook = url.pathname.endsWith("/webhook");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ─── Paystack webhook ───
  if (isWebhook) {
    const raw = await req.text();
    const sig = req.headers.get("x-paystack-signature");
    const expected = createHmac("sha512", PAYSTACK_SECRET).update(raw).digest("hex");
    if (sig !== expected) return json({ error: "Invalid signature" }, 401);

    const event = JSON.parse(raw);
    try {
      await handleWebhook(supabase, event);
      return json({ received: true });
    } catch (e) {
      console.error("Webhook handler error:", e);
      return json({ error: (e as Error).message }, 500);
    }
  }

  // ─── Admin actions (require auth) ───
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  if (!claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

  const { data: isAdmin } = await supabase.rpc("is_main_admin", { _user_id: claims.claims.sub });
  if (!isAdmin) return json({ error: "Admin only" }, 403);

  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "create-checkout") {
      // Body: { api_key_id, plan_id, email }
      const { api_key_id, plan_id, email } = body;
      const { data: key } = await supabase.from("api_keys").select("*").eq("id", api_key_id).single();
      const { data: plan } = await supabase.from("api_pricing_plans").select("*").eq("id", plan_id).single();
      if (!key || !plan) throw new Error("Key or plan not found");
      if (plan.is_enterprise) throw new Error("Enterprise plans are activated manually");

      // Init a one-shot Paystack transaction (subscription is created from the auth on charge.success)
      const init = await paystackFetch("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: email || key.agency_contact_email,
          amount: Math.round(Number(plan.price_ghs) * 100), // pesewas
          currency: "GHS",
          metadata: {
            agency_api_key_id: api_key_id,
            agency_api_plan_id: plan_id,
            purpose: "agency_api_subscription",
          },
          callback_url: `${url.origin}/regulator/agency-api?billing=success`,
        }),
      });

      await supabase.from("api_invoices").insert({
        api_key_id, amount_ghs: plan.price_ghs, status: "pending",
        paystack_reference: init.data.reference,
        line_items: [{ description: `${plan.name} plan – monthly subscription`, amount_ghs: plan.price_ghs }],
      });

      return json({
        ok: true,
        authorization_url: init.data.authorization_url,
        access_code: init.data.access_code,
        reference: init.data.reference,
        publicKey: Deno.env.get("PAYSTACK_PUBLIC_KEY") || null,
        amount: Number(plan.price_ghs),
        currency: "GHS",
        email: email || key.agency_contact_email,
        description: `${plan.name} plan – monthly subscription`,
        invoiceId: init.data.reference,
        customerName: key.agency_name || "Agency account",
        confirmationPath: "/regulator/agency-api?billing=success",
      });
    }

    if (action === "cancel-subscription") {
      const { subscription_id } = body;
      const { data: sub } = await supabase.from("api_subscriptions").select("*").eq("id", subscription_id).single();
      if (!sub) throw new Error("Subscription not found");
      if (sub.paystack_subscription_code) {
        try {
          await paystackFetch(`/subscription/disable`, {
            method: "POST",
            body: JSON.stringify({ code: sub.paystack_subscription_code, token: sub.paystack_authorization_code }),
          });
        } catch (e) { console.warn("Paystack disable failed:", e); }
      }
      await supabase.from("api_subscriptions").update({
        status: "canceled", canceled_at: new Date().toISOString(), cancel_at_period_end: true,
      }).eq("id", subscription_id);
      return json({ ok: true });
    }

    if (action === "set-billing-override") {
      // Comp a key for free or set a custom price
      const { api_key_id, override, price_ghs } = body;
      await supabase.from("api_keys").update({
        billing_override: override || null,
        billing_override_price_ghs: price_ghs ?? null,
      }).eq("id", api_key_id);
      return json({ ok: true });
    }

    if (action === "toggle-billing-master") {
      const { enabled } = body;
      await supabase.from("platform_config")
        .update({ config_value: { enabled: !!enabled }, updated_at: new Date().toISOString() })
        .eq("config_key", "agency_api_billing_enabled");
      return json({ ok: true, enabled: !!enabled });
    }

    if (action === "assign-plan-manual") {
      // For enterprise / comped keys — no payment required.
      const { api_key_id, plan_id } = body;
      const { data: plan } = await supabase.from("api_pricing_plans").select("*").eq("id", plan_id).single();
      if (!plan) throw new Error("Plan not found");
      await activateSubscription(supabase, api_key_id, plan_id, null, null, null);
      await supabase.from("api_keys").update({
        current_plan_id: plan_id,
        rate_limit_per_minute: plan.rate_limit_per_minute,
        scopes: plan.allowed_scopes,
      }).eq("id", api_key_id);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 400);
  }
});

async function handleWebhook(supabase: any, event: any) {
  const type = event.event as string;
  console.log("Paystack webhook:", type);

  if (type === "charge.success") {
    const data = event.data;
    const meta = data.metadata || {};
    if (meta.purpose !== "agency_api_subscription") return;

    const api_key_id = meta.agency_api_key_id;
    const plan_id = meta.agency_api_plan_id;
    const authorization = data.authorization?.authorization_code;
    const customer = data.customer?.customer_code;
    const reference = data.reference;

    // Mark invoice paid
    await supabase.from("api_invoices").update({
      status: "paid", paid_at: new Date().toISOString(),
    }).eq("paystack_reference", reference);

    const { data: plan } = await supabase.from("api_pricing_plans").select("*").eq("id", plan_id).single();
    if (!plan) return;

    await activateSubscription(supabase, api_key_id, plan_id, customer, authorization, null);

    // Update key scopes/limits to plan defaults
    await supabase.from("api_keys").update({
      current_plan_id: plan_id,
      rate_limit_per_minute: plan.rate_limit_per_minute,
      scopes: plan.allowed_scopes,
      is_active: true,
    }).eq("id", api_key_id);
  }

  if (type === "subscription.create") {
    const data = event.data;
    const code = data.subscription_code;
    const customer = data.customer?.customer_code;
    await supabase.from("api_subscriptions").update({
      paystack_subscription_code: code, paystack_customer_code: customer, status: "active",
    }).eq("paystack_customer_code", customer);
  }

  if (type === "subscription.disable" || type === "invoice.payment_failed") {
    const data = event.data;
    const code = data.subscription_code || data.subscription?.subscription_code;
    if (code) {
      await supabase.from("api_subscriptions").update({
        status: type === "subscription.disable" ? "canceled" : "past_due",
        canceled_at: type === "subscription.disable" ? new Date().toISOString() : null,
      }).eq("paystack_subscription_code", code);
    }
  }
}

async function activateSubscription(
  supabase: any, api_key_id: string, plan_id: string,
  customer: string | null, authorization: string | null, subCode: string | null,
) {
  // Cancel any prior active sub
  await supabase.from("api_subscriptions")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("api_key_id", api_key_id)
    .in("status", ["trialing", "active", "past_due"]);

  const start = new Date();
  const end = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

  await supabase.from("api_subscriptions").insert({
    api_key_id, plan_id, status: "active",
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    paystack_customer_code: customer,
    paystack_authorization_code: authorization,
    paystack_subscription_code: subCode,
  });

  // Reset usage counter for the new period
  await supabase.from("api_usage_counters").insert({
    api_key_id,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    calls_count: 0,
  });
}

// Processor / Bank Reconciliation gateway.
// One endpoint per processor (`?processor=paystack`). Server-side strips the
// `platform` partition for non-Super admins so it never leaks to the client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const RECIPIENT_LABELS: Record<string, string> = {
  rent_control: "IGF (Office)",
  rent_control_hq: "IGF (HQ)",
  admin: "Admin (Office)",
  admin_hq: "Admin (HQ)",
  platform: "Platform",
  gra: "GRA",
  landlord: "Landlord",
  igf: "IGF",
  nugs: "NUGS",
  cm: "CM",
};

const SUPER_ONLY = new Set(["platform"]);

interface PaystackBalanceRow { balance: number; currency: string; pending?: number }

async function paystackGet(path: string, key: string) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Paystack ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const processor = (url.searchParams.get("processor") || "paystack").toLowerCase();
    const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
    const to = url.searchParams.get("to") || new Date().toISOString().slice(0, 10);

    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: staff } = await admin
      .from("admin_staff")
      .select("admin_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!staff) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSuperAdmin = staff.admin_type === "super_admin";

    if (processor !== "paystack") {
      return new Response(JSON.stringify({ error: `Unsupported processor: ${processor}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackKey) {
      return new Response(JSON.stringify({ error: "PAYSTACK_SECRET_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Processor-side data
    const [balanceJson, settlementsJson] = await Promise.all([
      paystackGet("/balance", paystackKey),
      paystackGet(`/settlement?from=${from}&to=${to}&perPage=200`, paystackKey),
    ]);
    const balRow: PaystackBalanceRow | undefined = Array.isArray(balanceJson?.data)
      ? balanceJson.data[0] : balanceJson?.data;
    const balance = balRow ? {
      available: Number(balRow.balance || 0) / 100,
      pending: Number(balRow.pending || 0) / 100,
      currency: balRow.currency || "GHS",
    } : null;

    const settlements = (settlementsJson?.data || []) as any[];
    const totalSettled = settlements.reduce((s, r) => s + Number(r.total_amount || r.amount || 0) / 100, 0);

    // 2) Platform-side ledger
    const { data: txns } = await admin
      .from("escrow_transactions")
      .select("id, total_amount, status, paid_at, created_at")
      .in("status", ["success", "completed", "paid"])
      .gte("created_at", `${from}T00:00:00Z`)
      .lte("created_at", `${to}T23:59:59Z`)
      .limit(5000);
    const txIds = (txns || []).map((t: any) => t.id);

    const splitsByRecipient: Record<string, { due: number; settled: number }> = {};
    if (txIds.length > 0) {
      const { data: splits } = await admin
        .from("escrow_splits")
        .select("recipient, amount, status")
        .in("escrow_transaction_id", txIds);
      for (const s of (splits || []) as any[]) {
        const k = s.recipient;
        if (!splitsByRecipient[k]) splitsByRecipient[k] = { due: 0, settled: 0 };
        const amt = Number(s.amount || 0);
        splitsByRecipient[k].due += amt;
        if (s.status === "released" || s.status === "settled" || s.status === "paid") {
          splitsByRecipient[k].settled += amt;
        }
      }
    }

    const totalCollected = (txns || []).reduce((s: number, t: any) => s + Number(t.total_amount || 0), 0);

    // 3) Build partitions — filter for non-Super
    const partitions = Object.entries(splitsByRecipient)
      .filter(([rec]) => isSuperAdmin || !SUPER_ONLY.has(rec))
      .map(([rec, v]) => ({
        recipient: rec,
        label: RECIPIENT_LABELS[rec] || rec,
        due: v.due,
        settled: v.settled,
        remaining: Math.max(0, v.due - v.settled),
      }))
      .sort((a, b) => b.due - a.due);

    // 4) Discrepancies — for non-Super, drop platform row
    const discrepancies = partitions
      .filter((p) => Math.abs(p.due - p.settled) > 0.01)
      .map((p) => ({ recipient: p.recipient, ledger: p.due, processor: p.settled, delta: p.due - p.settled }));

    // 5) Adjust headline collected when platform is hidden
    const platformShare = splitsByRecipient.platform?.due || 0;
    const headlineCollected = isSuperAdmin ? totalCollected : Math.max(0, totalCollected - platformShare);

    const body = {
      processor,
      range: { from, to },
      balance,
      total_collected: headlineCollected,
      total_settled: totalSettled,
      next_payout: null,
      partitions,
      discrepancies,
      viewer_is_super_admin: isSuperAdmin,
      generated_at: new Date().toISOString(),
    };

    return new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

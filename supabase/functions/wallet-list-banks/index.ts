// Returns a list of supported Ghana banks and mobile-money providers so the
// UI can render a dropdown when adding a payout account.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOMO = [
  { code: "MTN", name: "MTN Mobile Money" },
  { code: "VOD", name: "Vodafone Cash" },
  { code: "ATL", name: "AirtelTigo Money" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const key = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!key) return json({ error: "Payment gateway not configured" }, 500);
    const res = await fetch("https://api.paystack.co/bank?country=ghana&currency=GHS", {
      headers: { Authorization: `Bearer ${key}` },
    });
    const j = await res.json();
    const banks = (j?.data || []).map((b: any) => ({ code: b.code, name: b.name }));
    return json({ banks, mobile_money: MOMO });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 400);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

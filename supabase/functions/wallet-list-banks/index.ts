// Returns a list of supported Ghana banks and mobile-money providers so the
// UI can render a dropdown when adding a payout account. Mobile money is always
// returned; banks fall back to a curated list if Paystack is unavailable.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOMO = [
  { code: "MTN", name: "MTN Mobile Money" },
  { code: "VOD", name: "Telecel Cash (Vodafone)" },
  { code: "ATL", name: "AirtelTigo Money" },
];

// Curated fallback so the dropdown is never empty even if Paystack is down or
// the merchant account cannot list banks yet.
const FALLBACK_BANKS = [
  { code: "GCB", name: "GCB Bank" },
  { code: "ECO", name: "Ecobank Ghana" },
  { code: "STB", name: "Stanbic Bank Ghana" },
  { code: "SCB", name: "Standard Chartered Bank Ghana" },
  { code: "ABG", name: "Absa Bank Ghana" },
  { code: "ADB", name: "Agricultural Development Bank" },
  { code: "CAL", name: "CalBank" },
  { code: "FBN", name: "FBNBank Ghana" },
  { code: "FID", name: "Fidelity Bank Ghana" },
  { code: "GTB", name: "Guaranty Trust Bank Ghana" },
  { code: "NIB", name: "National Investment Bank" },
  { code: "PBL", name: "Prudential Bank" },
  { code: "REP", name: "Republic Bank Ghana" },
  { code: "SGH", name: "Societe Generale Ghana" },
  { code: "UBA", name: "United Bank for Africa Ghana" },
  { code: "UMB", name: "Universal Merchant Bank" },
  { code: "ZEN", name: "Zenith Bank Ghana" },
  { code: "ACC", name: "Access Bank Ghana" },
  { code: "CBG", name: "Consolidated Bank Ghana" },
  { code: "OMN", name: "OmniBSIC Bank" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const key = Deno.env.get("PAYSTACK_SECRET_KEY");
  let banks: { code: string; name: string }[] = FALLBACK_BANKS;
  if (key) {
    try {
      const res = await fetch("https://api.paystack.co/bank?country=ghana&currency=GHS", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const j = await res.json().catch(() => ({}));
      const live = Array.isArray(j?.data)
        ? j.data.map((b: any) => ({ code: b.code, name: b.name })).filter((b: any) => b.code && b.name)
        : [];
      if (live.length > 0) banks = live;
    } catch (e) {
      console.warn("wallet-list-banks: paystack fetch failed, using fallback:", (e as Error).message);
    }
  }
  return json({ banks, mobile_money: MOMO });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

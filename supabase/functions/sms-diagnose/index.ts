const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Read-only diagnostic: reports Arkesel account/balance status and endpoint
// reachability. Never returns or logs the API key itself.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("ARKESEL_API_KEY");
  const out: Record<string, unknown> = {
    api_key_present: Boolean(apiKey),
    api_key_length: apiKey ? apiKey.length : 0,
  };

  if (apiKey) {
    // V1 balance
    try {
      const res = await fetch(
        `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${apiKey}&response=json`,
      );
      out.v1_balance_status = res.status;
      out.v1_balance_body = (await res.text()).slice(0, 500);
    } catch (e) {
      out.v1_balance_error = e instanceof Error ? e.message : String(e);
    }

    // V2 reachability (clients/balance-details)
    try {
      const res = await fetch("https://sms.arkesel.com/api/v2/clients/balance-details", {
        headers: { "api-key": apiKey },
      });
      out.v2_status = res.status;
      out.v2_body = (await res.text()).slice(0, 500);
    } catch (e) {
      out.v2_error = e instanceof Error ? e.message : String(e);
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

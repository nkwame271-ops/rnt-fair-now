import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const k = Deno.env.get("PAYSTACK_SECRET_KEY")!;
  const h = { Authorization: `Bearer ${k}` };
  const refs = ["admincomp_5c3d292f-c561-40fc-b2c6-9f52b520b766_1791278616358", "admincomp_4811920c-be44-4aa9-84ff-b89cb5cc04f3_1791277293529"];
  const out: any = {};
  for (const r of refs) {
    const d = await (await fetch(`https://api.paystack.co/transaction/verify/${r}`, { headers: h })).json();
    out[r] = { status: d.data?.status, gw: d.data?.gateway_response, msg: d.message, email: d.data?.customer?.email, risk: d.data?.customer?.risk_action, log: d.data?.log?.history?.slice(-4) };
  }
  const c = await (await fetch(`https://api.paystack.co/customer/asedaadepa961@gmail.com`, { headers: h })).json();
  out.officer = { risk: c.data?.risk_action, msg: c.message };
  return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

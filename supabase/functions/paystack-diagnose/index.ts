import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const key = Deno.env.get('PAYSTACK_SECRET_KEY')?.trim() || '';
  const out: any = {
    has_key: key.length > 0,
    key_prefix: key.slice(0, 8),
    key_mode: key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown',
  };

  try {
    const balRes = await fetch('https://api.paystack.co/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    out.balance_http = balRes.status;
    out.balance_body = await balRes.json();
  } catch (e: any) {
    out.balance_error = e.message;
  }

  // Test init with a real email
  try {
    const initRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@paystack.com',
        amount: 3000,
        currency: 'GHS',
      }),
    });
    out.init_http = initRes.status;
    out.init_body = await initRes.json();
  } catch (e: any) {
    out.init_error = e.message;
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

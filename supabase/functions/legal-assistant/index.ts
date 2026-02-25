import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a legal assistant specializing in Ghana's Rent Act (Act 220) and tenant rights. You provide clear, helpful guidance on:
- Maximum advance rent (6 months for residential)
- Tenant rights and landlord obligations
- Eviction procedures and notice periods
- Rent increases and fair pricing
- Filing complaints with Rent Control
- Tenancy agreement requirements
- The role of the Rent Control Department

Always cite Act 220 where relevant. Be concise but thorough. Remind users this is educational guidance, not legal advice. For official legal matters, advise consulting a lawyer or visiting the Rent Control office.

Format responses clearly with bullet points where appropriate.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { question, history } = await req.json();
    
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []).map((m: any) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: question },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1024,
      }),
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process your question. Please try again.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ reply: "I'm having trouble connecting right now. Please try again or visit your nearest Rent Control office for assistance." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are the Rent Control Department's virtual assistant for Ghana. You help users with questions about:
- Tenant rights and landlord obligations under the Rent Act (Act 220)
- Maximum advance rent (6 months for residential properties)
- Eviction procedures and notice periods
- How to file complaints with Rent Control
- Rent increases and fair pricing
- Tenancy agreement registration requirements
- Using the Rent Control digital platform

IMPORTANT RULES:
1. Be friendly, concise, and cite Act 220 where relevant.
2. If the user's issue is a SPECIFIC COMPLAINT (e.g., landlord demanding excess rent, illegal eviction happening now, harassment, property damage dispute), or requires account-specific help, or is something you cannot answer, you MUST include the exact phrase "[ESCALATE]" at the END of your response after giving initial guidance.
3. For general knowledge questions about rent laws, how-to guides, and platform usage, answer directly WITHOUT escalating.
4. Always remind users this is educational guidance, not legal advice.
5. Format responses with bullet points where helpful. Keep answers under 150 words.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated caller to prevent unauthenticated AI credit abuse
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ reply: "Please sign in to chat with the assistant.", escalate: false }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ reply: "Please sign in to chat with the assistant.", escalate: false }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { question, history } = await req.json();

    if (typeof question !== "string" || question.length === 0 || question.length > 2000) {
      return new Response(JSON.stringify({ reply: "Please ask a question between 1 and 2000 characters.", escalate: false }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...safeHistory.map((m: any) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: String(m.text ?? "").slice(0, 2000),
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
        model: "google/gemini-3-flash-preview",
        messages,
        max_tokens: 512,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ reply: "I'm receiving too many requests right now. Please try again in a moment.", escalate: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ reply: "Service temporarily unavailable. Please try again later.", escalate: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 402,
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    let reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process your question. Please try again.";

    const escalate = reply.includes("[ESCALATE]");
    reply = reply.replace("[ESCALATE]", "").trim();

    return new Response(JSON.stringify({ reply, escalate }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Contact assistant error:", error);
    return new Response(JSON.stringify({
      reply: "I'm having trouble connecting right now. Please try again or use the 'Talk to an Agent' button for direct help.",
      escalate: false,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});

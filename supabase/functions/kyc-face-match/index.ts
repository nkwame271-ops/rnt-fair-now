import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ghanaCardFrontPath, selfiePath } = await req.json();

    if (!ghanaCardFrontPath || !selfiePath) {
      throw new Error("Both ghanaCardFrontPath and selfiePath are required");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.warn("LOVABLE_API_KEY not configured, skipping AI face match");
      return new Response(JSON.stringify({ match_score: 0, match_result: "pending", message: "AI matching unavailable" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to generate signed URLs for the private bucket
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: frontSigned, error: frontErr } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(ghanaCardFrontPath, 600);

    const { data: selfieSigned, error: selfieErr } = await supabase.storage
      .from("identity-documents")
      .createSignedUrl(selfiePath, 600);

    if (frontErr || selfieErr || !frontSigned?.signedUrl || !selfieSigned?.signedUrl) {
      console.error("Failed to create signed URLs:", frontErr?.message, selfieErr?.message);
      return new Response(JSON.stringify({ match_score: 0, match_result: "pending", message: "Failed to access images" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a face verification AI. Compare the face on the Ghana Card ID photo with the selfie photo. 
Analyze facial features (eyes, nose, mouth, face shape, skin tone) and determine if they are the same person.
Respond ONLY with a JSON object: {"match_score": <0-100>, "match_result": "<match|no_match|unclear>", "reason": "<brief explanation>"}
- match_score: 0-100 confidence score
- match_result: "match" if score >= 70, "no_match" if score < 40, "unclear" if 40-69
- reason: brief explanation of your assessment`
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Compare the face in these two images. The first is a Ghana Card ID photo, the second is a live selfie. Are they the same person?" },
              { type: "image_url", image_url: { url: frontSigned.signedUrl } },
              { type: "image_url", image_url: { url: selfieSigned.signedUrl } },
            ],
          },
        ],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ match_score: 0, match_result: "pending", message: "AI matching failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    let parsed = { match_score: 0, match_result: "pending", reason: "Unable to parse AI response" };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch {
      console.warn("Failed to parse AI response:", content);
    }

    console.log("Face match result:", JSON.stringify(parsed));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Face match error:", error.message);
    return new Response(JSON.stringify({ match_score: 0, match_result: "pending", error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

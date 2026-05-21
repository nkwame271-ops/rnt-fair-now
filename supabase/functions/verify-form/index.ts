import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let code: string | null = null;
    if (req.method === "GET") {
      code = new URL(req.url).searchParams.get("code");
    } else {
      const body = await req.json().catch(() => ({}));
      code = body?.code ?? null;
    }
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: doc, error: docErr } = await supabase
      .from("complaint_documents")
      .select(
        "form_type, version_number, status, generated_at, finalized_at, title, case_id, case_kind, verification_code",
      )
      .eq("verification_code", code.toUpperCase())
      .maybeSingle();

    if (docErr) {
      return new Response(JSON.stringify({ error: docErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pull a minimal slice of case context.
    let caseCtx: any = null;
    try {
      const table =
        doc.case_kind === "landlord_complaints"
          ? "landlord_complaints"
          : "complaints";
      const selectCols =
        table === "landlord_complaints"
          ? "complaint_code, ticket_number, complaint_type, status, current_stage, created_at, placeholder_landlord_name, tenant_name"
          : "complaint_code, ticket_number, complaint_type, status, current_stage, created_at, landlord_name, placeholder_complainant_name";

      const [{ data: c }, { data: caseRow }] = await Promise.all([
        (supabase.from(table) as any)
          .select(selectCols)
          .eq("id", doc.case_id)
          .maybeSingle(),
        supabase
          .from("cases")
          .select("case_number")
          .eq("related_complaint_id", doc.case_id)
          .maybeSingle(),
      ]);
      if (c) caseCtx = { ...c, case_number: caseRow?.case_number || null, table };
    } catch {
      /* ignore — still return the doc */
    }

    return new Response(JSON.stringify({ doc, caseCtx }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

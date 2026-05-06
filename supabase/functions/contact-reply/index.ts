import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function emailLayout(content: string, subject: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <tr><td>
      <div style="font-weight:700;color:#1f6f4a;font-size:18px;margin-bottom:16px;">Rent Control Ghana</div>
      <div style="white-space:pre-wrap;line-height:1.55;font-size:14px;">${content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
      <div style="font-size:12px;color:#64748b;">Rent Control Ghana · rentcontrolghana.com</div>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    // No mail provider configured — log only, treat as soft success so reply still records
    console.warn("RESEND_API_KEY not configured; email will not be dispatched (logged only).");
    return { ok: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RentControlGhana <noreply@notify.rentcontrolghana.com>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: `Resend ${r.status}: ${text.slice(0, 200)}` };
    }
    await r.text();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Two-client pattern: user client validates auth + admin permission via RLS-aware RPC
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await userClient.rpc("is_main_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden — main admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { submission_id, channel, subject, body: messageBody, template_used } = body || {};

    if (!submission_id || !channel || !messageBody || (channel !== "email" && channel !== "sms")) {
      return new Response(JSON.stringify({ error: "submission_id, channel (email|sms), and body are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof messageBody !== "string" || messageBody.length > 5000) {
      return new Response(JSON.stringify({ error: "Message body too long" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: submission, error: subErr } = await admin
      .from("contact_submissions")
      .select("id, name, email, phone")
      .eq("id", submission_id)
      .single();

    if (subErr || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dispatchResult: any = { channel };
    let dispatchError: string | null = null;

    if (channel === "email") {
      if (!submission.email) {
        return new Response(JSON.stringify({ error: "Submission has no email address on file" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const finalSubject = subject || "Reply from Rent Control Ghana";
      const html = emailLayout(messageBody, finalSubject);
      const r = await sendEmailViaResend(submission.email, finalSubject, html);
      if (!r.ok) dispatchError = r.error || "Email dispatch failed";
      dispatchResult.to = submission.email;
    } else {
      if (!submission.phone) {
        return new Response(JSON.stringify({ error: "Submission has no phone number on file" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
        body: { phone: submission.phone, message: messageBody.slice(0, 480) },
      });
      const smsBody: any = smsData || {};
      if (smsErr || smsBody?.error || smsBody?.success === false) {
        dispatchError = "SMS dispatch failed: " + (smsBody?.error || smsErr?.message || "Unknown SMS provider error");
      }
      dispatchResult.to = submission.phone;
    }

    // Always log the reply attempt — even if dispatch failed (admin can retry)
    const { data: replyRow, error: insErr } = await admin
      .from("contact_message_replies")
      .insert({
        submission_id,
        replied_by: user.id,
        channel,
        subject: subject || null,
        body: messageBody,
        template_used: template_used || null,
      })
      .select()
      .single();

    if (insErr) console.error("Reply log insert error", insErr);

    if (dispatchError) {
      return new Response(JSON.stringify({
        success: false,
        error: dispatchError,
        reply_logged: !!replyRow,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, reply: replyRow, dispatch: dispatchResult }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("contact-reply error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

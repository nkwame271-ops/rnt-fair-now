import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FROM_ADDRESS, ROOT_DOMAIN } from "../_shared/project-domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function emailLayout(content: string, subject: string) {
  const safe = content.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${subject}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <tr><td>
      <div style="font-weight:700;color:#1f6f4a;font-size:18px;margin-bottom:16px;">Rent Control Ghana</div>
      <div style="white-space:pre-wrap;line-height:1.55;font-size:14px;">${safe}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
      <div style="font-size:12px;color:#64748b;">Rent Control Ghana · ${ROOT_DOMAIN}</div>
    </td></tr>
  </table>
</body></html>`;
}

async function sendEmailViaResend(to: string, subject: string, html: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured; email logged only.");
    return { ok: true };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to], subject, html,
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: `Resend ${r.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ALWAYS return HTTP 200; carry errors in payload so supabase-js doesn't trip on non-2xx.
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing authorization header" });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Unauthorized — please sign in again" });

    const { data: isAdmin } = await userClient.rpc("is_main_admin", { _user_id: user.id });
    if (!isAdmin) return json({ success: false, error: "Forbidden — main admin only" });

    const body = await req.json().catch(() => ({}));
    const submission_id = body?.submission_id;
    const channel = body?.channel;
    const subject = body?.subject;
    const messageBody: string = (body?.body || "").toString().trim();
    const template_used = body?.template_used;

    if (!submission_id) return json({ success: false, error: "submission_id is required" });
    if (channel !== "email" && channel !== "sms")
      return json({ success: false, error: "channel must be 'email' or 'sms'" });
    if (!messageBody) return json({ success: false, error: "Message body is required" });
    if (messageBody.length > 5000)
      return json({ success: false, error: "Message body too long (max 5000 chars)" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: submission, error: subErr } = await admin
      .from("contact_submissions")
      .select("id, name, email, phone")
      .eq("id", submission_id)
      .maybeSingle();

    if (subErr) return json({ success: false, error: `Could not load submission: ${subErr.message}` });
    if (!submission) return json({ success: false, error: "Submission not found" });

    let dispatchTo: string | null = null;
    let dispatchError: string | null = null;

    if (channel === "email") {
      if (!submission.email) return json({ success: false, error: "This contact has no email address on file" });
      const finalSubject = subject || "Reply from Rent Control Ghana";
      const r = await sendEmailViaResend(submission.email, finalSubject, emailLayout(messageBody, finalSubject));
      if (!r.ok) dispatchError = r.error || "Email dispatch failed";
      dispatchTo = submission.email;
    } else {
      if (!submission.phone) return json({ success: false, error: "This contact has no phone number on file" });
      try {
        const { data: smsData, error: smsErr } = await admin.functions.invoke("send-sms", {
          body: { phone: submission.phone, message: messageBody.slice(0, 480) },
        });
        const smsBody: any = smsData || {};
        if (smsErr || smsBody?.error || smsBody?.success === false) {
          dispatchError = "SMS dispatch failed: " + (smsBody?.error || smsErr?.message || "Unknown SMS provider error");
        }
      } catch (e) {
        dispatchError = "SMS dispatch failed: " + (e instanceof Error ? e.message : String(e));
      }
      dispatchTo = submission.phone;
    }

    // Always log the reply attempt (admin can retry)
    let replyRow: any = null;
    try {
      const { data, error: insErr } = await admin
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
      if (insErr) console.error("Reply log insert error", insErr.message);
      else replyRow = data;
    } catch (e) {
      console.error("Reply log threw", e);
    }

    if (dispatchError) {
      return json({ success: false, error: dispatchError, reply_logged: !!replyRow, reply: replyRow });
    }

    return json({ success: true, reply: replyRow, dispatch: { channel, to: dispatchTo } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("contact-reply unhandled error", msg);
    return json({ success: false, error: msg });
  }
});

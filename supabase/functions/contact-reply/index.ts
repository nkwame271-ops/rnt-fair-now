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
      <div style="white-space:pre-wrap;line-height:1.55;font-size:14px;">${content}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 12px;" />
      <div style="font-size:12px;color:#64748b;">Rent Control Ghana · rentcontrolghana.com</div>
    </td></tr>
  </table>
</body></html>`;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("is_main_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
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

    let dispatchResult: any = {};

    if (channel === "email") {
      if (!submission.email) {
        return new Response(JSON.stringify({ error: "Submission has no email" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const finalSubject = subject || "Reply from Rent Control Ghana";
      const messageId = crypto.randomUUID();
      await admin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "contact_reply",
        recipient_email: submission.email,
        status: "pending",
      });
      const { error: eqErr } = await admin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: submission.email,
          from: "RentControlGhana <noreply@notify.rentcontrolghana.com>",
          sender_domain: "notify.rentcontrolghana.com",
          subject: finalSubject,
          html: emailLayout(messageBody, finalSubject),
          text: messageBody,
          purpose: "transactional",
          label: "contact_reply",
          queued_at: new Date().toISOString(),
        },
      });
      if (eqErr) console.error("enqueue_email error", eqErr);
      dispatchResult = { channel: "email", to: submission.email };
    } else {
      if (!submission.phone) {
        return new Response(JSON.stringify({ error: "Submission has no phone" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: smsErr } = await admin.functions.invoke("send-sms", {
        body: { phone: submission.phone, message: messageBody.slice(0, 480) },
      });
      if (smsErr) {
        return new Response(JSON.stringify({ error: "SMS dispatch failed: " + smsErr.message }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      dispatchResult = { channel: "sms", to: submission.phone };
    }

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

    if (insErr) {
      console.error("Reply log insert error", insErr);
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

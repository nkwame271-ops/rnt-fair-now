import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { FROM_ADDRESS, SENDER_DOMAIN } from "../_shared/project-domain.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Channel routing ──
type Channel = "sms" | "email" | "inapp";

const CHANNEL_MAP: Record<string, Channel[]> = {
  // Both SMS + Email + In-App
  account_created:       ["sms", "email", "inapp"],
  password_reset:        ["sms", "email", "inapp"],
  contact_changed:       ["sms", "email", "inapp"],
  recovery_completed:    ["sms", "email", "inapp"],
  payment_successful:    ["sms", "email", "inapp"],
  escrow_released:       ["sms", "email", "inapp"],
  tenancy_registered:    ["sms", "email", "inapp"],
  rent_card_verified:    ["sms", "email", "inapp"],
  fraud_alert:           ["sms", "email", "inapp"],
  // SMS only (+ in-app where applicable)
  otp:                   ["sms"],
  login_alert:           ["sms", "inapp"],
  tenancy_expiry_reminder: ["sms", "inapp"],
  complaint_reminder:    ["sms", "inapp"],
  // Email only (+ in-app)
  full_receipt:          ["email", "inapp"],
  tenancy_agreement:     ["email", "inapp"],
  rent_card_copy:        ["email", "inapp"],
  complaint_summary:     ["email", "inapp"],
  contact_received:      ["email"],
  beta_feedback_received:["email"],
  developer_account_created:       ["email", "inapp"],
  developer_account_created_admin: ["email", "inapp"],
};

// ── SMS Templates ──
const SMS_TEMPLATES: Record<string, (d: Record<string, string>) => string> = {
  account_created: (d) =>
    `RentControlGhana: Welcome ${d.name || ""}. Your account ID is ${d.id}. Sign in to your dashboard at rentcontrolghana.com using your phone number — temporary password is your full phone number. Please change it after login. Visit the nearest rent control office for assistance.`,
  password_reset: (d) =>
    `Your password has been changed successfully. If you did not perform this action, contact support immediately.`,
  contact_changed: () =>
    `Your account contact details have been updated. If this was not you, contact support immediately.`,
  recovery_completed: () =>
    `Your account recovery has been completed successfully. Please log in and update your password.`,
  payment_successful: (d) =>
    `Your payment of GHS ${d.amount} has been received successfully. Receipt ID: ${d.receipt_id}.`,
  escrow_released: (d) =>
    `Your rent payment of GHS ${d.amount} has been released to your account.`,
  tenancy_registered: (d) =>
    `Your tenancy has been registered successfully. Tenancy ID: ${d.tenancy_id}.`,
  rent_card_verified: () =>
    `Your rent card has been verified and is now active.`,
  fraud_alert: () =>
    `We detected unusual activity on your account. Please log in immediately or contact support.`,
  otp: (d) =>
    `Your RentControlGhana verification code is ${d.code}. Do not share this code.`,
  login_alert: () =>
    `A new login to your RentControlGhana account was detected. If this was not you, change your password immediately.`,
  tenancy_expiry_reminder: (d) =>
    `RentControl: Your tenancy${d.property ? " at " + d.property : ""} expires in ${d.days_left} days. Request a renewal or plan your exit.`,
  complaint_reminder: (d) =>
    `RentControl: Your complaint (${d.code}) is still pending review. We will update you on progress.`,
};

// ── Email Templates ──
const EMAIL_TEMPLATES: Record<string, (d: Record<string, string>) => { subject: string; html: string }> = {
  account_created: (d) => ({
    subject: "Your RentControlGhana Account Has Been Created",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your account has been created successfully.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">ID:</td><td style="padding:4px 0;">${d.id}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone:</td><td style="padding:4px 0;">${d.phone || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Password:</td><td style="padding:4px 0;">your full phone number</td></tr>
      </table>
      <p>Please log in and change your password immediately.</p>
    `),
  }),
  password_reset: (d) => ({
    subject: "Password Changed — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your password has been changed successfully.</p>
      <p>If you did not perform this action, contact support immediately.</p>
    `),
  }),
  contact_changed: (d) => ({
    subject: "Contact Details Updated — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your contact details have been updated.</p>
      <p>If this was not you, contact support immediately.</p>
    `),
  }),
  recovery_completed: (d) => ({
    subject: "Account Recovery Completed — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your account recovery has been completed.</p>
      <p>Please log in and change your password.</p>
    `),
  }),
  payment_successful: (d) => ({
    subject: "Payment Successful — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your payment has been processed successfully.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Amount:</td><td style="padding:4px 0;">GHS ${d.amount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Receipt ID:</td><td style="padding:4px 0;">${d.receipt_id}</td></tr>
      </table>
      <p>Please log in to view details.</p>
    `),
  }),
  escrow_released: (d) => ({
    subject: "Escrow Released — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your rent payment of GHS ${d.amount} has been released to your account.</p>
      <p>Please log in to view details.</p>
    `),
  }),
  tenancy_registered: (d) => ({
    subject: "Tenancy Registered — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your tenancy has been registered.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Tenancy ID:</td><td style="padding:4px 0;">${d.tenancy_id}</td></tr>
      </table>
      <p>Please log in to view details.</p>
    `),
  }),
  rent_card_verified: (d) => ({
    subject: "Rent Card Verified — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your rent card has been verified and is now active.</p>
    `),
  }),
  fraud_alert: (d) => ({
    subject: "⚠ Security Alert — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p><strong>We detected unusual activity on your account.</strong></p>
      <p>Please log in immediately or contact support.</p>
    `),
  }),
  full_receipt: (d) => ({
    subject: "Payment Receipt — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your payment receipt is ready.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Amount:</td><td style="padding:4px 0;">GHS ${d.amount}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Receipt:</td><td style="padding:4px 0;">${d.receipt_id}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Description:</td><td style="padding:4px 0;">${d.description || ""}</td></tr>
      </table>
      <p>Please log in to download the full receipt.</p>
    `),
  }),
  tenancy_agreement: (d) => ({
    subject: "Tenancy Agreement — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>A tenancy agreement (${d.tenancy_id}) has been ${d.action || "created"}.</p>
      <p>Property: ${d.property || "N/A"}</p>
      <p>Please log in to review the details.</p>
    `),
  }),
  rent_card_copy: (d) => ({
    subject: "Rent Card Details — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your rent card details are available. Please log in to view and download your rent card.</p>
    `),
  }),
  complaint_summary: (d) => ({
    subject: "Complaint Summary — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "User"},</p>
      <p>Your complaint (${d.code}) has been filed.</p>
      <p>Type: ${d.type || "N/A"}</p>
      <p>Status: ${d.status || "submitted"}</p>
      <p>Please log in for details and updates.</p>
    `),
  }),
  contact_received: (d) => ({
    subject: `New Contact Message — ${d.name || "User"}`,
    html: emailLayout(`
      <p><strong>New contact form submission</strong></p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">From:</td><td style="padding:4px 0;">${d.name || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Email:</td><td style="padding:4px 0;">${d.from_email || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Phone:</td><td style="padding:4px 0;">${d.phone || "—"}</td></tr>
      </table>
      <p style="white-space:pre-wrap;border-left:3px solid #2d7a4f;padding:8px 12px;background:#f7faf8;">${d.message || ""}</p>
      <p>Reply via the Regulator Feedback portal.</p>
    `),
  }),
  beta_feedback_received: (d) => ({
    subject: `Beta Feedback (${d.category || "general"}) — ${d.from_email || "user"}`,
    html: emailLayout(`
      <p><strong>New beta feedback submitted</strong></p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Category:</td><td style="padding:4px 0;">${d.category || "general"}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">From:</td><td style="padding:4px 0;">${d.from_email || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Page:</td><td style="padding:4px 0;">${d.page_url || ""}</td></tr>
      </table>
      <p style="white-space:pre-wrap;border-left:3px solid #2d7a4f;padding:8px 12px;background:#f7faf8;">${d.message || ""}</p>
    `),
  }),
  developer_account_created: (d) => ({
    subject: "Your developer account is ready — RentControlGhana",
    html: emailLayout(`
      <p>Hello ${d.name || "there"},</p>
      <p>Your developer account for <strong>${d.org_name || "your organization"}</strong> has been created.</p>
      <p><strong>Access tiers</strong></p>
      <ul>
        <li><strong>Sandbox</strong> — issued automatically. Use it to build and test against safe synthetic data.</li>
        <li><strong>Live (production)</strong> — requires admin approval. Submit a request from your dashboard and sign the Data Sharing Agreement; a regulator will review within 1–3 business days.</li>
      </ul>
      <p>Sign in at <a href="https://www.rentcontrolghana.com/developers/login">rentcontrolghana.com/developers/login</a> to create your sandbox key and read the quickstart.</p>
    `),
  }),
  developer_account_created_admin: (d) => ({
    subject: `New developer signup — ${d.org_name || "Unknown org"}`,
    html: emailLayout(`
      <p><strong>A new developer account has been created.</strong></p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Organization:</td><td style="padding:4px 0;">${d.org_name || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Contact:</td><td style="padding:4px 0;">${d.contact_email || ""}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666;">Agency type:</td><td style="padding:4px 0;">${d.agency_type || "—"}</td></tr>
      </table>
      <p style="white-space:pre-wrap;border-left:3px solid #2d7a4f;padding:8px 12px;background:#f7faf8;">${d.use_case || ""}</p>
      <p>Sandbox keys are auto-issued. Live access still requires your approval. Review the account at <a href="https://www.rentcontrolghana.com/regulator/developer-accounts">Regulator → Developer Accounts</a>.</p>
    `),
  }),
};

// ── In-App notification titles/bodies ──
const INAPP_TEMPLATES: Record<string, (d: Record<string, string>) => { title: string; body: string; link?: string }> = {
  account_created: (d) => ({ title: "Welcome!", body: `Your ${d.role || ""} account has been created. ID: ${d.id}`, link: "/" }),
  password_reset: () => ({ title: "Password Changed", body: "Your password was changed successfully.", link: "/profile" }),
  contact_changed: () => ({ title: "Contact Details Updated", body: "Your contact details have been updated.", link: "/profile" }),
  recovery_completed: () => ({ title: "Account Recovered", body: "Your account recovery is complete.", link: "/" }),
  payment_successful: (d) => ({ title: "Payment Confirmed", body: `Payment of GHS ${d.amount} confirmed. Receipt: ${d.receipt_id}`, link: "/tenant/payments" }),
  escrow_released: (d) => ({ title: "Escrow Released", body: `GHS ${d.amount} has been released to your account.`, link: "/landlord/dashboard" }),
  tenancy_registered: (d) => ({ title: "Tenancy Registered", body: `Tenancy ${d.tenancy_id} registered successfully.`, link: "/tenant/my-agreements" }),
  rent_card_verified: () => ({ title: "Rent Card Active", body: "Your rent card has been verified and is now active.", link: "/landlord/rent-cards" }),
  fraud_alert: () => ({ title: "⚠ Security Alert", body: "Unusual activity detected on your account.", link: "/profile" }),
  login_alert: () => ({ title: "New Login Detected", body: "A new login was detected on your account.", link: "/profile" }),
  tenancy_expiry_reminder: (d) => ({ title: "Tenancy Expiring Soon", body: `Your tenancy${d.property ? " at " + d.property : ""} expires in ${d.days_left} days.`, link: "/tenant/renewal" }),
  complaint_reminder: (d) => ({ title: "Complaint Update", body: `Your complaint (${d.code}) is still pending review.`, link: "/tenant/my-cases" }),
  full_receipt: (d) => ({ title: "Receipt Ready", body: `Your receipt for GHS ${d.amount} is ready.`, link: "/tenant/receipts" }),
  tenancy_agreement: (d) => ({ title: "Tenancy Agreement", body: `Agreement ${d.tenancy_id} has been ${d.action || "created"}.`, link: "/tenant/my-agreements" }),
  rent_card_copy: () => ({ title: "Rent Card Available", body: "Your rent card details are available.", link: "/landlord/rent-cards" }),
  complaint_summary: (d) => ({ title: "Complaint Filed", body: `Complaint ${d.code} has been submitted.`, link: "/tenant/my-cases" }),
  contact_received: (d) => ({ title: "New Contact Message", body: `${d.name || "User"} (${d.from_email || ""}): ${(d.message || "").slice(0, 80)}`, link: "/regulator/feedback" }),
  beta_feedback_received: (d) => ({ title: `Beta Feedback (${d.category || "general"})`, body: `${d.from_email || ""}: ${(d.message || "").slice(0, 80)}`, link: "/regulator/feedback" }),
  developer_account_created: (d) => ({ title: "Developer account ready", body: `Sandbox key is yours; live access needs admin approval. Org: ${d.org_name || ""}`, link: "/developers/dashboard" }),
  developer_account_created_admin: (d) => ({ title: "New developer signup", body: `${d.org_name || "Unknown"} (${d.contact_email || ""}) just signed up.`, link: "/regulator/developer-accounts" }),
};

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;max-width:100%;">
  <tr><td style="background-color:#2d7a4f;padding:24px 32px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:700;">RentControlGhana</h1>
  </td></tr>
  <tr><td style="padding:32px;color:#1a1a1a;font-size:15px;line-height:1.6;">
    ${content}
  </td></tr>
  <tr><td style="padding:16px 32px 24px;color:#666;font-size:13px;border-top:1px solid #e5e5e5;">
    <p style="margin:0;">Regards,<br/><strong>RentControlGhana</strong></p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

// ── Phone normalization ──
function normalizePhone(phone: string): string {
  let p = phone.replace(/\s/g, "").replace(/^0/, "233");
  if (!p.startsWith("233")) p = "233" + p;
  return p;
}

// ── SMS sender (with sender ID fallback chain) ──
const SMS_SENDER_FALLBACKS = ["RentControl", "R Control"];

export type SmsFailureReason =
  | "no_api_key"
  | "sender_rejected"
  | "insufficient_balance"
  | "invalid_recipient"
  | "provider_unreachable"
  | "provider_error";

type SmsError = { reason: SmsFailureReason; message: string; sender_tried?: string };

type SmsOutcome =
  | { ok: true; state: "sent" | "unconfirmed"; via: string; sender: string; message_id?: string }
  | { ok: false; state: "failed"; error: SmsError };

const REASON_TEXT: Record<SmsFailureReason, string> = {
  no_api_key: "SMS provider is not configured (missing API key).",
  sender_rejected: "The SMS sender ID is not approved by the provider.",
  insufficient_balance: "The SMS account has insufficient credit.",
  invalid_recipient: "The phone number was rejected as invalid or unroutable.",
  provider_unreachable: "The SMS provider could not be reached.",
  provider_error: "The SMS provider returned an error.",
};

function maskPhone(p: string): string {
  return p.length <= 5 ? "***" : p.slice(0, 5) + "****" + p.slice(-2);
}

function classifyArkesel(raw: string): SmsFailureReason {
  const m = (raw || "").toLowerCase();
  if (
    m.includes("not allowed to use this sender id") ||
    m.includes('"code":"111"') ||
    m.includes("code: 111") ||
    m.includes("sender id")
  ) return "sender_rejected";
  if (
    m.includes("insufficient") ||
    m.includes("no credit") ||
    m.includes("low balance") ||
    m.includes("out of credit") ||
    m.includes('"code":"105"') ||
    m.includes('"code":"106"')
  ) return "insufficient_balance";
  if (
    m.includes("invalid recipient") ||
    m.includes("invalid phone") ||
    m.includes("invalid number") ||
    m.includes("no recipient") ||
    m.includes('"code":"103"') ||
    m.includes('"code":"104"')
  ) return "invalid_recipient";
  if (
    m.includes("dns") ||
    m.includes("nxdomain") ||
    m.includes("failed to fetch") ||
    m.includes("error sending request") ||
    m.includes("connection") ||
    m.includes("timed out") ||
    m.includes("timeout") ||
    m.includes("network")
  ) return "provider_unreachable";
  return "provider_error";
}

// Pull the provider's message/campaign id out of either API shape.
function extractMessageId(payload: unknown): string | undefined {
  if (!payload) return undefined;
  if (typeof payload === "string") {
    const m = payload.match(/"(?:message_id|campaign_id|id)"\s*:\s*"?([\w-]+)"?/i);
    return m ? m[1] : undefined;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, any>;
    const direct = o.message_id || o.campaign_id || o.id;
    if (direct) return String(direct);
    const arr = Array.isArray(o.data) ? o.data : undefined;
    if (arr && arr.length) {
      const first = arr[0] || {};
      const nested = first.id || first.message_id || first.recipient;
      if (nested) return String(nested);
    }
    if (o.data && typeof o.data === "object") {
      const d = o.data as Record<string, any>;
      const nested = d.message_id || d.campaign_id || d.id;
      if (nested) return String(nested);
    }
  }
  return undefined;
}

async function trySendWithSender(
  apiKey: string,
  normalized: string,
  message: string,
  sender: string,
): Promise<{ ok: boolean; via?: string; message_id?: string; raw?: string; error?: SmsError }> {
  let v2Error = "";
  try {
    console.log(`Trying Arkesel V2 with sender "${sender}"...`);
    const res = await fetch("https://sms.arkesel.com/api/v2/sms/send", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, message, recipients: [normalized] }),
    });
    const data = await res.json();
    if (data.status !== "success") {
      throw new Error(typeof data.message === "string" ? data.message : JSON.stringify(data));
    }
    return { ok: true, via: "v2", message_id: extractMessageId(data), raw: JSON.stringify(data) };
  } catch (v2Err) {
    v2Error = v2Err instanceof Error ? v2Err.message : String(v2Err);
    console.warn(`V2 failed for "${sender}":`, v2Error, "— trying V1...");
  }
  try {
    const params = new URLSearchParams({
      action: "send-sms",
      api_key: apiKey,
      to: normalized,
      from: sender,
      sms: message,
    });
    const res = await fetch(`https://sms.arkesel.com/sms/api?${params.toString()}`);
    const text = await res.text();
    console.log(`V1 response for "${sender}":`, text);
    if (!res.ok) throw new Error("V1 HTTP " + res.status + ": " + text);
    if (text.includes('"code":"111"') || text.toLowerCase().includes("not allowed")) {
      throw new Error("V1 sender rejected: " + text);
    }
    const lower = text.toLowerCase();
    if (lower.includes("error") || lower.includes("fail")) {
      throw new Error("V1 reported failure: " + text.slice(0, 200));
    }
    return { ok: true, via: "v1", message_id: extractMessageId(text), raw: text.slice(0, 200) };
  } catch (v1Err) {
    const v1Msg = v1Err instanceof Error ? v1Err.message : String(v1Err);
    // Prefer whichever response actually names a cause; sender rejection wins.
    const v2Reason = classifyArkesel(v2Error);
    const v1Reason = classifyArkesel(v1Msg);
    const reason =
      v2Reason === "sender_rejected" || v1Reason === "sender_rejected"
        ? "sender_rejected"
        : v1Reason !== "provider_error"
          ? v1Reason
          : v2Reason;
    return {
      ok: false,
      error: {
        reason,
        message: `${REASON_TEXT[reason]} Provider said — V2: ${v2Error || "n/a"} | V1: ${v1Msg || "n/a"}`,
        sender_tried: sender,
      },
    };
  }
}

async function sendSms(phone: string, message: string): Promise<SmsOutcome> {
  const ARKESEL_API_KEY = Deno.env.get("ARKESEL_API_KEY");
  if (!ARKESEL_API_KEY) {
    const error: SmsError = { reason: "no_api_key", message: REASON_TEXT.no_api_key };
    console.error("SMS FAILED", JSON.stringify({ ...error, recipient: maskPhone(phone) }));
    return { ok: false, state: "failed", error };
  }
  const normalized = normalizePhone(phone);
  let lastError: SmsError = { reason: "provider_error", message: REASON_TEXT.provider_error };

  for (const candidate of SMS_SENDER_FALLBACKS) {
    const result = await trySendWithSender(ARKESEL_API_KEY, normalized, message, candidate);
    if (result.ok) {
      // Provider accepted the message. Without a message/campaign id we cannot
      // claim delivery — treat it as unconfirmed so callers can warn the user.
      if (!result.message_id) {
        console.warn(
          "SMS ACCEPTED WITHOUT ID",
          JSON.stringify({
            sender: candidate,
            via: result.via,
            recipient: maskPhone(normalized),
            raw: result.raw,
          }),
        );
        return { ok: true, state: "unconfirmed", via: result.via!, sender: candidate };
      }
      console.log(`SMS sent via ${result.via} using sender "${candidate}" (id: ${result.message_id})`);
      return { ok: true, state: "sent", via: result.via!, sender: candidate, message_id: result.message_id };
    }

    lastError = result.error!;
    console.error(
      "SMS FAILED",
      JSON.stringify({
        reason: lastError.reason,
        sender_tried: candidate,
        recipient: maskPhone(normalized),
        provider_message: lastError.message,
      }),
    );
    if (lastError.reason !== "sender_rejected") break; // only sender issues are worth retrying
    console.warn(`Sender "${candidate}" rejected — trying next...`);
  }

  return { ok: false, state: "failed", error: lastError };
}

// ── Email enqueue ──
async function enqueueEmail(supabase: any, to: string, subject: string, html: string): Promise<void> {
  try {
    const messageId = crypto.randomUUID();
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "notification",
      recipient_email: to,
      status: "pending",
    });
    const { error } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to,
        from: FROM_ADDRESS,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: subject,
        purpose: "transactional",
        label: "notification",
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) console.error("Email enqueue error:", error);
  } catch (e) {
    console.error("Email enqueue failed:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event, phone, email, user_id, data } = await req.json();

    if (!event) {
      return new Response(JSON.stringify({ error: "event is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channels = CHANNEL_MAP[event] || ["inapp"];
    const d: Record<string, string> = data || {};

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: Record<string, string> = {};

    // SMS
    let sms_error: SmsError | undefined;
    let sms_error_text: string | undefined;
    let sms_message_id: string | undefined;
    if (channels.includes("sms") && phone) {
      const template = SMS_TEMPLATES[event];
      if (template) {
        const smsResult = await sendSms(phone, template(d));
        results.sms = smsResult.state;
        if (smsResult.ok) {
          sms_message_id = smsResult.message_id;
          if (smsResult.state === "unconfirmed") {
            sms_error_text =
              "The SMS provider accepted the message but returned no delivery reference, so delivery is unconfirmed.";
          }
        } else {
          sms_error = smsResult.error;
          sms_error_text = smsResult.error.message;
        }
      }
    }

    // Email
    if (channels.includes("email") && email) {
      const template = EMAIL_TEMPLATES[event];
      if (template) {
        const { subject, html } = template(d);
        await enqueueEmail(supabase, email, subject, html);
        results.email = "enqueued";
      }
    }

    // In-App
    if (channels.includes("inapp") && user_id) {
      const template = INAPP_TEMPLATES[event];
      if (template) {
        const { title, body, link } = template(d);
        await supabase.from("notifications").insert({
          user_id,
          title,
          body,
          link: link || "/",
        });
        results.inapp = "inserted";
      }
    }

    return new Response(
      JSON.stringify({ success: true, channels: results, sms_error, sms_error_text, sms_message_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("Notification error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

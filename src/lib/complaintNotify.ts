import { supabase } from "@/integrations/supabase/client";

type NotifyEvent =
  | "submitted" | "assigned" | "scheduled" | "rescheduled"
  | "summons_generated" | "document_ready" | "adjourned"
  | "settled" | "decided" | "closed";

const TEMPLATES: Record<NotifyEvent, (d: Record<string, string>) => { title: string; body: string }> = {
  submitted: (d) => ({ title: "Complaint submitted", body: `Case ${d.ref} has been submitted for review at ${d.office}.` }),
  assigned: (d) => ({ title: "Case assigned", body: `Case ${d.ref} has been assigned to ${d.officer}.` }),
  scheduled: (d) => ({ title: "Hearing scheduled", body: `Case ${d.ref} hearing set for ${d.when}.` }),
  rescheduled: (d) => ({ title: "Hearing rescheduled", body: `Case ${d.ref} hearing moved to ${d.when}.` }),
  summons_generated: (d) => ({ title: "Summons issued", body: `A summons has been issued for case ${d.ref}.` }),
  document_ready: (d) => ({ title: "Document ready", body: `A new document (${d.form}) is available for case ${d.ref}.` }),
  adjourned: (d) => ({ title: "Hearing adjourned", body: `Case ${d.ref} hearing was adjourned. ${d.reason || ""}`.trim() }),
  settled: (d) => ({ title: "Case settled", body: `Case ${d.ref} has been settled.` }),
  decided: (d) => ({ title: "Decision issued", body: `A decision has been recorded for case ${d.ref}.` }),
  closed: (d) => ({ title: "Case closed", body: `Case ${d.ref} has been closed.` }),
};

interface NotifyOpts {
  event: NotifyEvent;
  data: Record<string, string>;
  recipients: { userId?: string | null; phone?: string | null }[];
  link?: string;
  sms?: boolean; // default true for non-internal
}

export async function notifyComplaintParties(opts: NotifyOpts) {
  const tmpl = TEMPLATES[opts.event](opts.data);
  const wantSms = opts.sms !== false;

  for (const r of opts.recipients) {
    if (r.userId) {
      try {
        await supabase.from("notifications").insert({
          user_id: r.userId, title: tmpl.title, body: tmpl.body, link: opts.link || null,
        } as any);
      } catch (e) { console.warn("notify insert failed", e); }
    }
    if (wantSms && r.phone) {
      try {
        await supabase.functions.invoke("send-sms", {
          body: { phone: r.phone, message: `RentControl: ${tmpl.body}` },
        });
      } catch (e) { console.warn("sms send failed", e); }
    }
  }
}

export function complaintRecipients(c: any) {
  return [
    { userId: c.tenant_user_id, phone: c.placeholder_complainant_phone },
    { userId: c.respondent_user_id, phone: c.placeholder_respondent_phone },
  ].filter((r) => r.userId || r.phone);
}

import { supabase } from "@/integrations/supabase/client";

type SmsEvent =
  | "registration_success"
  | "complaint_filed"
  | "agreement_signed"
  | "viewing_scheduled"
  | "payment_confirmed"
  | "application_updated";

const SMS_TEMPLATES: Record<SmsEvent, (data: Record<string, string>) => string> = {
  registration_success: (d) =>
    `Hello ${d.name}, your RentControlGhana account has been successfully created. Name: ${d.name}. ID: ${d.id}. Please keep your ID safe. You will need it anytime you visit the Rent Control Department or make any official request. Login: Phone: ${d.phone}, Temp Password: your full phone number. Login here: ${d.link}. Change your password immediately. Do not share it.`,

  complaint_filed: (d) =>
    `RentGhana: Your complaint (${d.code}) has been submitted to the Rent Control Department. We will review and update you on the progress. Reference: ${d.code}`,

  agreement_signed: (d) =>
    `RentGhana: A tenancy agreement (${d.code}) has been ${d.action}. Property: ${d.property}. Please log in to review the details.`,

  viewing_scheduled: (d) =>
    `RentGhana: A property viewing has been ${d.action} for ${d.property} on ${d.date}${d.time ? " at " + d.time : ""}. Log in for details.`,

  payment_confirmed: (d) =>
    `RentGhana: Your payment of GH₵ ${d.amount} for ${d.description} has been confirmed. Reference: ${d.reference}. Thank you!`,

  application_updated: (d) =>
    `RentGhana: Your application "${d.subject}" has been ${d.status}. ${d.notes ? "Notes: " + d.notes : ""}Log in for details.`,
};

export const sendSms = async (
  phone: string,
  event: SmsEvent,
  data: Record<string, string>
) => {
  try {
    const message = SMS_TEMPLATES[event](data);
    const { error } = await supabase.functions.invoke("send-sms", {
      body: { phone, message },
    });
    if (error) {
      console.error("SMS send error:", error.message);
    }
  } catch (err) {
    // SMS is non-blocking — don't break the flow
    console.error("SMS send failed:", err);
  }
};

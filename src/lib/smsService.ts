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
    `RentControlGhana: Welcome ${d.name}. Your account ID is ${d.id}. Sign in to your dashboard at rentcontrolghana.com using your phone number — temporary password is your full phone number. Please change it after login. Visit the nearest rent control office for assistance.`,

  complaint_filed: (d) =>
    `RentControl: Your complaint (${d.code}) has been submitted to the Rent Control Department. We will review and update you on the progress. Reference: ${d.code}`,

  agreement_signed: (d) =>
    `RentControl: A tenancy agreement (${d.code}) has been ${d.action}. Property: ${d.property}. Please log in to review the details.`,

  viewing_scheduled: (d) =>
    `RentControl: A property viewing has been ${d.action} for ${d.property} on ${d.date}${d.time ? " at " + d.time : ""}. Log in for details.`,

  payment_confirmed: (d) =>
    `RentControl: Your payment of GHS ${d.amount} for ${d.description} has been confirmed. Reference: ${d.reference}. Thank you!`,

  application_updated: (d) =>
    `RentControl: Your application "${d.subject}" has been ${d.status}. ${d.notes ? "Notes: " + d.notes : ""}Log in for details.`,
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

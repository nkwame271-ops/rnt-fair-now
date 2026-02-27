import { supabase } from "@/integrations/supabase/client";

type SmsEvent =
  | "registration_success"
  | "complaint_filed"
  | "agreement_signed"
  | "viewing_scheduled";

const SMS_TEMPLATES: Record<SmsEvent, (data: Record<string, string>) => string> = {
  registration_success: (d) =>
    `Welcome to RentGhana, ${d.name}! Your ${d.role} registration (ID: ${d.id}) is successful. You are now compliant with the Rent Act, 1963 (Act 220). Visit your dashboard to get started.`,

  complaint_filed: (d) =>
    `RentGhana: Your complaint (${d.code}) has been submitted to the Rent Control Department. We will review and update you on the progress. Reference: ${d.code}`,

  agreement_signed: (d) =>
    `RentGhana: A tenancy agreement (${d.code}) has been ${d.action}. Property: ${d.property}. Please log in to review the details.`,

  viewing_scheduled: (d) =>
    `RentGhana: A property viewing has been ${d.action} for ${d.property} on ${d.date}${d.time ? " at " + d.time : ""}. Log in for details.`,
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

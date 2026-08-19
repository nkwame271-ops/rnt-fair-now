import { supabase } from "@/integrations/supabase/client";

export type NotificationEvent =
  | "account_created"
  | "password_reset"
  | "contact_changed"
  | "recovery_completed"
  | "payment_successful"
  | "escrow_released"
  | "tenancy_registered"
  | "rent_card_verified"
  | "fraud_alert"
  | "otp"
  | "login_alert"
  | "tenancy_expiry_reminder"
  | "complaint_reminder"
  | "complaint_filed"
  | "complaint_filed_against"
  | "full_receipt"
  | "tenancy_agreement"
  | "rent_card_copy"
  | "complaint_summary";

export type SmsFailureReason =
  | "no_api_key"
  | "sender_rejected"
  | "insufficient_balance"
  | "invalid_recipient"
  | "provider_unreachable"
  | "provider_error";

export type SmsState = "sent" | "unconfirmed" | "failed";

export interface SmsErrorDetail {
  reason: SmsFailureReason;
  message: string;
  sender_tried?: string;
}

export interface NotificationResult {
  success: boolean;
  channels?: { sms?: SmsState; email?: "enqueued"; inapp?: "inserted" };
  sms_error?: SmsErrorDetail;
  sms_error_text?: string;
  sms_message_id?: string;
  error?: string;
}

/** Short, user-facing explanation for each SMS failure reason. */
export const SMS_FAILURE_MESSAGES: Record<SmsFailureReason, string> = {
  no_api_key: "our SMS service is not configured",
  sender_rejected: "our SMS sender ID is not approved by the network",
  insufficient_balance: "our SMS account has run out of credit",
  invalid_recipient: "the network rejected that phone number",
  provider_unreachable: "the SMS network could not be reached",
  provider_error: "the SMS network returned an error",
};

export const describeSmsFailure = (result: NotificationResult): string => {
  const reason = result.sms_error?.reason;
  return reason ? SMS_FAILURE_MESSAGES[reason] : "the SMS network returned an error";
};

export const sendNotification = async (
  event: NotificationEvent,
  opts: {
    phone?: string;
    email?: string;
    user_id?: string;
    data?: Record<string, string>;
  }
): Promise<NotificationResult> => {
  try {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: {
        event,
        phone: opts.phone,
        email: opts.email,
        user_id: opts.user_id,
        data: opts.data,
      },
    });
    if (error) {
      console.error("Notification send error:", error.message);
      return { success: false, error: error.message };
    }
    return (data as NotificationResult) ?? { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Notification send failed:", msg);
    return { success: false, error: msg };
  }
};

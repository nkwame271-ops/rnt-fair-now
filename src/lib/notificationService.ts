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
  | "full_receipt"
  | "tenancy_agreement"
  | "rent_card_copy"
  | "complaint_summary";

export interface NotificationResult {
  success: boolean;
  channels?: { sms?: "sent" | "failed"; email?: "enqueued"; inapp?: "inserted" };
  sms_error?: string;
  error?: string;
}

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

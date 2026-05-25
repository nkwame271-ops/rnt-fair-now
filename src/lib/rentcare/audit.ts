import { supabase } from "@/integrations/supabase/client";

export type RentCareAuditEvent =
  | "application_created"
  | "application_submitted"
  | "payment_initiated"
  | "payment_succeeded"
  | "payment_failed"
  | "status_changed"
  | "umb_account_saved"
  | "document_uploaded"
  | "admin_message_sent"
  | "student_message_sent"
  | "exported"
  | "settings_changed";

interface LogParams {
  application_id?: string | null;
  event_type: RentCareAuditEvent;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}

/**
 * Best-effort client-side audit logger for RentCare events.
 * Server-side state changes are logged via the rentcare_apps_status_log trigger.
 */
export async function logRentCareAudit({
  application_id = null,
  event_type,
  old_value = null,
  new_value = null,
}: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const actor_role = user?.user_metadata?.role ?? "unknown";
    const device =
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null;

    await supabase.from("rentcare_audit_log" as any).insert({
      application_id,
      event_type,
      actor_user_id: user?.id ?? null,
      actor_role,
      old_value,
      new_value,
      device,
    });
  } catch {
    // Audit logging must never break the calling flow.
  }
}

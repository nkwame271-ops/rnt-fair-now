import { supabase } from "@/integrations/supabase/client";

/**
 * Optimistic-lock safe update for complaints / landlord_complaints.
 *
 * Pass the `version` you read with the row. If someone else has saved between
 * your read and this write, you'll get back `{ ok: false, code: "STALE_VERSION" }`
 * with the current version, and you should refetch + retry / prompt the user.
 *
 * Only whitelisted fields are accepted server-side (see migration):
 *   status, current_stage, internal_notes,
 *   assigned_officer_user_id, hearing_room_id, next_hearing_at,
 *   hearing_venue, hearing_officer_name, summons_issued_at,
 *   physical_docket_ref, relief_sought
 */
export type ComplaintTable = "complaints" | "landlord_complaints";

export interface SafeUpdateOk {
  ok: true;
  row: Record<string, unknown> & { version: number };
}
export interface SafeUpdateStale {
  ok: false;
  code: "STALE_VERSION";
  expected: number;
  actual: number;
  message: string;
}
export type SafeUpdateResult = SafeUpdateOk | SafeUpdateStale;

export async function updateComplaintSafe(
  table: ComplaintTable,
  id: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
): Promise<SafeUpdateResult> {
  const { data, error } = await supabase.rpc("update_complaint_with_version", {
    p_table: table,
    p_id: id,
    p_expected_version: expectedVersion,
    p_patch: patch as any,
  });
  if (error) throw error;
  return data as unknown as SafeUpdateResult;
}

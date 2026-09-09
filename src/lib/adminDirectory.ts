import { supabase } from "@/integrations/supabase/client";

/**
 * Shared, short-lived caches for reference data that used to be re-fetched by
 * every complaint row on screen (staff list + hearing rooms). Both lists change
 * rarely but were responsible for tens of thousands of repeated queries, which
 * is what made Complaint Management feel frozen.
 */

const TTL_MS = 5 * 60 * 1000;

type Cached<T> = { at: number; promise: Promise<T> };

const cache = new Map<string, Cached<unknown>>();

function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as Cached<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise;
  const promise = loader().catch((e) => {
    cache.delete(key);
    throw e;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

export function invalidateAdminDirectory() {
  cache.clear();
}

export interface AdminStaffRow {
  user_id: string;
  office_id: string | null;
  office_name: string | null;
  admin_type: string;
}

export function fetchAdminStaff(): Promise<AdminStaffRow[]> {
  return cached("admin_staff", async () => {
    const { data } = await (supabase.from("admin_staff") as any).select(
      "user_id, office_id, office_name, admin_type",
    );
    return (data || []) as AdminStaffRow[];
  });
}

/** user_id -> full name, for every admin staff member. */
export function fetchStaffNames(): Promise<Map<string, string>> {
  return cached("admin_staff_names", async () => {
    const staff = await fetchAdminStaff();
    const ids = [...new Set(staff.map((s) => s.user_id).filter(Boolean))];
    if (!ids.length) return new Map<string, string>();
    const { data } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
    return new Map<string, string>(
      (data || []).map((p: any) => [p.user_id as string, (p.full_name as string) || "Staff member"]),
    );
  });
}

export interface HearingRoomRow {
  id: string;
  name: string;
  office_id: string;
}

export function fetchHearingRooms(officeId?: string | null): Promise<HearingRoomRow[]> {
  return cached(`hearing_rooms:${officeId || "all"}`, async () => {
    let q = (supabase.from("hearing_rooms") as any)
      .select("id, name, office_id")
      .eq("active", true)
      .order("name");
    if (officeId) q = q.eq("office_id", officeId);
    const { data } = await q;
    return (data || []) as HearingRoomRow[];
  });
}


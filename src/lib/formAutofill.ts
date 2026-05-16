import { supabase } from "@/integrations/supabase/client";

// Build a context object of records that fields can pull from.
export interface AutofillContext {
  complaint?: any;
  complainant_profile?: any;
  respondent_profile?: any;
  property?: any;
  tenancy?: any;
  appointment?: any;
  office?: any;
  officer?: any;
}

export const buildAutofillContext = async (complaintId?: string | null): Promise<AutofillContext> => {
  const ctx: AutofillContext = {};

  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: officer } = await supabase
      .from("profiles").select("*").eq("user_id", auth.user.id).maybeSingle();
    ctx.officer = officer || { full_name: auth.user.email };
  }

  if (!complaintId) return ctx;

  const { data: complaint } = await supabase
    .from("complaints").select("*").eq("id", complaintId).maybeSingle();
  if (!complaint) return ctx;
  ctx.complaint = complaint;

  if (complaint.tenant_user_id) {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", complaint.tenant_user_id).maybeSingle();
    ctx.complainant_profile = data;
  } else {
    ctx.complainant_profile = {
      full_name: complaint.placeholder_complainant_name,
      phone: complaint.placeholder_complainant_phone,
    };
  }

  if (complaint.respondent_user_id) {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", complaint.respondent_user_id).maybeSingle();
    ctx.respondent_profile = data;
  } else {
    ctx.respondent_profile = {
      full_name: complaint.placeholder_respondent_name || complaint.landlord_name,
      phone: complaint.placeholder_respondent_phone,
    };
  }

  if (complaint.linked_property_id) {
    const { data } = await supabase.from("properties").select("*").eq("id", complaint.linked_property_id).maybeSingle();
    ctx.property = data;
  }

  if (complaint.linked_unit_id) {
    const { data: ten } = await supabase
      .from("tenancies").select("*").eq("unit_id", complaint.linked_unit_id)
      .in("status", ["active", "renewal_window", "existing_declared"])
      .maybeSingle();
    ctx.tenancy = ten || undefined;
  }

  if (complaint.office_id) {
    const { data } = await supabase.from("offices").select("*").eq("id", complaint.office_id).maybeSingle();
    ctx.office = data;
  }

  try {
    const { data: appts } = await supabase
      .from("complaint_schedules").select("*").eq("complaint_id", complaintId)
      .order("created_at", { ascending: false }).limit(1);
    ctx.appointment = (appts || [])[0];
  } catch { /* table may not exist in some envs */ }

  return ctx;
};

export const resolveAutofill = (ctx: AutofillContext, source?: string, path?: string): string => {
  if (!source || !path) return "";
  const root: any = (ctx as any)[source];
  if (!root) return "";
  const parts = path.split(".");
  let v: any = root;
  for (const p of parts) {
    if (v == null) return "";
    v = v[p];
  }
  return v == null ? "" : String(v);
};

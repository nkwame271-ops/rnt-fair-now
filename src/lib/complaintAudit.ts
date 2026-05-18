import { supabase } from "@/integrations/supabase/client";

export type CaseKind = "complaint" | "landlord_complaint";

/**
 * Log a discrete admin action against a complaint case.
 * Best-effort — failures are swallowed (RLS allows insert by any admin).
 */
export async function logComplaintAction(opts: {
  caseId: string;
  caseKind?: CaseKind;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let actorName: string | null = null;
    let actorRole: string | null = null;
    if (user) {
      const [{ data: prof }, { data: staff }] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle(),
        supabase.from("admin_staff").select("admin_type").eq("user_id", user.id).maybeSingle(),
      ]);
      actorName = prof?.full_name ?? user.email ?? null;
      actorRole = staff?.admin_type ?? null;
    }
    await supabase.from("complaint_audit_log" as any).insert({
      case_id: opts.caseId,
      case_kind: opts.caseKind ?? "complaint",
      actor_id: user?.id ?? null,
      actor_name: actorName,
      actor_role: actorRole,
      action: opts.action,
      old_value: opts.oldValue ? (opts.oldValue as any) : null,
      new_value: opts.newValue ? (opts.newValue as any) : null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
  } catch (e) {
    console.warn("[complaintAudit] failed", e);
  }
}

/** Move a case to a new stage and record reason. */
export async function transitionStage(opts: {
  caseId: string;
  caseKind?: CaseKind;
  toStage: string;
  reason?: string;
}) {
  const table = opts.caseKind === "landlord_complaint" ? "landlord_complaints" : "complaints";
  const { error } = await supabase
    .from(table as any)
    .update({ current_stage: opts.toStage })
    .eq("id", opts.caseId);
  if (error) throw error;
  await logComplaintAction({
    caseId: opts.caseId,
    caseKind: opts.caseKind,
    action: "stage_change",
    newValue: { stage: opts.toStage, reason: opts.reason ?? null },
  });
}

export const STAGE_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  scheduled: "Scheduled",
  hearing_ongoing: "Hearing Ongoing",
  adjourned: "Adjourned",
  pending_documents: "Pending Documents",
  pending_payment: "Pending Payment",
  settled: "Settled",
  decided: "Decided",
  dismissed: "Dismissed",
  withdrawn: "Withdrawn",
  closed: "Closed",
};

export const STAGE_BADGE_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/20",
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  under_review: "bg-indigo-100 text-indigo-800 border-indigo-200",
  assigned: "bg-cyan-100 text-cyan-800 border-cyan-200",
  scheduled: "bg-sky-100 text-sky-800 border-sky-200",
  hearing_ongoing: "bg-purple-100 text-purple-800 border-purple-200",
  adjourned: "bg-amber-100 text-amber-800 border-amber-200",
  pending_documents: "bg-orange-100 text-orange-800 border-orange-200",
  pending_payment: "bg-yellow-100 text-yellow-800 border-yellow-200",
  settled: "bg-emerald-100 text-emerald-800 border-emerald-200",
  decided: "bg-green-100 text-green-800 border-green-200",
  dismissed: "bg-rose-100 text-rose-800 border-rose-200",
  withdrawn: "bg-slate-100 text-slate-800 border-slate-200",
  closed: "bg-gray-200 text-gray-800 border-gray-300",
};

// Shared helper for the configurable Service Fee engine.
//
// One source of truth for:
//   - whether a fee applies to a given payment_type
//   - the fee percentage
//   - how the fee is split between recipients, depending on payer segment
//
// Payer segments:
//   - "student"  → user is on nugs_staff, has the `student` role, or the
//                  payment_type itself is a student_* category.
//   - "standard" → everyone else (tenant / landlord / regulator-initiated).

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type ServiceFeeSplit = {
  recipient: string;
  amount: number;
  description: string;
  is_service_fee: true;
};

export type ServiceFeeQuote = {
  enabled: boolean;
  percentage: number;
  fee: number;
  segment: "standard" | "student";
  splits: ServiceFeeSplit[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function detectPayerSegment(
  supabase: SupabaseClient,
  userId: string | null,
  paymentType: string,
): Promise<"standard" | "student"> {
  if (paymentType.startsWith("student_")) return "student";
  if (!userId) return "standard";

  const [{ data: nugs }, { data: roles }] = await Promise.all([
    supabase.from("nugs_staff").select("user_id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (nugs) return "student";
  if ((roles ?? []).some((r: any) => r.role === "student")) return "student";
  return "standard";
}

export async function resolveServiceFee(
  supabase: SupabaseClient,
  paymentType: string,
  baseAmount: number,
  segment: "standard" | "student",
): Promise<ServiceFeeQuote> {
  const empty = (enabled = false, percentage = 0): ServiceFeeQuote => ({
    enabled, percentage, fee: 0, segment, splits: [],
  });

  const { data: cfg } = await supabase
    .from("service_fee_configurations")
    .select("payment_type, enabled, percentage")
    .eq("payment_type", paymentType)
    .maybeSingle();

  if (!cfg || !cfg.enabled || Number(cfg.percentage) <= 0 || baseAmount <= 0) {
    return empty(!!cfg?.enabled, Number(cfg?.percentage ?? 0));
  }

  const pct = Number(cfg.percentage);
  const fee = round2(baseAmount * (pct / 100));
  if (fee <= 0) return empty(true, pct);

  const { data: splitRows } = await supabase
    .from("service_fee_splits")
    .select("recipient, percentage, sort_order")
    .eq("payment_type", paymentType)
    .eq("payer_segment", segment)
    .order("sort_order", { ascending: true });

  let rows = splitRows ?? [];
  if (rows.length === 0) {
    rows = [{ recipient: "platform", percentage: 100, sort_order: 0 } as any];
  }

  const splits: ServiceFeeSplit[] = [];
  let allocated = 0;
  rows.forEach((r: any, idx: number) => {
    const isLast = idx === rows.length - 1;
    const amt = isLast ? round2(fee - allocated) : round2(fee * (Number(r.percentage) / 100));
    allocated = round2(allocated + amt);
    if (amt > 0) {
      splits.push({
        recipient: r.recipient,
        amount: amt,
        description: `Service fee (${pct}% — ${r.recipient} ${r.percentage}%)`,
        is_service_fee: true,
      });
    }
  });

  return { enabled: true, percentage: pct, fee, segment, splits };
}

/**
 * Reads the GRA Tax kill switch. Server-side source of truth — never trust client.
 * Defaults to `true` (on) when the row is missing for any reason.
 */
export async function isGraTaxEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from("agreement_template_config")
    .select("gra_tax_enabled")
    .limit(1)
    .maybeSingle();
  return data?.gra_tax_enabled !== false;
}

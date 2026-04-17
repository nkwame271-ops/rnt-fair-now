import { supabase } from "@/integrations/supabase/client";

export type FeeStructure = "fixed" | "rent_band" | "percentage";

export interface ComplaintTypeRow {
  id: string;
  key: string;
  label: string;
  fee_structure: FeeStructure;
  requires_property_link: boolean;
  active: boolean;
  display_order: number;
}

export interface FixedFeeRow {
  id: string;
  complaint_type_id: string;
  fee_amount: number;
  igf_pct: number;
  admin_pct: number;
  platform_pct: number;
}

export interface BandRow {
  id: string;
  complaint_type_id: string;
  band_label: string;
  rent_min: number;
  rent_max: number | null;
  fee_amount: number;
  igf_pct: number;
  admin_pct: number;
  platform_pct: number;
  display_order: number;
}

export interface PercentageRow {
  id: string;
  complaint_type_id: string;
  base_source: "monthly_rent" | "claim_amount";
  threshold_amount: number;
  below_threshold_pct: number;
  above_threshold_pct: number;
  igf_pct: number;
  admin_pct: number;
  platform_pct: number;
}

export interface ComputeContext {
  monthlyRent?: number | null;
  claimAmount?: number | null;
}

export interface ComputeResult {
  ok: boolean;
  amount: number;
  splits: { igf: number; admin: number; platform: number }; // percentages
  bandLabel?: string;
  baseUsed?: number;
  error?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeFixed(fixed: FixedFeeRow): ComputeResult {
  return {
    ok: true,
    amount: round2(Number(fixed.fee_amount || 0)),
    splits: { igf: fixed.igf_pct, admin: fixed.admin_pct, platform: fixed.platform_pct },
  };
}

export function computeBand(bands: BandRow[], rent: number | null | undefined): ComputeResult {
  if (rent == null || !Number.isFinite(rent)) {
    return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "This complaint type requires a linked property to determine the rent band" };
  }
  const sorted = [...bands].sort((a, b) => a.rent_min - b.rent_min);
  const band = sorted.find((b) => rent >= b.rent_min && (b.rent_max == null || rent <= b.rent_max));
  if (!band) {
    return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: `No rent band configured for monthly rent GHS ${rent}` };
  }
  return {
    ok: true,
    amount: round2(Number(band.fee_amount || 0)),
    splits: { igf: band.igf_pct, admin: band.admin_pct, platform: band.platform_pct },
    bandLabel: band.band_label,
    baseUsed: rent,
  };
}

export function computePercentage(rule: PercentageRow, ctx: ComputeContext): ComputeResult {
  const base = rule.base_source === "monthly_rent" ? ctx.monthlyRent : ctx.claimAmount;
  if (base == null || !Number.isFinite(base) || base <= 0) {
    const need = rule.base_source === "monthly_rent" ? "a linked property (monthly rent)" : "a claim amount";
    return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: `This complaint type requires ${need}` };
  }
  const pct = base < rule.threshold_amount ? rule.below_threshold_pct : rule.above_threshold_pct;
  return {
    ok: true,
    amount: round2((base * Number(pct)) / 100),
    splits: { igf: rule.igf_pct, admin: rule.admin_pct, platform: rule.platform_pct },
    baseUsed: base,
  };
}

export async function loadComplaintFeeConfig(typeId: string): Promise<{
  type: ComplaintTypeRow | null;
  fixed?: FixedFeeRow | null;
  bands?: BandRow[];
  percentage?: PercentageRow | null;
}> {
  const { data: type } = await (supabase.from("complaint_types") as any).select("*").eq("id", typeId).maybeSingle();
  if (!type) return { type: null };
  const t = type as ComplaintTypeRow;
  if (t.fee_structure === "fixed") {
    const { data } = await (supabase.from("complaint_fee_fixed") as any).select("*").eq("complaint_type_id", typeId).maybeSingle();
    return { type: t, fixed: data as FixedFeeRow | null };
  }
  if (t.fee_structure === "rent_band") {
    const { data } = await (supabase.from("complaint_fee_bands") as any).select("*").eq("complaint_type_id", typeId).order("display_order");
    return { type: t, bands: (data || []) as BandRow[] };
  }
  const { data } = await (supabase.from("complaint_fee_percentage") as any).select("*").eq("complaint_type_id", typeId).maybeSingle();
  return { type: t, percentage: data as PercentageRow | null };
}

export async function computeComplaintFee(typeId: string, ctx: ComputeContext): Promise<ComputeResult> {
  const cfg = await loadComplaintFeeConfig(typeId);
  if (!cfg.type) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Complaint type not found" };
  if (cfg.type.fee_structure === "fixed") {
    if (!cfg.fixed) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Fixed fee not configured" };
    return computeFixed(cfg.fixed);
  }
  if (cfg.type.fee_structure === "rent_band") {
    if (!cfg.bands || cfg.bands.length === 0) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "No rent bands configured" };
    return computeBand(cfg.bands, ctx.monthlyRent);
  }
  if (!cfg.percentage) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Percentage rule not configured" };
  return computePercentage(cfg.percentage, ctx);
}

export const FEE_STRUCTURE_LABELS: Record<FeeStructure, string> = {
  fixed: "Fixed Fee",
  rent_band: "Rent Band",
  percentage: "Percentage",
};

// ====== Basket model ======

export type BasketItemKind = "fee_rule" | "manual_adjustment";

export interface BasketItem {
  /** Local UI id (uuid). Persisted db id is captured in `dbId` after insert. */
  uid: string;
  dbId?: string;
  kind: BasketItemKind;
  /** Required for fee_rule items. Null for manual adjustments. */
  complaint_type_id: string | null;
  label: string;
  amount: number;
  igf_pct: number;
  admin_pct: number;
  platform_pct: number;
  computation_meta?: {
    rentUsed?: number | null;
    bandLabel?: string | null;
    claimAmount?: number | null;
    feeStructure?: FeeStructure | null;
  } | null;
  /** Manual-adjustment only: reason string captured in audit log */
  reason?: string;
}

export interface BasketTotals {
  total: number;
  igf: number;
  admin: number;
  platform: number;
}

export function summariseBasket(items: BasketItem[]): BasketTotals {
  let total = 0, igf = 0, admin = 0, platform = 0;
  for (const it of items) {
    const amt = Number(it.amount) || 0;
    total += amt;
    igf += amt * (Number(it.igf_pct) || 0) / 100;
    admin += amt * (Number(it.admin_pct) || 0) / 100;
    platform += amt * (Number(it.platform_pct) || 0) / 100;
  }
  return {
    total: round2(total),
    igf: round2(igf),
    admin: round2(admin),
    platform: round2(platform),
  };
}

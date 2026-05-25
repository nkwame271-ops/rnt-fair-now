/**
 * Single source of truth for which escrow-split recipients a user is allowed
 * to see AND count. The visibility and the calculation must always match —
 * if a recipient is filtered out here, every total / card / chart / export
 * derived from splits MUST exclude it as well.
 *
 * - `platform` is Super-Admin-only by hard rule (never visible to sub-admins
 *   or main admins).
 * - Any recipient bound to an `allocation_*` visibility key can additionally
 *   be muted globally by Super Admin via `module_visibility_config`; muted
 *   recipients are removed from the visible set so totals shrink too.
 */

export type Recipient =
  | "rent_control"
  | "rent_control_hq"
  | "admin"
  | "admin_hq"
  | "platform"
  | "gra"
  | "landlord";

export const ALL_RECIPIENTS: Recipient[] = [
  "rent_control",
  "rent_control_hq",
  "admin",
  "admin_hq",
  "platform",
  "gra",
  "landlord",
];

/** Recipients that ONLY Super Admin may ever see/count. */
export const SUPER_ADMIN_ONLY_RECIPIENTS = new Set<Recipient>(["platform"]);

/** Map recipient → its `module_visibility_config` section_key (under module "escrow"). */
export const RECIPIENT_VISIBILITY_KEY: Record<Recipient, string> = {
  rent_control: "allocation_igf",
  rent_control_hq: "allocation_igf",
  admin: "allocation_admin",
  admin_hq: "allocation_admin",
  platform: "allocation_platform",
  gra: "allocation_gra",
  landlord: "allocation_landlord",
};

export const RECIPIENT_LABELS: Record<Recipient, string> = {
  rent_control: "IGF (Office)",
  rent_control_hq: "IGF (HQ)",
  admin: "Admin (Office)",
  admin_hq: "Admin (HQ)",
  platform: "Platform",
  gra: "GRA",
  landlord: "Landlord",
};

interface VisibleOpts {
  isSuperAdmin: boolean;
  /** Optional `useModuleVisibility().isVisible` — when omitted, no mute filter is applied. */
  isVisible?: (moduleKey: string, sectionKey: string) => boolean;
  /** Optional module key — defaults to "escrow". */
  moduleKey?: string;
}

/**
 * Resolve the set of recipients the current viewer is allowed to see/count.
 * Use this AS THE GATE for every revenue total, card, table column, and export.
 */
export function getVisibleRecipients(opts: VisibleOpts): Set<Recipient> {
  const mod = opts.moduleKey ?? "escrow";
  const out = new Set<Recipient>();
  for (const r of ALL_RECIPIENTS) {
    if (!opts.isSuperAdmin && SUPER_ADMIN_ONLY_RECIPIENTS.has(r)) continue;
    if (opts.isVisible && !opts.isVisible(mod, RECIPIENT_VISIBILITY_KEY[r])) continue;
    out.add(r);
  }
  return out;
}

/** Sum only the splits whose recipient is in the visible set. */
export function sumVisibleSplits(
  splits: Array<{ recipient: string; amount: number | string }>,
  visible: Set<string>,
): number {
  let total = 0;
  for (const s of splits) {
    if (!visible.has(s.recipient)) continue;
    total += Number(s.amount) || 0;
  }
  return total;
}

/** Filter a splits list down to only those the viewer may see. */
export function filterVisibleSplits<T extends { recipient: string }>(
  splits: T[],
  visible: Set<string>,
): T[] {
  return splits.filter((s) => visible.has(s.recipient));
}

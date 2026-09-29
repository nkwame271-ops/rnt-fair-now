export type CaseStats = {
  total_cases: number; digital: number; manual: number;
  tenant_male: number; tenant_female: number; landlord_male: number; landlord_female: number;
  settled: number; struck_off: number; withdrawn: number; referred_court: number; pending: number;
  arrears: number; absconded: number; other_matters: number; ag_landlords: number; ag_tenants: number;
  sittings_to_settle: number;
};

export const CASE_LABELS: Record<keyof CaseStats, string> = {
  total_cases: "Total Cases", digital: "Received Digitally", manual: "Received Manually",
  tenant_male: "Tenant Cases — Male", tenant_female: "Tenant Cases — Female",
  landlord_male: "Landlord Cases — Male", landlord_female: "Landlord Cases — Female",
  settled: "Settled", struck_off: "Struck Off", withdrawn: "Withdrawn", referred_court: "Referred to Court", pending: "Pending",
  arrears: "Arrears of Rent", absconded: "Absconded Cases", other_matters: "Other Matters",
  ag_landlords: "Referred to AG — Landlords", ag_tenants: "Referred to AG — Tenants",
  sittings_to_settle: "Sittings before settlement",
};

export const REG_LABELS: Record<string, string> = {
  inspections: "Inspections Conducted", agreements_registered: "Tenancy Agreements Registered",
  rent_cards_issued: "Rent Cards Issued", landlords_registered: "Landlords Registered", tenants_registered: "Tenants Registered",
  radio_engagements: "Radio Engagements", tv_engagements: "TV Engagements",
};

export function reconcile(c: Partial<CaseStats>) {
  const v = (k: keyof CaseStats) => Number(c[k] ?? 0);
  const t = v("total_cases");
  return {
    channel: { sum: v("digital") + v("manual"), ok: v("digital") + v("manual") === t },
    gender: { sum: v("tenant_male") + v("tenant_female") + v("landlord_male") + v("landlord_female"), ok: v("tenant_male") + v("tenant_female") + v("landlord_male") + v("landlord_female") === t },
    outcome: { sum: v("settled") + v("struck_off") + v("withdrawn") + v("referred_court") + v("pending"), ok: v("settled") + v("struck_off") + v("withdrawn") + v("referred_court") + v("pending") === t },
    ag: { sum: v("ag_landlords") + v("ag_tenants"), ok: v("ag_landlords") + v("ag_tenants") === v("referred_court") },
  };
}

export const fmtGHS = (n: number) => `GHS ${Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// GRA Tax kill-switch + per-payment-type Service Fee engine.
// Lives inside Regulator → Templates as a tab.

import { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Receipt, Percent, AlertTriangle, Info, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";

type Segment = "standard" | "student";
type Recipient = "platform" | "nugs" | "admin" | "igf" | "rent_control";

interface ServiceFeeConfig {
  payment_type: string;
  enabled: boolean;
  percentage: number;
}

interface ServiceFeeSplit {
  id?: string;
  payment_type: string;
  payer_segment: Segment;
  recipient: Recipient;
  percentage: number;
  sort_order: number;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  rent_payment: "Rent Payment (monthly rent)",
  rent_combined: "Rent + Tax Combined",
  complaint_fee: "Complaint Filing Fee",
  agreement_sale: "Agreement Sale",
  landlord_registration: "Landlord Registration",
  tenant_registration: "Tenant Registration",
  student_registration: "Student Registration",
  student_complaint_fee: "Student Complaint Fee",
  rent_card: "Rent Card Purchase",
  student_rent_card_fee: "Student Rent Card Fee",
};

const STANDARD_RECIPIENTS: Recipient[] = ["platform", "rent_control", "admin"];
const STUDENT_RECIPIENTS: Recipient[] = ["platform", "nugs", "admin", "igf"];

const RegulatorTaxAndFees = () => {
  const { profile } = useAuth();
  const isSuperAdmin = !!(profile as any)?.isSuperAdmin;

  // GRA Tax
  const [taxRowId, setTaxRowId] = useState<string | null>(null);
  const [graTaxEnabled, setGraTaxEnabled] = useState(true);
  const [savingTax, setSavingTax] = useState(false);

  // Service Fees
  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState<ServiceFeeConfig[]>([]);
  const [splits, setSplits] = useState<ServiceFeeSplit[]>([]);
  const [savingType, setSavingType] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: tpl }, { data: cfgs }, { data: sps }] = await Promise.all([
        supabase.from("agreement_template_config").select("id, gra_tax_enabled").limit(1).maybeSingle(),
        supabase.from("service_fee_configurations").select("*"),
        supabase.from("service_fee_splits").select("*"),
      ]);
      if (tpl) {
        setTaxRowId(tpl.id);
        setGraTaxEnabled((tpl as any).gra_tax_enabled !== false);
      }
      setConfigs((cfgs as any) || []);
      setSplits((sps as any) || []);
      setLoading(false);
    })();
  }, []);

  const saveTaxToggle = async () => {
    if (!taxRowId) return;
    setSavingTax(true);
    const { error } = await supabase
      .from("agreement_template_config")
      .update({ gra_tax_enabled: graTaxEnabled } as any)
      .eq("id", taxRowId);
    setSavingTax(false);
    if (error) toast.error("Failed to save: " + error.message);
    else toast.success(`GRA Tax ${graTaxEnabled ? "enabled" : "disabled"}.`);
  };

  const updateConfig = (paymentType: string, patch: Partial<ServiceFeeConfig>) => {
    setConfigs(prev => prev.map(c => c.payment_type === paymentType ? { ...c, ...patch } : c));
  };

  const splitsFor = (paymentType: string, segment: Segment) =>
    splits.filter(s => s.payment_type === paymentType && s.payer_segment === segment);

  const sumSplits = (paymentType: string, segment: Segment) =>
    splitsFor(paymentType, segment).reduce((s, r) => s + Number(r.percentage || 0), 0);

  const updateSplit = (paymentType: string, segment: Segment, recipient: Recipient, pct: number) => {
    setSplits(prev => {
      const others = prev.filter(s => !(s.payment_type === paymentType && s.payer_segment === segment && s.recipient === recipient));
      const existing = prev.find(s => s.payment_type === paymentType && s.payer_segment === segment && s.recipient === recipient);
      const sortOrder = (segment === "standard" ? STANDARD_RECIPIENTS : STUDENT_RECIPIENTS).indexOf(recipient);
      return [
        ...others,
        {
          ...(existing || {}),
          payment_type: paymentType,
          payer_segment: segment,
          recipient,
          percentage: Number.isFinite(pct) ? pct : 0,
          sort_order: sortOrder,
        } as ServiceFeeSplit,
      ];
    });
  };

  const savePaymentType = async (paymentType: string) => {
    setSavingType(paymentType);
    try {
      const cfg = configs.find(c => c.payment_type === paymentType);
      if (!cfg) throw new Error("Config not found");

      // Validate split sums
      for (const seg of ["standard", "student"] as Segment[]) {
        const sum = sumSplits(paymentType, seg);
        if (sum > 100) {
          throw new Error(`${seg} splits sum to ${sum}% (max 100%)`);
        }
      }

      const { error: cErr } = await supabase
        .from("service_fee_configurations")
        .update({
          enabled: cfg.enabled,
          percentage: cfg.percentage,
          updated_at: new Date().toISOString(),
          updated_by: profile?.userId || null,
        } as any)
        .eq("payment_type", paymentType);
      if (cErr) throw cErr;

      // Wipe & re-insert splits for this payment type
      await supabase.from("service_fee_splits").delete().eq("payment_type", paymentType);
      const rows = splits
        .filter(s => s.payment_type === paymentType && s.percentage > 0)
        .map(s => ({
          payment_type: s.payment_type,
          payer_segment: s.payer_segment,
          recipient: s.recipient,
          percentage: s.percentage,
          sort_order: s.sort_order,
        }));
      if (rows.length > 0) {
        const { error: sErr } = await supabase.from("service_fee_splits").insert(rows);
        if (sErr) throw sErr;
      }
      toast.success(`${PAYMENT_TYPE_LABELS[paymentType] || paymentType} saved.`);
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSavingType(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* ─── GRA TAX TOGGLE ─── */}
      <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> GRA Tax
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Master switch for the entire Government Rent Tax workflow.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={graTaxEnabled} onCheckedChange={setGraTaxEnabled} />
            <span className={`text-sm font-semibold ${graTaxEnabled ? "text-success" : "text-muted-foreground"}`}>
              {graTaxEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            When disabled:
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              <li>Tax is not requested during rent payment.</li>
              <li>Tax is not required for digital tenancy agreement signing.</li>
              <li>Tax line and clauses do not appear on tenancy agreements.</li>
              <li>Tax does not appear in payment calculations.</li>
            </ul>
            Existing tax owed on past tenancies is unaffected.
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveTaxToggle} disabled={savingTax || !taxRowId}>
            {savingTax ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving…</> : <><Save className="h-4 w-4 mr-1" /> Save GRA Tax Setting</>}
          </Button>
        </div>
      </section>

      {/* ─── SERVICE FEE ENGINE ─── */}
      <section className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary" /> Service Fee Engine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurable platform service fee per payment type. Fees appear only at
            checkout, are not printed on receipts, and never alter the rent amount.
          </p>
        </div>

        <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <strong>Student payers</strong> (NUGS staff and student-role users, or any
            <code className="mx-1">student_*</code> payment type) use the Student split.
            All other payers use the Standard split. Only Super Admin may edit Student splits.
          </div>
        </div>

        <div className="space-y-4">
          {configs
            .slice()
            .sort((a, b) => a.payment_type.localeCompare(b.payment_type))
            .map(cfg => (
              <PaymentTypeRow
                key={cfg.payment_type}
                cfg={cfg}
                splits={splits}
                isSuperAdmin={isSuperAdmin}
                saving={savingType === cfg.payment_type}
                onConfigChange={(patch) => updateConfig(cfg.payment_type, patch)}
                onSplitChange={(segment, recipient, pct) => updateSplit(cfg.payment_type, segment, recipient, pct)}
                onSave={() => savePaymentType(cfg.payment_type)}
                sumOf={(seg) => sumSplits(cfg.payment_type, seg)}
              />
            ))}
        </div>
      </section>
    </div>
  );
};

interface PaymentTypeRowProps {
  cfg: ServiceFeeConfig;
  splits: ServiceFeeSplit[];
  isSuperAdmin: boolean;
  saving: boolean;
  onConfigChange: (patch: Partial<ServiceFeeConfig>) => void;
  onSplitChange: (segment: Segment, recipient: Recipient, pct: number) => void;
  onSave: () => void;
  sumOf: (segment: Segment) => number;
}

const PaymentTypeRow = ({ cfg, splits, isSuperAdmin, saving, onConfigChange, onSplitChange, onSave, sumOf }: PaymentTypeRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const label = PAYMENT_TYPE_LABELS[cfg.payment_type] || cfg.payment_type;

  const getPct = (segment: Segment, recipient: Recipient) =>
    splits.find(s => s.payment_type === cfg.payment_type && s.payer_segment === segment && s.recipient === recipient)?.percentage ?? 0;

  const stdSum = sumOf("standard");
  const stuSum = sumOf("student");
  const stdInvalid = stdSum > 100;
  const stuInvalid = stuSum > 100;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/20">
        <button
          type="button"
          className="flex-1 text-left"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="font-medium text-foreground">{label}</div>
          <div className="text-xs text-muted-foreground font-mono">{cfg.payment_type}</div>
        </button>

        <div className="flex items-center gap-2">
          <Switch checked={cfg.enabled} onCheckedChange={(v) => onConfigChange({ enabled: v })} />
          <span className="text-xs text-muted-foreground">{cfg.enabled ? "On" : "Off"}</span>
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={cfg.percentage}
            onChange={(e) => onConfigChange({ percentage: parseFloat(e.target.value) || 0 })}
            className="w-24"
            disabled={!cfg.enabled}
          />
          <span className="text-sm text-muted-foreground">%</span>
        </div>

        <Button size="sm" onClick={onSave} disabled={saving || stdInvalid || stuInvalid}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>

      {expanded && (
        <div className="p-4 grid md:grid-cols-2 gap-6 border-t border-border bg-background">
          <SplitEditor
            title="Standard split (Tenant / Landlord)"
            segment="standard"
            recipients={STANDARD_RECIPIENTS}
            getPct={(r) => getPct("standard", r)}
            onChange={(r, v) => onSplitChange("standard", r, v)}
            sum={stdSum}
            invalid={stdInvalid}
            readonly={false}
          />
          <SplitEditor
            title="Student split (4-way)"
            segment="student"
            recipients={STUDENT_RECIPIENTS}
            getPct={(r) => getPct("student", r)}
            onChange={(r, v) => onSplitChange("student", r, v)}
            sum={stuSum}
            invalid={stuInvalid}
            readonly={!isSuperAdmin}
          />
        </div>
      )}
    </div>
  );
};

interface SplitEditorProps {
  title: string;
  segment: Segment;
  recipients: Recipient[];
  getPct: (r: Recipient) => number;
  onChange: (r: Recipient, v: number) => void;
  sum: number;
  invalid: boolean;
  readonly: boolean;
}

const RECIPIENT_LABELS: Record<Recipient, string> = {
  platform: "Platform",
  rent_control: "Rent Control",
  admin: "Admin",
  nugs: "NUGS",
  igf: "IGF",
};

const SplitEditor = ({ title, recipients, getPct, onChange, sum, invalid, readonly }: SplitEditorProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm font-semibold">{title}</Label>
      {readonly && (
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Lock className="h-3 w-3" /> Super Admin only
        </span>
      )}
    </div>
    <div className="space-y-1.5">
      {recipients.map(r => (
        <div key={r} className="flex items-center gap-2">
          <span className="text-sm text-foreground w-28">{RECIPIENT_LABELS[r]}</span>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={getPct(r)}
            onChange={(e) => onChange(r, parseFloat(e.target.value) || 0)}
            className="w-24 h-8"
            disabled={readonly}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      ))}
    </div>
    <div className={`text-xs font-medium ${invalid ? "text-destructive" : sum === 100 ? "text-success" : "text-muted-foreground"}`}>
      {invalid && <AlertTriangle className="h-3 w-3 inline mr-1" />}
      Total: {sum.toFixed(1)}% {invalid ? "(must be ≤ 100)" : sum < 100 ? "(remainder is unallocated)" : ""}
    </div>
  </div>
);

export default RegulatorTaxAndFees;

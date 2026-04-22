import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { CreditCard, AlertTriangle, Plus, Trash2, ListPlus } from "lucide-react";
import {
  computeBand, computeFixed, computePercentage,
  type BandRow, type ComplaintTypeRow, type FixedFeeRow, type PercentageRow,
  FEE_STRUCTURE_LABELS,
  summariseBasket,
  type BasketItem,
} from "@/lib/complaintFees";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaintId: string;
  complaintTable: "complaints" | "landlord_complaints";
  linkedPropertyId?: string | null;
  monthlyRent?: number | null;
  initialClaimAmount?: number | null;
  onRequested?: () => void;
}

const newUid = () => (crypto?.randomUUID?.() ?? `b_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const RequestComplaintPaymentDialog = ({ open, onOpenChange, complaintId, complaintTable, linkedPropertyId, monthlyRent: monthlyRentProp, initialClaimAmount, onRequested }: Props) => {
  const { user } = useAuth();
  const [types, setTypes] = useState<ComplaintTypeRow[]>([]);
  const [fixedMap, setFixedMap] = useState<Record<string, FixedFeeRow>>({});
  const [bandsMap, setBandsMap] = useState<Record<string, BandRow[]>>({});
  const [percentMap, setPercentMap] = useState<Record<string, PercentageRow>>({});

  const [basket, setBasket] = useState<BasketItem[]>([]);

  // Add-fee-rule state
  const [pickedTypeId, setPickedTypeId] = useState<string>("");
  const [claimAmount, setClaimAmount] = useState<string>(initialClaimAmount != null ? String(initialClaimAmount) : "");
  const [propertyRent, setPropertyRent] = useState<number | null>(monthlyRentProp ?? null);

  // Add-manual-adjustment state
  const [showManual, setShowManual] = useState(false);
  const [manualLabel, setManualLabel] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualReason, setManualReason] = useState("");
  const [manualIgf, setManualIgf] = useState("0");
  const [manualAdmin, setManualAdmin] = useState("100");
  const [manualPlatform, setManualPlatform] = useState("0");

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: t }, { data: f }, { data: b }, { data: p }, { data: existing }] = await Promise.all([
        (supabase.from("complaint_types") as any).select("*").eq("active", true).order("display_order"),
        (supabase.from("complaint_fee_fixed") as any).select("*"),
        (supabase.from("complaint_fee_bands") as any).select("*").order("display_order"),
        (supabase.from("complaint_fee_percentage") as any).select("*"),
        (supabase.from("complaint_basket_items") as any).select("*")
          .eq("complaint_id", complaintId)
          .eq("complaint_table", complaintTable)
          .order("created_at"),
      ]);
      setTypes((t || []) as ComplaintTypeRow[]);
      const fm: Record<string, FixedFeeRow> = {};
      (f || []).forEach((r: FixedFeeRow) => { fm[r.complaint_type_id] = r; });
      setFixedMap(fm);
      const bm: Record<string, BandRow[]> = {};
      (b || []).forEach((r: BandRow) => { (bm[r.complaint_type_id] ||= []).push(r); });
      setBandsMap(bm);
      const pm: Record<string, PercentageRow> = {};
      (p || []).forEach((r: PercentageRow) => { pm[r.complaint_type_id] = r; });
      setPercentMap(pm);

      // Hydrate basket from existing rows if any
      if (Array.isArray(existing) && existing.length > 0) {
        setBasket(existing.map((r: any) => ({
          uid: newUid(),
          dbId: r.id,
          kind: r.kind,
          complaint_type_id: r.complaint_type_id,
          label: r.label,
          amount: Number(r.amount) || 0,
          igf_pct: Number(r.igf_pct) || 0,
          admin_pct: Number(r.admin_pct) || 0,
          platform_pct: Number(r.platform_pct) || 0,
          computation_meta: r.computation_meta || null,
        })));
      } else {
        setBasket([]);
      }

      setPickedTypeId("");
      setClaimAmount(initialClaimAmount != null ? String(initialClaimAmount) : "");
      setPropertyRent(monthlyRentProp ?? null);
      setShowManual(false);
      setManualLabel(""); setManualAmount(""); setManualReason("");
      setManualIgf("0"); setManualAdmin("100"); setManualPlatform("0");
      setManualRent("");
    })();
  }, [open, complaintId, complaintTable]);

  // Resolve monthly rent for band lookup, with multi-source fallback
  const [rentSource, setRentSource] = useState<string | null>(null);
  const [manualRent, setManualRent] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    if (monthlyRentProp != null) {
      setPropertyRent(monthlyRentProp);
      setRentSource("registered tenancy / linked property");
      return;
    }
    (async () => {
      // 1) Try linked unit
      if (linkedPropertyId) {
        const { data: units } = await supabase
          .from("units")
          .select("monthly_rent")
          .eq("property_id", linkedPropertyId)
          .order("monthly_rent", { ascending: true })
          .limit(1);
        if (units && units.length > 0) {
          setPropertyRent(Number(units[0].monthly_rent));
          setRentSource("linked property");
          return;
        }
      }
      // 2) Try complaint snapshot via parent complaint row
      const { data: complaintRow } = await (supabase.from(complaintTable) as any)
        .select("complaint_property_id")
        .eq("id", complaintId)
        .maybeSingle();
      const cpId = complaintRow?.complaint_property_id;
      if (cpId) {
        const { data: cp } = await supabase
          .from("complaint_properties")
          .select("monthly_rent")
          .eq("id", cpId)
          .maybeSingle();
        if (cp?.monthly_rent != null) {
          setPropertyRent(Number(cp.monthly_rent));
          setRentSource("complaint snapshot");
          return;
        }
      }
      setPropertyRent(null);
      setRentSource(null);
    })();
  }, [open, linkedPropertyId, monthlyRentProp, complaintId, complaintTable]);

  const picked = types.find((t) => t.id === pickedTypeId) || null;

  const effectiveRent = propertyRent ?? (manualRent !== "" && Number.isFinite(Number(manualRent)) ? Number(manualRent) : null);

  const pickedComputation = useMemo(() => {
    if (!picked) return null;
    if (picked.fee_structure === "fixed") {
      const f = fixedMap[picked.id];
      if (!f) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Fixed fee not configured" };
      return computeFixed(f);
    }
    if (picked.fee_structure === "rent_band") {
      const bs = bandsMap[picked.id] || [];
      return computeBand(bs, effectiveRent);
    }
    const r = percentMap[picked.id];
    if (!r) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Percentage rule not configured" };
    return computePercentage(r, { monthlyRent: effectiveRent, claimAmount: claimAmount === "" ? null : Number(claimAmount) });
  }, [picked, fixedMap, bandsMap, percentMap, effectiveRent, claimAmount]);

  const needsClaim = picked?.fee_structure === "percentage" && percentMap[picked.id]?.base_source === "claim_amount";

  const totals = useMemo(() => summariseBasket(basket), [basket]);

  const groupedTypes = {
    fixed: types.filter((t) => t.fee_structure === "fixed"),
    rent_band: types.filter((t) => t.fee_structure === "rent_band"),
    percentage: types.filter((t) => t.fee_structure === "percentage"),
  };

  const addFeeRuleItem = () => {
    if (!picked) { toast.error("Select a complaint type"); return; }
    if (!pickedComputation) return;
    if (!pickedComputation.ok) { toast.error(pickedComputation.error || "Cannot compute fee"); return; }
    if (!Number.isFinite(pickedComputation.amount) || pickedComputation.amount <= 0) {
      toast.error("Computed fee must be greater than zero"); return;
    }
    setBasket((prev) => [
      ...prev,
      {
        uid: newUid(),
        kind: "fee_rule",
        complaint_type_id: picked.id,
        label: picked.label,
        amount: pickedComputation.amount,
        igf_pct: pickedComputation.splits.igf,
        admin_pct: pickedComputation.splits.admin,
        platform_pct: pickedComputation.splits.platform,
        computation_meta: {
          rentUsed: effectiveRent,
          rentSource: propertyRent != null ? rentSource : (manualRent !== "" ? "manual override" : null),
          bandLabel: pickedComputation.bandLabel ?? null,
          claimAmount: claimAmount === "" ? null : Number(claimAmount),
          feeStructure: picked.fee_structure,
        },
      },
    ]);
    setPickedTypeId("");
  };

  const addManualItem = () => {
    if (!manualLabel.trim()) { toast.error("Provide a label for the manual charge"); return; }
    if (!manualReason.trim()) { toast.error("Provide a reason for this manual charge"); return; }
    const amt = Number(manualAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error("Amount must be greater than zero"); return; }
    const igf = Number(manualIgf) || 0;
    const adm = Number(manualAdmin) || 0;
    const plat = Number(manualPlatform) || 0;
    if (Math.abs(igf + adm + plat - 100) > 0.01) { toast.error("Splits must sum to 100%"); return; }

    setBasket((prev) => [
      ...prev,
      {
        uid: newUid(),
        kind: "manual_adjustment",
        complaint_type_id: null,
        label: manualLabel.trim(),
        amount: amt,
        igf_pct: igf,
        admin_pct: adm,
        platform_pct: plat,
        reason: manualReason.trim(),
      },
    ]);
    setShowManual(false);
    setManualLabel(""); setManualAmount(""); setManualReason("");
    setManualIgf("0"); setManualAdmin("100"); setManualPlatform("0");
  };

  const removeItem = (uid: string) => setBasket((prev) => prev.filter((i) => i.uid !== uid));

  const handleSubmit = async () => {
    if (!user) return;
    if (basket.length === 0) { toast.error("Add at least one item to the basket"); return; }
    if (totals.total <= 0) { toast.error("Total must be greater than zero"); return; }

    setSubmitting(true);
    try {
      // Wipe existing basket items for this complaint, then re-insert (atomic from app POV)
      await (supabase.from("complaint_basket_items") as any)
        .delete()
        .eq("complaint_id", complaintId)
        .eq("complaint_table", complaintTable);

      const rows = basket.map((it) => ({
        complaint_id: complaintId,
        complaint_table: complaintTable,
        complaint_type_id: it.complaint_type_id,
        kind: it.kind,
        label: it.label,
        amount: it.amount,
        igf_pct: it.igf_pct,
        admin_pct: it.admin_pct,
        platform_pct: it.platform_pct,
        computation_meta: it.computation_meta || null,
        created_by: user.id,
      }));

      const { error: insErr } = await (supabase.from("complaint_basket_items") as any).insert(rows);
      if (insErr) throw insErr;

      // Update parent complaint with totals + state
      const updatePayload: any = {
        outstanding_amount: totals.total,
        basket_total: totals.total,
        payment_status: "pending",
        status: "pending_payment",
      };
      // Keep complaint_type_id pointing at the first fee_rule item (legacy display)
      const firstFeeRule = basket.find((b) => b.kind === "fee_rule");
      if (firstFeeRule?.complaint_type_id) {
        updatePayload.complaint_type_id = firstFeeRule.complaint_type_id;
      }
      if (claimAmount !== "" && Number(claimAmount) > 0) {
        updatePayload.claim_amount = Number(claimAmount);
      }

      const { error: updErr } = await (supabase.from(complaintTable) as any).update(updatePayload).eq("id", complaintId);
      if (updErr) throw updErr;

      // Audit log: capture the entire basket payload (with reasons for manual adjustments)
      await (supabase.from("admin_audit_log") as any).insert({
        admin_user_id: user.id,
        action: "complaint_basket_request_payment",
        target_type: complaintTable,
        target_id: complaintId,
        reason: basket.filter((b) => b.kind === "manual_adjustment").map((b) => `${b.label}: ${b.reason}`).join("; ") || "Fee basket request",
        new_state: {
          basket: basket.map((b) => ({
            kind: b.kind,
            complaint_type_id: b.complaint_type_id,
            label: b.label,
            amount: b.amount,
            splits: { igf: b.igf_pct, admin: b.admin_pct, platform: b.platform_pct },
            reason: b.reason ?? null,
            computation_meta: b.computation_meta ?? null,
          })),
          totals,
        },
      });

      toast.success("Payment request sent to the complainant");
      onRequested?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to request payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Set Type & Request Payment
          </DialogTitle>
          <DialogDescription>
            Build a basket of one or more complaint charges. Each item carries its own fee rule and split. The complainant pays the total.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basket */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Basket</Label>
              <span className="text-xs text-muted-foreground">{basket.length} item(s)</span>
            </div>

            {basket.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/40 border border-dashed border-border rounded-lg p-4 text-center">
                Empty basket — add a complaint type below or a manual adjustment.
              </div>
            ) : (
              <div className="space-y-2">
                {basket.map((it) => (
                  <div key={it.uid} className="flex items-start gap-3 bg-card border border-border rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{it.label}</span>
                        <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${it.kind === "manual_adjustment" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
                          {it.kind === "manual_adjustment" ? "Manual" : "Fee rule"}
                        </span>
                        {it.computation_meta?.bandLabel && (
                          <span className="text-[10px] text-muted-foreground">Band: {it.computation_meta.bandLabel}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        IGF {it.igf_pct}% · Admin {it.admin_pct}% · Platform {it.platform_pct}%
                        {it.reason && <span className="ml-2 italic">— {it.reason}</span>}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
                      GH₵ {it.amount.toFixed(2)}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeItem(it.uid)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add fee rule */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Plus className="h-4 w-4 text-primary" /> Add a complaint type
            </div>
            <Select value={pickedTypeId} onValueChange={setPickedTypeId}>
              <SelectTrigger><SelectValue placeholder="Select complaint type" /></SelectTrigger>
              <SelectContent className="max-h-80">
                {(Object.keys(groupedTypes) as Array<keyof typeof groupedTypes>).map((g) => (
                  groupedTypes[g].length > 0 && (
                    <div key={g}>
                      <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted/50">{FEE_STRUCTURE_LABELS[g]}</div>
                      {groupedTypes[g].map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </div>
                  )
                ))}
              </SelectContent>
            </Select>

            {picked && (
              <div className="text-xs space-y-1 bg-background border border-border rounded p-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Structure</span><span className="text-foreground">{FEE_STRUCTURE_LABELS[picked.fee_structure]}</span></div>
                {picked.requires_property_link && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Linked rent</span><span className="text-foreground">{effectiveRent != null ? `GH₵ ${effectiveRent.toLocaleString()}` : "—"}</span></div>
                )}
                {pickedComputation?.bandLabel && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Band</span><span className="text-foreground">{pickedComputation.bandLabel}</span></div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Computed fee</span><span className="font-semibold text-foreground">{pickedComputation?.ok ? `GH₵ ${pickedComputation.amount.toFixed(2)}` : "—"}</span></div>
                {effectiveRent != null && (picked.fee_structure === "rent_band" || picked.fee_structure === "percentage") && (
                  <div className="text-[10px] text-muted-foreground italic pt-0.5">
                    Rent used: GH₵ {effectiveRent.toLocaleString()} ({propertyRent != null ? rentSource ?? "auto-resolved" : "manual override"})
                  </div>
                )}
                {pickedComputation && !pickedComputation.ok && (
                  <div className="flex items-start gap-1.5 text-destructive mt-1">
                    <AlertTriangle className="h-3 w-3 mt-0.5" /> <span>{pickedComputation.error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual rent override for rent_band when no rent is auto-resolved */}
            {picked?.fee_structure === "rent_band" && propertyRent == null && (
              <div className="space-y-1">
                <Label className="text-xs">Monthly rent for band lookup (GHS) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualRent}
                  onChange={(e) => setManualRent(e.target.value)}
                  placeholder="e.g. 1500"
                />
                <p className="text-[10px] text-muted-foreground">
                  No rent could be auto-resolved from a registered tenancy, linked property, or complaint snapshot. Enter the monthly rent to determine the band.
                </p>
              </div>
            )}

            {needsClaim && (
              <div className="space-y-1">
                <Label className="text-xs">Claim Amount (GHS) *</Label>
                <Input type="number" min="0" step="0.01" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="e.g. 1500" />
              </div>
            )}

            <Button type="button" size="sm" variant="secondary" onClick={addFeeRuleItem} disabled={!pickedComputation?.ok}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add to basket
            </Button>
          </div>

          {/* Add manual adjustment */}
          <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-3">
            <button type="button" onClick={() => setShowManual((v) => !v)} className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ListPlus className="h-4 w-4 text-warning" /> Add manual adjustment
              <span className="text-xs text-muted-foreground font-normal ml-1">(custom charge with its own splits)</span>
            </button>

            {showManual && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Label *</Label>
                    <Input value={manualLabel} onChange={(e) => setManualLabel(e.target.value)} placeholder="e.g. Hardship surcharge" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Amount (GHS) *</Label>
                    <Input type="number" min="0" step="0.01" value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">IGF %</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={manualIgf} onChange={(e) => setManualIgf(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Admin %</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={manualAdmin} onChange={(e) => setManualAdmin(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Platform %</Label>
                    <Input type="number" min="0" max="100" step="0.01" value={manualPlatform} onChange={(e) => setManualPlatform(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Reason *</Label>
                  <Textarea rows={2} value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Why this manual charge is being applied" />
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={addManualItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add to basket
                </Button>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="text-2xl font-bold text-primary">GH₵ {totals.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Aggregated splits</span>
              <span>IGF GH₵ {totals.igf.toFixed(2)} · Admin GH₵ {totals.admin.toFixed(2)} · Platform GH₵ {totals.platform.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || basket.length === 0 || totals.total <= 0}>
            {submitting ? "Sending..." : "Request Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestComplaintPaymentDialog;

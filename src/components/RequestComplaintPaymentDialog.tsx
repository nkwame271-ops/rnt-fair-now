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
import { CreditCard, AlertTriangle } from "lucide-react";
import {
  computeBand, computeFixed, computePercentage,
  type BandRow, type ComplaintTypeRow, type FixedFeeRow, type PercentageRow,
  FEE_STRUCTURE_LABELS,
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

const RequestComplaintPaymentDialog = ({ open, onOpenChange, complaintId, complaintTable, linkedPropertyId, monthlyRent: monthlyRentProp, initialClaimAmount, onRequested }: Props) => {
  const { user } = useAuth();
  const [types, setTypes] = useState<ComplaintTypeRow[]>([]);
  const [fixedMap, setFixedMap] = useState<Record<string, FixedFeeRow>>({});
  const [bandsMap, setBandsMap] = useState<Record<string, BandRow[]>>({});
  const [percentMap, setPercentMap] = useState<Record<string, PercentageRow>>({});
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [override, setOverride] = useState<string>("");
  const [reason, setReason] = useState("");
  const [claimAmount, setClaimAmount] = useState<string>(initialClaimAmount != null ? String(initialClaimAmount) : "");
  const [propertyRent, setPropertyRent] = useState<number | null>(monthlyRentProp ?? null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: t }, { data: f }, { data: b }, { data: p }] = await Promise.all([
        (supabase.from("complaint_types") as any).select("*").eq("active", true).order("display_order"),
        (supabase.from("complaint_fee_fixed") as any).select("*"),
        (supabase.from("complaint_fee_bands") as any).select("*").order("display_order"),
        (supabase.from("complaint_fee_percentage") as any).select("*"),
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
      setSelectedTypeId("");
      setOverride("");
      setReason("");
      setClaimAmount(initialClaimAmount != null ? String(initialClaimAmount) : "");
      setPropertyRent(monthlyRentProp ?? null);
    })();
  }, [open]);

  // If a property is linked, fetch its monthly rent (from cheapest active unit) to feed rent_band/percentage computations
  useEffect(() => {
    if (!open || !linkedPropertyId || monthlyRentProp != null) return;
    (async () => {
      const { data: units } = await supabase
        .from("units")
        .select("monthly_rent")
        .eq("property_id", linkedPropertyId)
        .order("monthly_rent", { ascending: true })
        .limit(1);
      if (units && units.length > 0) setPropertyRent(Number(units[0].monthly_rent));
    })();
  }, [open, linkedPropertyId, monthlyRentProp]);

  const selected = types.find((t) => t.id === selectedTypeId) || null;

  const computation = useMemo(() => {
    if (!selected) return null;
    if (selected.fee_structure === "fixed") {
      const f = fixedMap[selected.id];
      if (!f) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Fixed fee not configured" };
      return computeFixed(f);
    }
    if (selected.fee_structure === "rent_band") {
      const bs = bandsMap[selected.id] || [];
      return computeBand(bs, propertyRent);
    }
    const r = percentMap[selected.id];
    if (!r) return { ok: false, amount: 0, splits: { igf: 0, admin: 0, platform: 0 }, error: "Percentage rule not configured" };
    return computePercentage(r, { monthlyRent: propertyRent, claimAmount: claimAmount === "" ? null : Number(claimAmount) });
  }, [selected, fixedMap, bandsMap, percentMap, propertyRent, claimAmount]);

  const computedFee = computation?.amount ?? 0;
  const finalFee = override !== "" ? Number(override) : computedFee;
  const blocked = !!(selected && computation && !computation.ok && override === "");
  const needsClaim = selected?.fee_structure === "percentage" && percentMap[selected.id]?.base_source === "claim_amount";

  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedTypeId) { toast.error("Select a complaint type"); return; }
    if (blocked) { toast.error(computation?.error || "Cannot compute fee"); return; }
    if (!Number.isFinite(finalFee) || finalFee <= 0) { toast.error("Fee must be greater than zero. Use override if needed."); return; }
    if (override !== "" && !reason.trim()) { toast.error("Provide a reason for the override"); return; }

    setSubmitting(true);
    try {
      const updatePayload: any = {
        complaint_type_id: selectedTypeId,
        outstanding_amount: finalFee,
        payment_status: "pending",
        status: "pending_payment",
      };
      if (claimAmount !== "") updatePayload.claim_amount = Number(claimAmount);
      const { error } = await (supabase.from(complaintTable) as any).update(updatePayload).eq("id", complaintId);
      if (error) throw error;

      if (override !== "") {
        await (supabase.from("admin_audit_log") as any).insert({
          admin_user_id: user.id,
          action: "complaint_fee_override",
          target_type: complaintTable,
          target_id: complaintId,
          reason: reason.trim(),
          old_state: { computed_fee: computedFee, complaint_type_id: selectedTypeId, fee_structure: selected?.fee_structure, computation_meta: { propertyRent, claimAmount: claimAmount === "" ? null : Number(claimAmount), bandLabel: computation?.bandLabel } },
          new_state: { override_amount: finalFee },
        });
      }

      toast.success("Payment request sent to the complainant");
      onRequested?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to request payment");
    } finally {
      setSubmitting(false);
    }
  };

  const groupedTypes = {
    fixed: types.filter((t) => t.fee_structure === "fixed"),
    rent_band: types.filter((t) => t.fee_structure === "rent_band"),
    percentage: types.filter((t) => t.fee_structure === "percentage"),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" /> Set Type & Request Payment
          </DialogTitle>
          <DialogDescription>
            Choose the complaint category and confirm the fee. The complainant will be prompted to pay on their dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Complaint Type</Label>
            <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
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
          </div>

          {selected && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Structure</span>
                <span className="text-foreground">{FEE_STRUCTURE_LABELS[selected.fee_structure]}</span>
              </div>
              {computation?.bandLabel && (
                <div className="flex justify-between"><span className="text-muted-foreground">Band</span><span className="text-foreground">{computation.bandLabel}</span></div>
              )}
              {selected.requires_property_link && (
                <div className="flex justify-between"><span className="text-muted-foreground">Linked property rent</span><span className="font-medium text-foreground">{propertyRent != null ? `GH₵ ${propertyRent.toLocaleString()}` : "—"}</span></div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Computed fee</span>
                <span className="font-semibold text-foreground">{computation?.ok ? `GH₵ ${computedFee.toFixed(2)}` : "—"}</span>
              </div>
              {blocked && (
                <div className="flex items-start gap-1.5 text-xs text-destructive mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                  <span>{computation?.error}</span>
                </div>
              )}
            </div>
          )}

          {needsClaim && (
            <div className="space-y-2">
              <Label>Claim Amount (GHS) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} placeholder="e.g. 1500" />
              <p className="text-xs text-muted-foreground">Required for this complaint type — fee is calculated as a percentage of this amount.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Override Amount (optional)</Label>
            <Input type="number" min="0" step="0.01" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Leave blank to use computed fee" />
          </div>

          {override !== "" && (
            <div className="space-y-2">
              <Label>Reason for override <span className="text-destructive">*</span></Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hardship waiver, property rent unavailable, etc." />
            </div>
          )}

          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-sm font-medium text-foreground">Final amount</span>
            <span className="text-xl font-bold text-primary">GH₵ {Number.isFinite(finalFee) ? finalFee.toFixed(2) : "0.00"}</span>
          </div>

          {selected && computation?.ok && (
            <div className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg p-2">
              Splits on payment: IGF {computation.splits.igf}% · Admin {computation.splits.admin}% · Platform {computation.splits.platform}%
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedTypeId || finalFee <= 0 || blocked}>
            {submitting ? "Sending..." : "Request Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestComplaintPaymentDialog;

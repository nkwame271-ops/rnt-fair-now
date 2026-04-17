import { useEffect, useState } from "react";
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

interface ComplaintType {
  id: string;
  key: string;
  label: string;
  fee_mode: "fixed" | "percentage" | "rent_band";
  fee_amount: number | null;
  fee_percentage: number | null;
  rent_band_config: any[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaintId: string;
  complaintTable: "complaints" | "landlord_complaints";
  monthlyRent?: number | null;
  onRequested?: () => void;
}

const RequestComplaintPaymentDialog = ({ open, onOpenChange, complaintId, complaintTable, monthlyRent, onRequested }: Props) => {
  const { user } = useAuth();
  const [types, setTypes] = useState<ComplaintType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [override, setOverride] = useState<string>("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("complaint_types")
        .select("*")
        .eq("active", true)
        .order("display_order");
      setTypes((data || []) as any);
      setSelectedTypeId("");
      setOverride("");
      setReason("");
    })();
  }, [open]);

  const selected = types.find((t) => t.id === selectedTypeId);

  const computedFee = (() => {
    if (!selected) return 0;
    if (selected.fee_mode === "fixed") return Number(selected.fee_amount || 0);
    if (selected.fee_mode === "percentage") {
      if (!monthlyRent) return 0;
      return +(monthlyRent * Number(selected.fee_percentage || 0) / 100).toFixed(2);
    }
    if (selected.fee_mode === "rent_band") {
      if (!monthlyRent || !Array.isArray(selected.rent_band_config)) return 0;
      const band = selected.rent_band_config.find((b: any) => monthlyRent >= Number(b.min) && monthlyRent <= Number(b.max));
      return band ? Number(band.fee) : 0;
    }
    return 0;
  })();

  const finalFee = override !== "" ? Number(override) : computedFee;
  const needsRent = selected && (selected.fee_mode === "percentage" || selected.fee_mode === "rent_band") && !monthlyRent;

  const handleSubmit = async () => {
    if (!user) return;
    if (!selectedTypeId) { toast.error("Select a complaint type"); return; }
    if (!Number.isFinite(finalFee) || finalFee <= 0) { toast.error("Fee must be greater than zero. Use override if needed."); return; }
    if (override !== "" && !reason.trim()) { toast.error("Provide a reason for the override"); return; }

    setSubmitting(true);
    try {
      const { error } = await (supabase.from(complaintTable).update({
        complaint_type_id: selectedTypeId,
        outstanding_amount: finalFee,
        payment_status: "pending",
        status: "pending_payment",
      } as any) as any).eq("id", complaintId);
      if (error) throw error;

      // Audit log for override
      if (override !== "") {
        await supabase.from("admin_audit_log").insert({
          admin_user_id: user.id,
          action: "complaint_fee_override",
          target_type: complaintTable,
          target_id: complaintId,
          reason: reason.trim(),
          old_state: { computed_fee: computedFee, complaint_type_id: selectedTypeId },
          new_state: { override_amount: finalFee },
        } as any);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label} — {t.fee_mode === "fixed" ? `GH₵ ${Number(t.fee_amount).toFixed(2)}` : t.fee_mode === "percentage" ? `${t.fee_percentage}% of rent` : "Rent-banded"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Computed fee</span>
                <span className="font-semibold text-foreground">GH₵ {computedFee.toFixed(2)}</span>
              </div>
              {needsRent && (
                <div className="flex items-start gap-1.5 text-xs text-warning mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
                  <span>This type needs the tenancy's monthly rent, which isn't linked to this complaint. Use override below.</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Override Amount (optional)</Label>
            <Input type="number" min="0" step="0.01" value={override} onChange={(e) => setOverride(e.target.value)} placeholder="Leave blank to use computed fee" />
          </div>

          {override !== "" && (
            <div className="space-y-2">
              <Label>Reason for override <span className="text-destructive">*</span></Label>
              <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Hardship waiver, banded estimate, etc." />
            </div>
          )}

          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg p-3">
            <span className="text-sm font-medium text-foreground">Final amount</span>
            <span className="text-xl font-bold text-primary">GH₵ {Number.isFinite(finalFee) ? finalFee.toFixed(2) : "0.00"}</span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedTypeId || finalFee <= 0}>
            {submitting ? "Sending..." : "Request Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestComplaintPaymentDialog;

import { motion } from "framer-motion";
import { FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PropertyWithUnits } from "./SelectUnitsStep";
import type { UnitDraft } from "./TenantDetailsStep";

interface Props {
  property: PropertyWithUnits;
  drafts: UnitDraft[];
  feeEnabled: boolean;
  totalFee: number;
  feeForDraft: (d: UnitDraft) => { total: number };
  submitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export const ReviewStep = ({
  property,
  drafts,
  feeEnabled,
  totalFee,
  feeForDraft,
  submitting,
  onBack,
  onSubmit,
}: Props) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
    <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
      <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" /> Review {drafts.length} Existing Tenanc
        {drafts.length === 1 ? "y" : "ies"}
      </h2>
      <div className="text-sm text-muted-foreground">
        Property:{" "}
        <span className="font-semibold text-card-foreground">
          {property.property_name || property.address}
        </span>
      </div>
      <div className="space-y-3">
        {drafts.map((d) => {
          const unit = property.units.find((u) => u.id === d.unitId)!;
          const fee = feeForDraft(d);
          return (
            <div key={d.unitId} className="border border-border rounded-lg p-3 text-sm grid sm:grid-cols-5 gap-2">
              <div><div className="text-xs text-muted-foreground">Unit</div><div className="font-semibold">{unit.unit_name}</div></div>
              <div><div className="text-xs text-muted-foreground">Tenant</div><div className="font-semibold">{d.tenantName}</div></div>
              <div><div className="text-xs text-muted-foreground">Rent</div><div className="font-semibold">GH₵ {(parseFloat(d.rent) || 0).toLocaleString()}</div></div>
              <div><div className="text-xs text-muted-foreground">Agreement</div><div className="font-semibold capitalize">{d.agreementChoice}</div></div>
              <div><div className="text-xs text-muted-foreground">Fee</div><div className="font-semibold">GH₵ {fee.total.toFixed(2)}</div></div>
            </div>
          );
        })}
      </div>
      {feeEnabled && totalFee > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 flex justify-between font-bold border-t border-border pt-3">
          <span>Total</span>
          <span>GH₵ {totalFee.toFixed(2)}</span>
        </div>
      )}
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      <Button variant="outline" onClick={onBack}>Back</Button>
      <Button onClick={onSubmit} disabled={submitting}>
        {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
        {submitting
          ? "Processing..."
          : feeEnabled && totalFee > 0
          ? `Pay GH₵ ${totalFee.toFixed(2)} & Submit`
          : `Declare ${drafts.length} Tenanc${drafts.length === 1 ? "y" : "ies"}`}
      </Button>
    </div>
  </motion.div>
);

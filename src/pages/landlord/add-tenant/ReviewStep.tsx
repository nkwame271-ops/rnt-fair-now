import { motion } from "framer-motion";
import { CreditCard, FileText, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UnitDraft, UnitInfo } from "./TenantDetailsStep";

interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  units: UnitInfo[];
}

interface Props {
  property: PropertyWithUnits;
  drafts: UnitDraft[];
  availableRentCards: { id: string; serial_number: string }[];
  feeEnabled: boolean;
  totalFee: number;
  bandFeeFor: (rent: number) => number;
  submitting: boolean;
  onBack: () => void;
  onPay: () => void;
  onSubmitFree: () => void;
}

export const ReviewStep = ({
  property,
  drafts,
  availableRentCards,
  feeEnabled,
  totalFee,
  bandFeeFor,
  submitting,
  onBack,
  onPay,
  onSubmitFree,
}: Props) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
    <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
      <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" /> Review {drafts.length} Tenanc
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
          const fee = bandFeeFor(parseFloat(d.rent) || 0);
          return (
            <div
              key={d.unitId}
              className="border border-border rounded-lg p-3 text-sm grid sm:grid-cols-5 gap-2"
            >
              <div>
                <div className="text-xs text-muted-foreground">Unit</div>
                <div className="font-semibold">{unit.unit_name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Tenant</div>
                <div className="font-semibold">{d.foundTenant?.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Rent / Adv</div>
                <div className="font-semibold">
                  GH₵ {(parseFloat(d.rent) || 0).toLocaleString()} / {d.advanceMonths}m
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Cards</div>
                <div className="text-xs font-semibold">
                  {availableRentCards.find((c) => c.id === d.rentCardId1)?.serial_number} +{" "}
                  {availableRentCards.find((c) => c.id === d.rentCardId2)?.serial_number}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fee</div>
                <div className="font-semibold">GH₵ {fee.toFixed(2)}</div>
              </div>
            </div>
          );
        })}
      </div>
      {feeEnabled && totalFee > 0 && (
        <div className="bg-muted/30 rounded-lg p-3 flex justify-between font-bold border-t border-border pt-3">
          <span>Total Registration Fee</span>
          <span>GH₵ {totalFee.toFixed(2)}</span>
        </div>
      )}
    </div>
    <div className="flex flex-col sm:flex-row gap-3">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      {feeEnabled && totalFee > 0 ? (
        <Button onClick={onPay} disabled={submitting}>
          <CreditCard className="h-4 w-4 mr-1" />{" "}
          {submitting ? "Processing..." : `Pay GH₵ ${totalFee.toFixed(2)} & Submit`}
        </Button>
      ) : (
        <Button onClick={onSubmitFree} disabled={submitting}>
          <UserPlus className="h-4 w-4 mr-1" />{" "}
          {submitting
            ? "Creating..."
            : `Create ${drafts.length} Tenanc${drafts.length === 1 ? "y" : "ies"}`}
        </Button>
      )}
    </div>
  </motion.div>
);

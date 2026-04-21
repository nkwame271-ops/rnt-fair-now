import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, FileText, Phone, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnitInfo } from "./SelectUnitsStep";

export interface UnitDraft {
  unitId: string;
  tenantName: string;
  tenantPhone: string;
  phoneSearching: boolean;
  phoneSearchDone: boolean;
  matchedTenant: { userId: string; fullName: string; tenantIdCode: string } | null;
  rent: string;
  advancePaid: string;
  existingStartDate: string;
  expiryDate: string;
  agreementChoice: "upload" | "buy";
  agreementFileName?: string;
  rentCardId1: string;
  rentCardId2: string;
}

interface Props {
  selectedUnits: UnitInfo[];
  drafts: UnitDraft[];
  expanded: Set<string>;
  onToggleExpand: (unitId: string) => void;
  feeEnabled: boolean;
  feeForDraft: (d: UnitDraft) => { total: number };
  validateDraft: (d: UnitDraft) => string | null;
  updateDraft: (unitId: string, patch: Partial<UnitDraft>) => void;
  onPhoneSearch: (d: UnitDraft) => void;
  cardsAvailableFor: (d: UnitDraft, slot: 1 | 2) => { id: string; serial_number: string }[];
  onAgreementFileChange: (unitId: string, file: File | null) => void;
  allValid: boolean;
  onBack: () => void;
  onNext: () => void;
}

export const TenantDetailsStep = ({
  selectedUnits,
  drafts,
  expanded,
  onToggleExpand,
  feeEnabled,
  feeForDraft,
  validateDraft,
  updateDraft,
  onPhoneSearch,
  cardsAvailableFor,
  onAgreementFileChange,
  allValid,
  onBack,
  onNext,
}: Props) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
    {selectedUnits.map((unit) => {
      const draft = drafts.find((d) => d.unitId === unit.id)!;
      const err = validateDraft(draft);
      const isOpen = expanded.has(unit.id) || drafts.length === 1;
      const monthlyRent = parseFloat(draft.rent) || 0;
      const fee = feeForDraft(draft);
      return (
        <div key={unit.id} className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => {
              if (drafts.length === 1) return;
              onToggleExpand(unit.id);
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              {err ? <AlertCircle className="h-4 w-4 text-warning" /> : <CheckCircle2 className="h-4 w-4 text-success" />}
              <div className="text-left">
                <div className="font-semibold text-card-foreground text-sm">{unit.unit_name}</div>
                <div className="text-xs text-muted-foreground">
                  {err || `${draft.tenantName || "—"} · GH₵ ${monthlyRent.toLocaleString()}/mo · ${draft.agreementChoice === "buy" ? "Buy" : "Upload"}`}
                </div>
              </div>
            </div>
            {drafts.length > 1 && (isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
          </button>

          {isOpen && (
            <div className="p-4 pt-0 space-y-4 border-t border-border">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tenant Full Name</Label>
                  <Input value={draft.tenantName} onChange={(e) => updateDraft(unit.id, { tenantName: e.target.value })} placeholder="e.g. Kwame Asante" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tenant Phone</Label>
                  <div className="flex gap-2">
                    <Input
                      value={draft.tenantPhone}
                      onChange={(e) => updateDraft(unit.id, { tenantPhone: e.target.value, phoneSearchDone: false, matchedTenant: null })}
                      placeholder="0241234567"
                    />
                    <Button variant="outline" size="sm" onClick={() => onPhoneSearch(draft)} disabled={!draft.tenantPhone.trim() || draft.phoneSearching}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {draft.phoneSearchDone && (
                draft.matchedTenant ? (
                  <div className="bg-success/5 border border-success/20 rounded p-2 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-semibold">{draft.matchedTenant.fullName}</span>
                    <span className="text-muted-foreground">{draft.matchedTenant.tenantIdCode || "(will be linked)"}</span>
                  </div>
                ) : (
                  <div className="bg-warning/5 border border-warning/20 rounded p-2 text-xs flex items-center gap-2">
                    <Phone className="h-4 w-4 text-warning" />
                    <span>SMS invitation will be sent to {draft.tenantPhone}</span>
                  </div>
                )
              )}

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Rent (GH₵)</Label>
                  <Input type="number" value={draft.rent} onChange={(e) => updateDraft(unit.id, { rent: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Advance Already Paid (months)</Label>
                  <Input type="number" min="0" value={draft.advancePaid} onChange={(e) => updateDraft(unit.id, { advancePaid: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tenancy Start Date</Label>
                  <Input type="date" value={draft.existingStartDate} onChange={(e) => updateDraft(unit.id, { existingStartDate: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expected Expiry Date</Label>
                  <Input type="date" value={draft.expiryDate} onChange={(e) => updateDraft(unit.id, { expiryDate: e.target.value })} />
                </div>
              </div>

              {/* Agreement choice */}
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="text-xs">Agreement Type</Label>
                <div className="grid sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateDraft(unit.id, { agreementChoice: "upload" })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${draft.agreementChoice === "upload" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1"><Upload className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Upload Agreement</span></div>
                    <p className="text-xs text-muted-foreground">I have my own document</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateDraft(unit.id, { agreementChoice: "buy" })}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${draft.agreementChoice === "buy" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}
                  >
                    <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-primary" /><span className="text-sm font-semibold">Buy Agreement</span></div>
                    <p className="text-xs text-muted-foreground">Platform generates one</p>
                  </button>
                </div>
                {draft.agreementChoice === "upload" && (
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => onAgreementFileChange(unit.id, e.target.files?.[0] || null)}
                  />
                )}
              </div>

              {/* Rent cards */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Landlord Copy</Label>
                  <Select value={draft.rentCardId1} onValueChange={(v) => updateDraft(unit.id, { rentCardId1: v })}>
                    <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                    <SelectContent>
                      {cardsAvailableFor(draft, 1).map((rc) => <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tenant Copy</Label>
                  <Select value={draft.rentCardId2} onValueChange={(v) => updateDraft(unit.id, { rentCardId2: v })}>
                    <SelectTrigger><SelectValue placeholder="Select card" /></SelectTrigger>
                    <SelectContent>
                      {cardsAvailableFor(draft, 2).map((rc) => <SelectItem key={rc.id} value={rc.id}>{rc.serial_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {feeEnabled && fee.total > 0 && (
                <div className="bg-muted/30 rounded p-2 text-xs flex justify-between">
                  <span>Fee for this unit</span>
                  <span className="font-semibold">GH₵ {fee.total.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}

    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack}>Back</Button>
      <Button disabled={!allValid} onClick={onNext}>Next: Review</Button>
    </div>
  </motion.div>
);

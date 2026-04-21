import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CustomFieldDef } from "@/lib/generateAgreementPdf";

export interface UnitInfo {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  status: string;
}

export interface UnitDraft {
  unitId: string;
  tenantSearch: string;
  foundTenant: { name: string; tenantIdCode: string; userId: string } | null;
  searching: boolean;
  rent: string;
  advanceMonths: string;
  leaseDurationMonths: string;
  startDate: string;
  rentCardId1: string;
  rentCardId2: string;
  customFieldValues: Record<string, string>;
}

interface Props {
  selectedUnits: UnitInfo[];
  drafts: UnitDraft[];
  expandedUnits: Set<string>;
  onToggleExpand: (unitId: string) => void;
  customFields: CustomFieldDef[];
  maxAdvance: number;
  maxLease: number;
  minLease: number;
  bulkRent: string;
  bulkStartDate: string;
  setBulkRent: (v: string) => void;
  setBulkStartDate: (v: string) => void;
  onApplyBulk: () => void;
  updateDraft: (unitId: string, patch: Partial<UnitDraft>) => void;
  onSearchTenant: (draft: UnitDraft) => void;
  validateDraft: (d: UnitDraft) => string | null;
  computeEndDate: (start: string, months: string) => string;
  cardsAvailableFor: (draft: UnitDraft, slot: 1 | 2) => { id: string; serial_number: string }[];
  allValid: boolean;
  onBack: () => void;
  onNext: () => void;
}

export const TenantDetailsStep = ({
  selectedUnits,
  drafts,
  expandedUnits,
  onToggleExpand,
  customFields,
  maxAdvance,
  maxLease,
  minLease,
  bulkRent,
  bulkStartDate,
  setBulkRent,
  setBulkStartDate,
  onApplyBulk,
  updateDraft,
  onSearchTenant,
  validateDraft,
  computeEndDate,
  cardsAvailableFor,
  allValid,
  onBack,
  onNext,
}: Props) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
    {/* Bulk-apply helper */}
    <div className="bg-card rounded-xl p-4 border border-border space-y-3">
      <p className="text-sm font-semibold text-card-foreground">Bulk apply to all units (optional)</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <Input type="number" placeholder="Rent (GH₵)" value={bulkRent} onChange={(e) => setBulkRent(e.target.value)} />
        <Input type="date" value={bulkStartDate} onChange={(e) => setBulkStartDate(e.target.value)} />
        <Button variant="outline" onClick={onApplyBulk} disabled={!bulkRent && !bulkStartDate}>
          Apply to all
        </Button>
      </div>
    </div>

    {selectedUnits.map((unit) => {
      const draft = drafts.find((d) => d.unitId === unit.id)!;
      const err = validateDraft(draft);
      const expanded = expandedUnits.has(unit.id) || drafts.length === 1;
      const endDate = computeEndDate(draft.startDate, draft.leaseDurationMonths);
      const monthlyRent = parseFloat(draft.rent) || 0;
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
              {err ? (
                <AlertTriangle className="h-4 w-4 text-warning" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <div className="text-left">
                <div className="font-semibold text-card-foreground text-sm">{unit.unit_name}</div>
                <div className="text-xs text-muted-foreground">
                  {err || `${draft.foundTenant?.name || "—"} · GH₵ ${monthlyRent.toLocaleString()}/mo`}
                </div>
              </div>
            </div>
            {drafts.length > 1 && (expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
          </button>

          {expanded && (
            <div className="p-4 pt-0 space-y-4 border-t border-border">
              {/* Tenant search */}
              <div className="space-y-2">
                <Label>Tenant ID or Name</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. TN-2026-0001 or Kwame Mensah"
                    value={draft.tenantSearch}
                    onChange={(e) => updateDraft(unit.id, { tenantSearch: e.target.value, foundTenant: null })}
                  />
                  <Button
                    variant="outline"
                    onClick={() => onSearchTenant(draft)}
                    disabled={!draft.tenantSearch.trim() || draft.searching}
                  >
                    <Search className="h-4 w-4 mr-1" />
                    {draft.searching ? "..." : "Search"}
                  </Button>
                </div>
                {draft.foundTenant && (
                  <div className="bg-success/5 border border-success/20 rounded p-2 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="font-semibold">{draft.foundTenant.name}</span>
                    <span className="text-muted-foreground">({draft.foundTenant.tenantIdCode})</span>
                  </div>
                )}
              </div>

              {/* Terms */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Rent (GH₵)</Label>
                  <Input
                    type="number"
                    value={draft.rent}
                    onChange={(e) => updateDraft(unit.id, { rent: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Advance (months)</Label>
                  <Select
                    value={draft.advanceMonths}
                    onValueChange={(v) => updateDraft(unit.id, { advanceMonths: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxAdvance }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={m.toString()}>
                          {m} month{m > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lease Duration</Label>
                  <Select
                    value={draft.leaseDurationMonths}
                    onValueChange={(v) => updateDraft(unit.id, { leaseDurationMonths: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: maxLease }, (_, i) => i + 1)
                        .filter((m) => m >= minLease)
                        .map((m) => (
                          <SelectItem key={m} value={m.toString()}>
                            {m} month{m > 1 ? "s" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={draft.startDate}
                    onChange={(e) => updateDraft(unit.id, { startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">End Date</Label>
                  <Input type="date" value={endDate} readOnly className="bg-muted" />
                </div>
              </div>

              {/* Custom fields */}
              {customFields.length > 0 && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {customFields.map((f) => (
                    <div key={f.label} className="space-y-1">
                      <Label className="text-xs">
                        {f.label}
                        {f.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      <Input
                        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                        value={draft.customFieldValues[f.label] || ""}
                        onChange={(e) =>
                          updateDraft(unit.id, {
                            customFieldValues: { ...draft.customFieldValues, [f.label]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Rent cards */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="space-y-1">
                  <Label className="text-xs">Landlord Copy</Label>
                  <Select
                    value={draft.rentCardId1}
                    onValueChange={(v) => updateDraft(unit.id, { rentCardId1: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select card" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardsAvailableFor(draft, 1).map((rc) => (
                        <SelectItem key={rc.id} value={rc.id}>
                          {rc.serial_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tenant Copy</Label>
                  <Select
                    value={draft.rentCardId2}
                    onValueChange={(v) => updateDraft(unit.id, { rentCardId2: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select card" />
                    </SelectTrigger>
                    <SelectContent>
                      {cardsAvailableFor(draft, 2).map((rc) => (
                        <SelectItem key={rc.id} value={rc.id}>
                          {rc.serial_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {parseInt(draft.advanceMonths) > 6 && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-2 text-destructive text-xs font-semibold">
                  ⚠ Advance exceeds 6-month legal limit (Act 220)
                </div>
              )}
            </div>
          )}
        </div>
      );
    })}

    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack}>
        Back
      </Button>
      <Button disabled={!allValid} onClick={onNext}>
        Next: Review
      </Button>
    </div>
  </motion.div>
);

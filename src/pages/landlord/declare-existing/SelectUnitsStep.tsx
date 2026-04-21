import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface UnitInfo {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  status: string;
}
export interface PropertyWithUnits {
  id: string;
  property_name: string | null;
  address: string;
  region: string;
  area: string;
  ghana_post_gps: string | null;
  units: UnitInfo[];
}

interface Props {
  properties: PropertyWithUnits[];
  selectedPropertyId: string;
  onSelectProperty: (id: string) => void;
  property: PropertyWithUnits | undefined;
  selectedUnitIds: Set<string>;
  onToggleUnit: (unit: UnitInfo) => void;
  draftsCount: number;
  cardsNeeded: number;
  availableCardsCount: number;
  enoughCards: boolean;
  onNext: () => void;
}

export const SelectUnitsStep = ({
  properties,
  selectedPropertyId,
  onSelectProperty,
  property,
  selectedUnitIds,
  onToggleUnit,
  draftsCount,
  cardsNeeded,
  availableCardsCount,
  enoughCards,
  onNext,
}: Props) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
    <h2 className="text-lg font-semibold text-card-foreground">Select Property & Units</h2>
    {properties.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        No properties registered. <Link to="/landlord/register-property" className="text-primary underline">Register one first</Link>.
      </p>
    ) : (
      <>
        <div className="space-y-3">
          <Label>Property</Label>
          <Select value={selectedPropertyId} onValueChange={onSelectProperty}>
            <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.property_name || "Unnamed"} — {p.address}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {property && (
          <div className="space-y-3">
            <Label>Units (select one or more — any status accepted for existing tenancies)</Label>
            <div className="grid sm:grid-cols-2 gap-2">
              {property.units.map((u) => {
                const checked = selectedUnitIds.has(u.id);
                return (
                  <label key={u.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"}`}>
                    <Checkbox checked={checked} onCheckedChange={() => onToggleUnit(u)} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-card-foreground">{u.unit_name}</div>
                      <div className="text-xs text-muted-foreground">{u.unit_type} · GH₵ {u.monthly_rent.toLocaleString()}/mo · {u.status}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {draftsCount > 0 && (
          <div className="bg-muted/30 rounded-lg p-3 text-sm flex items-center justify-between">
            <span className="text-muted-foreground">{draftsCount} unit(s) selected · {cardsNeeded} rent card(s) required</span>
            <span className={`font-semibold ${enoughCards ? "text-success" : "text-destructive"}`}>{availableCardsCount} available</span>
          </div>
        )}
        {draftsCount > 0 && !enoughCards && (
          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-card-foreground">Not Enough Rent Cards</p>
              <Link to="/landlord/manage-rent-cards"><Button size="sm" variant="outline" className="mt-2">Buy Rent Cards</Button></Link>
            </div>
          </div>
        )}
        <Button disabled={draftsCount === 0 || !enoughCards} onClick={onNext}>
          Next: Tenant Details ({draftsCount})
        </Button>
      </>
    )}
  </motion.div>
);

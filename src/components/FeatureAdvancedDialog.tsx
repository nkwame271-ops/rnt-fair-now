import { useEffect, useState } from "react";
import { Loader2, Sliders } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  featureKey: string;
  featureLabel: string;
  initial: {
    fee_type?: string | null;
    billing_frequency?: string | null;
    payment_destination?: string | null;
    revenue_split_json?: any;
    expiry_days?: number | null;
    renewal_days?: number | null;
    grace_period_days?: number | null;
  };
  onSaved?: () => void;
}

type SplitRow = { destination: string; percentage: number };

export default function FeatureAdvancedDialog({ open, onOpenChange, featureKey, featureLabel, initial, onSaved }: Props) {
  const [feeType, setFeeType] = useState(initial.fee_type || "fixed");
  const [billing, setBilling] = useState(initial.billing_frequency || "one_time");
  const [destination, setDestination] = useState(initial.payment_destination || "platform");
  const [expiry, setExpiry] = useState<number | "">(initial.expiry_days ?? "");
  const [renewal, setRenewal] = useState<number | "">(initial.renewal_days ?? "");
  const [grace, setGrace] = useState<number | "">(initial.grace_period_days ?? 0);
  const [splits, setSplits] = useState<SplitRow[]>(
    Array.isArray(initial.revenue_split_json) ? initial.revenue_split_json : []
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setFeeType(initial.fee_type || "fixed");
      setBilling(initial.billing_frequency || "one_time");
      setDestination(initial.payment_destination || "platform");
      setExpiry(initial.expiry_days ?? "");
      setRenewal(initial.renewal_days ?? "");
      setGrace(initial.grace_period_days ?? 0);
      setSplits(Array.isArray(initial.revenue_split_json) ? initial.revenue_split_json : []);
    }
  }, [open]);

  const totalPct = splits.reduce((a, s) => a + Number(s.percentage || 0), 0);
  const splitInvalid = destination === "split" && Math.abs(totalPct - 100) > 0.01;

  const handleSave = async () => {
    if (splitInvalid) {
      toast.error("Revenue split must total 100%");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("feature_flags")
      .update({
        fee_type: feeType,
        billing_frequency: billing,
        payment_destination: destination,
        revenue_split_json: destination === "split" ? splits : [],
        expiry_days: expiry === "" ? null : Number(expiry),
        renewal_days: renewal === "" ? null : Number(renewal),
        grace_period_days: grace === "" ? 0 : Number(grace),
      })
      .eq("feature_key", featureKey);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Settings saved");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sliders className="h-5 w-5" /> Advanced Settings
          </DialogTitle>
          <DialogDescription>{featureLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fee Type</Label>
              <Select value={feeType} onValueChange={setFeeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed (GHS)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Billing Frequency</Label>
              <Select value={billing} onValueChange={setBilling}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Payment Destination</Label>
            <Select value={destination} onValueChange={setDestination}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="platform">Platform</SelectItem>
                <SelectItem value="office">Office (IGF)</SelectItem>
                <SelectItem value="landlord">Landlord</SelectItem>
                <SelectItem value="split">Split (custom)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {destination === "split" && (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Revenue Split ({totalPct.toFixed(1)}%)</Label>
                <Button size="sm" variant="outline" onClick={() => setSplits([...splits, { destination: "platform", percentage: 0 }])}>+ Add</Button>
              </div>
              {splits.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Select value={s.destination} onValueChange={(v) => { const next = [...splits]; next[i] = { ...s, destination: v }; setSplits(next); }}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="platform">Platform</SelectItem>
                      <SelectItem value="office">Office (IGF)</SelectItem>
                      <SelectItem value="landlord">Landlord</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="gra">GRA</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="number" min={0} max={100} step="0.1" className="w-24" value={s.percentage}
                    onChange={(e) => { const next = [...splits]; next[i] = { ...s, percentage: Number(e.target.value) }; setSplits(next); }} />
                  <Button size="sm" variant="ghost" onClick={() => setSplits(splits.filter((_, j) => j !== i))}>×</Button>
                </div>
              ))}
              {splitInvalid && <p className="text-xs text-destructive">Total must equal 100%</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Expiry (days)</Label>
              <Input type="number" min={0} value={expiry} onChange={(e) => setExpiry(e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" />
            </div>
            <div>
              <Label>Renewal (days)</Label>
              <Input type="number" min={0} value={renewal} onChange={(e) => setRenewal(e.target.value === "" ? "" : Number(e.target.value))} placeholder="—" />
            </div>
            <div>
              <Label>Grace (days)</Label>
              <Input type="number" min={0} value={grace} onChange={(e) => setGrace(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || splitInvalid}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

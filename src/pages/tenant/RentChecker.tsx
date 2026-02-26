import { useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { regions, areasByRegion, rentPrices, type PropertyType } from "@/data/dummyData";

const propertyTypes: PropertyType[] = ["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom"];

const RentChecker = () => {
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [type, setType] = useState<PropertyType | "">("");
  const [currentRent, setCurrentRent] = useState("");
  const [result, setResult] = useState<null | { min: number; avg: number; max: number; diff: number }>(null);

  const areas = region ? areasByRegion[region] || [] : [];

  const handleCheck = () => {
    const match = rentPrices.find(
      (r) => r.region === region && r.area === area && r.type === type
    );
    if (match) {
      const rent = parseFloat(currentRent) || 0;
      const diff = rent > 0 ? ((rent - match.avg) / match.avg) * 100 : 0;
      setResult({ min: match.min, avg: match.avg, max: match.max, diff });
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rent Price Checker</h1>
        <p className="text-muted-foreground mt-1">Compare your rent with market averages in your area</p>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={region} onValueChange={(v) => { setRegion(v); setArea(""); setResult(null); }}>
              <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
              <SelectContent>
                {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Area / Town</Label>
            <Select value={area} onValueChange={(v) => { setArea(v); setResult(null); }} disabled={!region}>
              <SelectTrigger><SelectValue placeholder="Select area" /></SelectTrigger>
              <SelectContent>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Property Type</Label>
            <Select value={type} onValueChange={(v) => { setType(v as PropertyType); setResult(null); }}>
              <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>
                {propertyTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Your Monthly Rent (GH₵)</Label>
            <Input
              type="number"
              placeholder="e.g. 800"
              value={currentRent}
              onChange={(e) => { setCurrentRent(e.target.value); setResult(null); }}
            />
          </div>
        </div>
        <Button onClick={handleCheck} className="w-full sm:w-auto" disabled={!region || !area || !type}>
          <Search className="h-4 w-4 mr-2" /> Check Rent Prices
        </Button>
      </div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
          {/* Price Range */}
          <div className="bg-card rounded-xl p-6 shadow-card border border-border">
            <h2 className="text-lg font-semibold text-card-foreground mb-4">Market Rent Range — {area}</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-muted rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Minimum</div>
                <div className="text-xl font-bold text-card-foreground">GH₵ {result.min.toLocaleString()}</div>
              </div>
              <div className="bg-primary/10 rounded-lg p-4">
                <div className="text-xs text-primary mb-1 font-medium">Average</div>
                <div className="text-xl font-bold text-primary">GH₵ {result.avg.toLocaleString()}</div>
              </div>
              <div className="bg-muted rounded-lg p-4">
                <div className="text-xs text-muted-foreground mb-1">Maximum</div>
                <div className="text-xl font-bold text-card-foreground">GH₵ {result.max.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Comparison */}
          {currentRent && (
            <div
              className={`rounded-xl p-6 border ${
                result.diff > 20
                  ? "bg-destructive/5 border-destructive/20"
                  : result.diff > 0
                  ? "bg-warning/5 border-warning/20"
                  : "bg-success/5 border-success/20"
              }`}
            >
              <div className="flex items-start gap-3">
                {result.diff > 20 ? (
                  <AlertTriangle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                ) : result.diff > 0 ? (
                  <TrendingUp className="h-6 w-6 text-warning shrink-0 mt-0.5" />
                ) : result.diff < -5 ? (
                  <TrendingDown className="h-6 w-6 text-success shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-6 w-6 text-success shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-foreground">
                    {result.diff > 20
                      ? "⚠️ Your rent may be significantly above market average"
                      : result.diff > 0
                      ? "Your rent is slightly above average"
                      : result.diff < -5
                      ? "Your rent is below market average — great deal!"
                      : "Your rent is within the fair market range"}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your rent of GH₵ {parseFloat(currentRent).toLocaleString()} is{" "}
                    <strong>{Math.abs(result.diff).toFixed(1)}%</strong>{" "}
                    {result.diff >= 0 ? "above" : "below"} the average of GH₵ {result.avg.toLocaleString()}.
                  </p>
                  {result.diff > 20 && (
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Recommended actions:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        <li>Request rent justification from your landlord</li>
                        <li>Document all communications</li>
                        <li>File a complaint with Rent Control</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default RentChecker;

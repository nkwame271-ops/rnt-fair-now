import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Building2 } from "lucide-react";
import { regions, areasByRegion, type PropertyType } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface UnitForm {
  name: string;
  type: PropertyType | "";
  rent: string;
}

const propertyTypes: PropertyType[] = ["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Self-Contained"];

const RegisterProperty = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [units, setUnits] = useState<UnitForm[]>([{ name: "Unit A", type: "", rent: "" }]);

  const areas = region ? areasByRegion[region] || [] : [];

  const addUnit = () => setUnits([...units, { name: `Unit ${String.fromCharCode(65 + units.length)}`, type: "", rent: "" }]);
  const removeUnit = (i: number) => setUnits(units.filter((_, idx) => idx !== i));
  const updateUnit = (i: number, key: keyof UnitForm, value: string) => {
    const updated = [...units];
    updated[i] = { ...updated[i], [key]: value };
    setUnits(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Property registered successfully! Code: GR-EL-2026-003");
    navigate("/landlord/my-properties");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Register Property</h1>
        <p className="text-muted-foreground mt-1">Add a new property with its units</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
          <h2 className="font-semibold text-card-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Property Details
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Property Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asante Residences" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 14 Palm Street" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={(v) => { setRegion(v); setArea(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Area</Label>
              <Select value={area} onValueChange={setArea} disabled={!region}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">Units ({units.length})</h2>
            <Button type="button" variant="outline" size="sm" onClick={addUnit}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Unit
            </Button>
          </div>
          <div className="space-y-3">
            {units.map((unit, i) => (
              <div key={i} className="bg-muted rounded-lg p-4 grid sm:grid-cols-4 gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Unit Name</Label>
                  <Input value={unit.name} onChange={(e) => updateUnit(i, "name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={unit.type} onValueChange={(v) => updateUnit(i, "type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{propertyTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rent (GH₵)</Label>
                  <Input type="number" value={unit.rent} onChange={(e) => updateUnit(i, "rent", e.target.value)} placeholder="e.g. 1200" />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => removeUnit(i)} disabled={units.length === 1} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full h-12 text-base font-semibold">
          Register Property
        </Button>
      </form>
    </div>
  );
};

export default RegisterProperty;

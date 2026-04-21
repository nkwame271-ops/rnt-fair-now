import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save, Lock, AlertTriangle, Building2 } from "lucide-react";
import { regions, areasByRegion } from "@/data/staticData";

const unitTypePresets = [
  "Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom",
  "Self-Contained", "Apartment", "Hostel Room", "Shop", "Office",
];

interface EditableUnit {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  bedroom_count: string;
  bathroom_count: string;
  has_toilet_bathroom: boolean;
  has_kitchen: boolean;
  water_available: boolean;
  electricity_available: boolean;
  has_borehole: boolean;
  has_polytank: boolean;
  amenities: string[];
  custom_amenities: string;
}

const amenityOptions = ["Security", "Parking", "Balcony", "Compound", "AC", "Generator", "Pool", "Gym"];

const EditProperty = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [propertyName, setPropertyName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [condition, setCondition] = useState("");
  const [ghanaPostGps, setGhanaPostGps] = useState("");
  const [propertyCategory, setPropertyCategory] = useState<"residential" | "commercial">("residential");
  const [ownershipType, setOwnershipType] = useState("owner");
  const [locationLocked, setLocationLocked] = useState(false);
  const [propertyStatus, setPropertyStatus] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);
  const [units, setUnits] = useState<EditableUnit[]>([]);
  const [occupiedUnitIds, setOccupiedUnitIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !id) return;
    const fetchData = async () => {
      const [{ data: prop, error: propErr }, { data: unitData }] = await Promise.all([
        supabase.from("properties").select("*").eq("id", id).eq("landlord_user_id", user.id).single(),
        supabase.from("units").select("*").eq("property_id", id),
      ]);
      if (propErr || !prop) {
        toast.error("Property not found");
        navigate("/landlord/my-properties");
        return;
      }
      setPropertyName(prop.property_name || "");
      setAddress(prop.address);
      setRegion(prop.region);
      setArea(prop.area);
      setCondition(prop.property_condition || "");
      setGhanaPostGps(prop.ghana_post_gps || "");
      setPropertyCategory(((prop as any).property_category as "residential" | "commercial") || "residential");
      setOwnershipType((prop as any).ownership_type || "owner");
      setLocationLocked(prop.location_locked || false);
      setPropertyStatus((prop as any).property_status || "");
      setSuggestedPrice((prop as any).suggested_price ? Number((prop as any).suggested_price) : null);
      setUnits((unitData || []).map((u: any) => ({
        id: u.id,
        unit_name: u.unit_name || "",
        unit_type: u.unit_type || "",
        monthly_rent: u.monthly_rent || 0,
        bedroom_count: u.room_count?.toString() || "",
        bathroom_count: u.bathroom_count?.toString() || "",
        has_toilet_bathroom: u.has_toilet_bathroom || false,
        has_kitchen: u.has_kitchen || false,
        water_available: u.water_available || false,
        electricity_available: u.electricity_available || false,
        has_borehole: u.has_borehole || false,
        has_polytank: u.has_polytank || false,
        amenities: u.amenities || [],
        custom_amenities: u.custom_amenities || "",
      })));

      // Check which units have active tenancies (rent locked)
      const unitIds = (unitData || []).map((u: any) => u.id);
      if (unitIds.length > 0) {
        const { data: activeTenancies } = await supabase
          .from("tenancies")
          .select("unit_id")
          .in("unit_id", unitIds)
          .in("status", ["active", "pending", "renewal_window", "existing_declared", "awaiting_verification", "verified_existing"]);
        if (activeTenancies) {
          setOccupiedUnitIds(new Set(activeTenancies.map((t: any) => t.unit_id)));
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [user, id, navigate]);

  const updateUnit = (i: number, updates: Partial<EditableUnit>) => {
    const updated = [...units];
    updated[i] = { ...updated[i], ...updates };
    setUnits(updated);
  };

  const toggleAmenity = (i: number, amenity: string) => {
    const unit = units[i];
    const newAmenities = unit.amenities.includes(amenity)
      ? unit.amenities.filter(a => a !== amenity)
      : [...unit.amenities, amenity];
    updateUnit(i, { amenities: newAmenities });
  };

  const handleSave = async () => {
    if (!address || !region || !area) {
      toast.error("Address, region, and area are required");
      return;
    }
    setSaving(true);
    const normalizedAddr = address.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const { error } = await supabase
      .from("properties")
      .update({
        property_name: propertyName || null,
        address,
        region,
        area,
        property_condition: condition || null,
        ghana_post_gps: locationLocked ? undefined : (ghanaPostGps || null),
        property_category: propertyCategory,
        ownership_type: ownershipType,
        normalized_address: normalizedAddr,
      } as any)
      .eq("id", id!)
      .eq("landlord_user_id", user!.id);

    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }

    // Save unit changes
    for (const unit of units) {
      const { error: unitErr } = await supabase.from("units").update({
        unit_name: unit.unit_name,
        unit_type: unit.unit_type,
        has_toilet_bathroom: unit.has_toilet_bathroom,
        has_kitchen: unit.has_kitchen,
        water_available: unit.water_available,
        electricity_available: unit.electricity_available,
        has_borehole: unit.has_borehole,
        has_polytank: unit.has_polytank,
        amenities: unit.amenities,
        custom_amenities: unit.custom_amenities || null,
      } as any).eq("id", unit.id);
      if (unitErr) {
        toast.error(`Failed to update ${unit.unit_name}: ${unitErr.message}`);
      }
    }

    toast.success("Property updated successfully");
    navigate("/landlord/my-properties");
    setSaving(false);
  };

  const handleResubmit = async () => {
    setSaving(true);
    const { error } = await supabase.from("properties").update({
      property_status: "pending_assessment",
    } as any).eq("id", id!).eq("landlord_user_id", user!.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Property resubmitted for assessment");
      navigate("/landlord/my-properties");
    }
    setSaving(false);
  };

  const areas = region ? areasByRegion[region] || [] : [];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate("/landlord/my-properties")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to My Properties
      </button>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit Property</h1>
        <p className="text-muted-foreground mt-1">Update your property details and units</p>
      </div>

      {/* Needs Update banner */}
      {propertyStatus === "needs_update" && suggestedPrice && (
        <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-300">Pricing update required by admin</p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                Suggested monthly rent: <strong>GH₵ {suggestedPrice.toLocaleString()}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">Adjust your unit rents below, then resubmit for assessment.</p>
            </div>
          </div>
        </div>
      )}

      {/* Property Details */}
      <div className="bg-card rounded-xl p-6 border border-border space-y-4">
        <h2 className="font-semibold text-card-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Property Details
        </h2>
        <div className="space-y-2">
          <Label>Property Name</Label>
          <Input value={propertyName} onChange={(e) => setPropertyName(e.target.value)} placeholder="e.g. Asante Villa" />
        </div>
        <div className="space-y-2">
          <Label>Address *</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 12 Ring Road" />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Region *</Label>
            <Select value={region} onValueChange={(v) => { setRegion(v); setArea(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Area *</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Property Category *</Label>
          <Select value={propertyCategory} onValueChange={(v) => setPropertyCategory(v as "residential" | "commercial")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="residential">Residential Property</SelectItem>
              <SelectItem value="commercial">Commercial Property</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Ownership Type</Label>
          <Select value={ownershipType} onValueChange={setOwnershipType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="caretaker">Caretaker</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Property Condition</Label>
          <Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Newly built, Good condition" />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            Ghana Post GPS
            {locationLocked && <span className="flex items-center gap-1 text-xs text-warning"><Lock className="h-3 w-3" /> Locked</span>}
          </Label>
          <Input
            value={ghanaPostGps}
            onChange={(e) => setGhanaPostGps(e.target.value)}
            placeholder="e.g. GA-123-4567"
            disabled={locationLocked}
          />
          {locationLocked && <p className="text-xs text-muted-foreground">Location is locked after approval. Contact admin to change.</p>}
        </div>
      </div>

      {/* Units Section */}
      {units.length > 0 && (
        <div className="bg-card rounded-xl p-6 border border-border space-y-4">
          <h2 className="font-semibold text-card-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Units ({units.length})
          </h2>
          {units.map((unit, i) => (
            <div key={unit.id} className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1 flex-1 min-w-[120px]">
                  <Label className="text-xs">Unit Name</Label>
                  <Input value={unit.unit_name} onChange={(e) => updateUnit(i, { unit_name: e.target.value })} />
                </div>
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <Label className="text-xs">Unit Type</Label>
                  <Input
                    value={unit.unit_type}
                    onChange={(e) => updateUnit(i, { unit_type: e.target.value })}
                    placeholder="e.g. 3-Bedroom Duplex with BQ"
                  />
                </div>
              </div>

              {/* Quick type presets */}
              <div className="flex flex-wrap gap-1">
                {unitTypePresets.map((preset) => (
                  <Badge
                    key={preset}
                    variant={unit.unit_type === preset ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => updateUnit(i, { unit_type: preset })}
                  >
                    {preset}
                  </Badge>
                ))}
              </div>

              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1 w-24">
                  <Label className="text-xs">Bedrooms</Label>
                  <Input type="number" value={unit.bedroom_count} onChange={(e) => updateUnit(i, { bedroom_count: e.target.value })} placeholder="0" min="0" />
                </div>
                <div className="space-y-1 w-24">
                  <Label className="text-xs">Bathrooms</Label>
                  <Input type="number" value={unit.bathroom_count} onChange={(e) => updateUnit(i, { bathroom_count: e.target.value })} placeholder="0" min="0" />
                </div>
                <div className="space-y-1 w-32">
                  <Label className="text-xs flex items-center gap-1">
                    Rent (GH₵)
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  </Label>
                  <Input
                    type="number"
                    value={unit.monthly_rent}
                    readOnly
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-[10px] text-muted-foreground">Rent is managed by Rent Control. Use Rent Increase Application to request a change.</p>
                </div>
              </div>

              {/* Facilities */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: "has_toilet_bathroom" as const, label: "Toilet/Bathroom" },
                  { key: "has_kitchen" as const, label: "Kitchen" },
                  { key: "water_available" as const, label: "Water" },
                  { key: "electricity_available" as const, label: "Electricity" },
                  { key: "has_borehole" as const, label: "Borehole" },
                  { key: "has_polytank" as const, label: "Polytank" },
                ].map((fac) => (
                  <label key={fac.key} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={unit[fac.key]}
                      onCheckedChange={(c) => updateUnit(i, { [fac.key]: !!c })}
                    />
                    {fac.label}
                  </label>
                ))}
              </div>

              {/* Amenities */}
              <div className="flex flex-wrap gap-1">
                {amenityOptions.map((a) => (
                  <Badge
                    key={a}
                    variant={unit.amenities.includes(a) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleAmenity(i, a)}
                  >
                    {a}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={saving} className="flex-1">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
        {propertyStatus === "needs_update" && (
          <Button onClick={handleResubmit} disabled={saving} variant="outline" className="text-orange-600 border-orange-300 hover:bg-orange-50">
            Resubmit for Assessment
          </Button>
        )}
      </div>
    </div>
  );
};

export default EditProperty;
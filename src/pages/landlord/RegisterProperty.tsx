import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { PlusCircle, Trash2, Building2, Upload, X, Store } from "lucide-react";
import { regions, areasByRegion, type PropertyType } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PropertyLocationPicker from "@/components/PropertyLocationPicker";

interface UnitForm {
  name: string;
  type: PropertyType | "";
  rent: string;
  hasToiletBathroom: boolean;
  hasKitchen: boolean;
  waterAvailable: boolean;
  electricityAvailable: boolean;
  hasBorehole: boolean;
  hasPolytank: boolean;
  amenities: string[];
  customAmenities: string;
}

const propertyTypes: PropertyType[] = ["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Self-Contained"];
const amenityOptions = ["Security", "Parking", "Balcony", "Compound", "AC", "Generator", "Pool", "Gym"];

const RegisterProperty = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [area, setArea] = useState("");
  const [customArea, setCustomArea] = useState("");
  const [gpsLocation, setGpsLocation] = useState("");
  const [propertyCondition, setPropertyCondition] = useState("");
  const [listOnMarketplace, setListOnMarketplace] = useState(false);
  const [payingListingFee, setPayingListingFee] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [units, setUnits] = useState<UnitForm[]>([{
    name: "Unit A", type: "", rent: "",
    hasToiletBathroom: false, hasKitchen: false, waterAvailable: false,
    electricityAvailable: false, hasBorehole: false, hasPolytank: false,
    amenities: [], customAmenities: "",
  }]);

  const areas = region ? areasByRegion[region] || [] : [];
  const effectiveArea = customArea.trim() || area;

  const addUnit = () => setUnits([...units, {
    name: `Unit ${String.fromCharCode(65 + units.length)}`, type: "", rent: "",
    hasToiletBathroom: false, hasKitchen: false, waterAvailable: false,
    electricityAvailable: false, hasBorehole: false, hasPolytank: false,
    amenities: [], customAmenities: "",
  }]);
  const removeUnit = (i: number) => setUnits(units.filter((_, idx) => idx !== i));
  const updateUnit = (i: number, updates: Partial<UnitForm>) => {
    const updated = [...units];
    updated[i] = { ...updated[i], ...updates };
    setUnits(updated);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles].slice(0, 6));
    }
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!effectiveArea) {
      toast.error("Please select or type an area");
      return;
    }
    setSubmitting(true);

    try {
      if (listOnMarketplace && images.length === 0) {
        toast.error("Please upload at least one image to list on the marketplace");
        setSubmitting(false);
        return;
      }

      const regionCode = region.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const areaCode = effectiveArea.slice(0, 2).toUpperCase();
      const propertyCode = `${regionCode}-${areaCode}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;

      const shouldList = listOnMarketplace;
      
      const { data: prop, error: propErr } = await supabase.from("properties").insert({
        landlord_user_id: user.id,
        property_name: name,
        address,
        region,
        area: effectiveArea,
        property_code: propertyCode,
        gps_location: gpsLocation || null,
        property_condition: propertyCondition || null,
        listed_on_marketplace: false,
      } as any).select().single();

      if (propErr) throw propErr;

      // Upload images
      for (let i = 0; i < images.length; i++) {
        const file = images[i];
        const ext = file.name.split(".").pop();
        const path = `${prop.id}/${Date.now()}_${i}.${ext}`;
        const { error: upErr } = await supabase.storage.from("property-images").upload(path, file);
        if (upErr) { console.error(upErr); continue; }
        const { data: { publicUrl } } = supabase.storage.from("property-images").getPublicUrl(path);
        await supabase.from("property_images").insert({
          property_id: prop.id,
          image_url: publicUrl,
          is_primary: i === 0,
        });
      }

      // Insert units
      for (const u of units) {
        if (!u.type || !u.rent) continue;
        await supabase.from("units").insert({
          property_id: prop.id,
          unit_name: u.name,
          unit_type: u.type,
          monthly_rent: parseFloat(u.rent),
          has_toilet_bathroom: u.hasToiletBathroom,
          has_kitchen: u.hasKitchen,
          water_available: u.waterAvailable,
          electricity_available: u.electricityAvailable,
          has_borehole: u.hasBorehole,
          has_polytank: u.hasPolytank,
          amenities: u.amenities,
          custom_amenities: u.customAmenities || null,
        });
      }

      if (shouldList) {
        setPayingListingFee(true);
        try {
          const { data: payData, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
            body: { type: "listing_fee", propertyId: prop.id },
          });
          if (payErr) throw new Error(payErr.message);
          if (payData?.error) throw new Error(payData.error);
          if (payData?.authorization_url) {
            toast.success(`Property registered! Code: ${propertyCode}. Redirecting to pay listing fee...`);
            window.location.href = payData.authorization_url;
            return;
          }
        } catch (payError: any) {
          toast.error(`Property saved but listing fee payment failed: ${payError.message}. You can pay later from My Properties.`);
        } finally {
          setPayingListingFee(false);
        }
      }

      toast.success(`Property registered! Code: ${propertyCode}`);
      navigate("/landlord/my-properties");
    } catch (err: any) {
      toast.error(err.message || "Failed to register property");
    } finally {
      setSubmitting(false);
    }
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
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Asante Residences" />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 14 Palm Street" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Region</Label>
              <Select value={region} onValueChange={(v) => { setRegion(v); setArea(""); setCustomArea(""); }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Area</Label>
              <Select value={area} onValueChange={(v) => { setArea(v); setCustomArea(""); }} disabled={!region}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <Input
                value={customArea}
                onChange={(e) => { setCustomArea(e.target.value); if (e.target.value) setArea(""); }}
                placeholder="Or type your area if not listed"
                className="text-sm"
              />
            </div>
          </div>

          {/* GPS — Interactive Map Picker */}
          <PropertyLocationPicker
            region={region}
            value={gpsLocation}
            onLocationChange={(loc) => {
              setGpsLocation(loc ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}` : "");
            }}
          />

          {/* Property condition */}
          <div className="space-y-2">
            <Label>Property Condition Notes</Label>
            <Textarea value={propertyCondition} onChange={(e) => setPropertyCondition(e.target.value)} placeholder="Describe overall condition, recent renovations, etc." rows={3} />
          </div>

          {/* Marketplace toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4 bg-muted/50">
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-primary" />
              <div>
                <Label className="text-sm font-medium">List on Marketplace</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Make vacant units visible to tenants (GH₵ 2 listing fee applies)</p>
              </div>
            </div>
            <Switch checked={listOnMarketplace} onCheckedChange={setListOnMarketplace} />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" /> Property Images (up to 6)
              {listOnMarketplace && <span className="text-destructive ml-1">*</span>}
            </Label>
            {listOnMarketplace && images.length === 0 && (
              <p className="text-xs text-destructive">At least one image is required for marketplace listings</p>
            )}
            <input type="file" accept="image/*" multiple onChange={handleImageChange} className="text-sm" />
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {images.map((img, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                    <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeImage(i)} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Units */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-card-foreground">Units ({units.length})</h2>
            <Button type="button" variant="outline" size="sm" onClick={addUnit}>
              <PlusCircle className="h-4 w-4 mr-1" /> Add Unit
            </Button>
          </div>
          <div className="space-y-4">
            {units.map((unit, i) => (
              <div key={i} className="bg-muted rounded-lg p-4 space-y-3">
                <div className="grid sm:grid-cols-4 gap-3 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Unit Name</Label>
                    <Input value={unit.name} onChange={(e) => updateUnit(i, { name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Type</Label>
                    <Select value={unit.type} onValueChange={(v) => updateUnit(i, { type: v as PropertyType })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{propertyTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Rent (GH₵)</Label>
                    <Input type="number" value={unit.rent} onChange={(e) => updateUnit(i, { rent: e.target.value })} placeholder="e.g. 1200" />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeUnit(i)} disabled={units.length === 1} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* Facilities */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {[
                    { key: "hasToiletBathroom", label: "Toilet/Bathroom" },
                    { key: "hasKitchen", label: "Kitchen" },
                    { key: "waterAvailable", label: "Water" },
                    { key: "electricityAvailable", label: "Electricity" },
                    { key: "hasBorehole", label: "Borehole" },
                    { key: "hasPolytank", label: "Polytank" },
                  ].map((f) => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={(unit as any)[f.key]} onCheckedChange={(v) => updateUnit(i, { [f.key]: !!v })} />
                      <span>{f.label}</span>
                    </label>
                  ))}
                </div>
                {/* Amenities */}
                <div className="flex flex-wrap gap-2">
                  {amenityOptions.map((a) => (
                    <label key={a} className="flex items-center gap-1.5 text-xs cursor-pointer bg-background px-2 py-1 rounded-full border border-border">
                      <Checkbox
                        checked={unit.amenities.includes(a)}
                        onCheckedChange={(v) => {
                          const newA = v ? [...unit.amenities, a] : unit.amenities.filter(x => x !== a);
                          updateUnit(i, { amenities: newA });
                        }}
                      />
                      {a}
                    </label>
                  ))}
                </div>
                <Input
                  value={unit.customAmenities}
                  onChange={(e) => updateUnit(i, { customAmenities: e.target.value })}
                  placeholder="Other amenities (comma-separated)"
                  className="text-xs"
                />
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={submitting || payingListingFee}>
          {payingListingFee ? "Redirecting to payment..." : submitting ? "Registering..." : listOnMarketplace ? "Register & Pay Listing Fee (GH₵ 2)" : "Register Property"}
        </Button>
      </form>
    </div>
  );
};

export default RegisterProperty;

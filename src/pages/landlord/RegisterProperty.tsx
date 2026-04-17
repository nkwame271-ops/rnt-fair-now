import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PlusCircle, Trash2, Building2, Upload, X, Store, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { regions, areasByRegion } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import KycGate from "@/components/KycGate";
import PropertyLocationPicker from "@/components/PropertyLocationPicker";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Badge } from "@/components/ui/badge";

const unitTypePresets = [
  "Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom",
  "Self-Contained", "Apartment", "Hostel Room", "Shop", "Office",
];

interface UnitForm {
  name: string;
  type: string;
  rent: string;
  bedroomCount: string;
  bathroomCount: string;
  hasToiletBathroom: boolean;
  hasKitchen: boolean;
  waterAvailable: boolean;
  electricityAvailable: boolean;
  hasBorehole: boolean;
  hasPolytank: boolean;
  amenities: string[];
  customAmenities: string;
  benchmark?: { pricing_band: string; pricing_label: string; benchmark_min: number; benchmark_max: number; benchmark_expected: number; confidence: string };
}

interface HostelCategoryForm {
  label: string;
  capacityPerRoom: string;
  roomCount: string;
  monthlyRent: string;
  blockLabel: string;
}

const amenityOptions = ["Security", "Parking", "Balcony", "Compound", "AC", "Generator", "Pool", "Gym"];

const createEmptyUnit = (index: number): UnitForm => ({
  name: index === 0 ? "Unit A" : `Unit ${String.fromCharCode(65 + index)}`,
  type: "", rent: "", bedroomCount: "", bathroomCount: "",
  hasToiletBathroom: false, hasKitchen: false, waterAvailable: false,
  electricityAvailable: false, hasBorehole: false, hasPolytank: false,
  amenities: [], customAmenities: "",
});

const createEmptyHostelCategory = (): HostelCategoryForm => ({
  label: "", capacityPerRoom: "", roomCount: "", monthlyRent: "", blockLabel: "Block A",
});

const normalizeAddress = (addr: string) => addr.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();

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
  const [gpsConfirmed, setGpsConfirmed] = useState(false);
  const [ghanaPostGps, setGhanaPostGps] = useState("");
  const [propertyCondition, setPropertyCondition] = useState("");
  const [propertyCategory, setPropertyCategory] = useState<"residential" | "commercial" | "hostel">("residential");
  const [images, setImages] = useState<File[]>([]);
  const [ownershipType, setOwnershipType] = useState("owner");
  const [propertyStructure, setPropertyStructure] = useState<"single_unit" | "multi_unit">("single_unit");
  const [occupancyStatus, setOccupancyStatus] = useState<"vacant" | "occupied">("vacant");
  const [units, setUnits] = useState<UnitForm[]>([createEmptyUnit(0)]);
  const [hostelCategories, setHostelCategories] = useState<HostelCategoryForm[]>([createEmptyHostelCategory()]);

  const isHostel = propertyCategory === "hostel";

  const areas = region ? areasByRegion[region] || [] : [];
  const effectiveArea = customArea.trim() || area;

  const addUnit = () => setUnits([...units, createEmptyUnit(units.length)]);
  const removeUnit = (i: number) => setUnits(units.filter((_, idx) => idx !== i));
  const updateUnit = (i: number, updates: Partial<UnitForm>) => {
    const updated = [...units];
    updated[i] = { ...updated[i], ...updates };
    setUnits(updated);
  };

  const addHostelCategory = () => setHostelCategories([...hostelCategories, createEmptyHostelCategory()]);
  const removeHostelCategory = (i: number) => setHostelCategories(hostelCategories.filter((_, idx) => idx !== i));
  const updateHostelCategory = (i: number, updates: Partial<HostelCategoryForm>) => {
    const updated = [...hostelCategories];
    updated[i] = { ...updated[i], ...updates };
    setHostelCategories(updated);
  };

  const hostelTotals = hostelCategories.reduce(
    (acc, c) => {
      const rooms = parseInt(c.roomCount) || 0;
      const cap = parseInt(c.capacityPerRoom) || 0;
      acc.rooms += rooms;
      acc.beds += rooms * cap;
      return acc;
    },
    { rooms: 0, beds: 0 }
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setImages(prev => [...prev, ...newFiles].slice(0, 6));
    }
  };

  const removeImage = (idx: number) => setImages(images.filter((_, i) => i !== idx));

  const computeBenchmarkForUnit = async (unitIndex: number, propertyId?: string) => {
    const unit = units[unitIndex];
    if (!unit.type || !unit.rent || !region || !effectiveArea) return;

    try {
      const { data, error } = await supabase.functions.invoke("compute-rent-benchmark", {
        body: {
          property_id: propertyId || null,
          unit_id: null,
          zone_key: `${region}|${effectiveArea}`,
          property_class: unit.type,
          asking_rent: parseFloat(unit.rent),
        },
      });
      if (error) throw error;
      if (data) {
        updateUnit(unitIndex, { benchmark: data });
      }
    } catch (err) {
      console.error("Benchmark computation failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!effectiveArea) {
      toast.error("Please select or type an area");
      return;
    }
    if (!gpsLocation) {
      toast.error("Please select the property location on the map");
      return;
    }
    if (!gpsConfirmed) {
      toast.error("Please confirm the pin represents the property's physical location");
      return;
    }
    if (!ghanaPostGps.trim()) {
      toast.error("Ghana Post GPS code is required");
      return;
    }

    setSubmitting(true);

    try {
      const normalizedAddr = normalizeAddress(address);
      const fingerprint = `${ghanaPostGps.toUpperCase().replace(/\s/g, "")}|${normalizedAddr}|${gpsLocation}`;

      // Check for duplicate property
      const { data: dupCheck } = await supabase.functions.invoke("check-property-duplicate", {
        body: {
          gps_location: gpsLocation,
          ghana_post_gps: ghanaPostGps,
          normalized_address: normalizedAddr,
          landlord_user_id: user.id,
          region,
          area: effectiveArea,
        },
      });

      let propertyStatus = "pending_assessment";
      const isOccupied = occupancyStatus === "occupied";
      let existingPropertyId: string | undefined;

      if (dupCheck?.match === "high") {
        const isArchived = dupCheck.propertyStatus === "archived";
        if (isArchived) {
          toast.warning("This property was previously archived. It has been linked to the existing record. Contact an administrator to restore it.");
        } else {
          toast.info("This property appears to already exist in the system. It has been linked to the existing record.");
        }
        existingPropertyId = dupCheck.existingPropertyId;
        navigate("/landlord/my-properties");
        return;
      } else if (dupCheck?.match === "medium") {
        propertyStatus = "pending_identity_review";
        existingPropertyId = dupCheck.existingPropertyId;
        toast.info("This property may already exist (including archived records). It will be reviewed by an administrator.");
      }

      const regionCode = region.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
      const areaCode = effectiveArea.slice(0, 2).toUpperCase();
      const propertyCode = `${regionCode}-${areaCode}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999)).padStart(3, "0")}`;

      const { data: prop, error: propErr } = await supabase.from("properties").insert({
        landlord_user_id: user.id,
        property_name: name,
        address,
        region,
        area: effectiveArea,
        property_code: propertyCode,
        gps_location: gpsLocation,
        gps_confirmed: true,
        gps_confirmed_at: new Date().toISOString(),
        ghana_post_gps: ghanaPostGps,
        property_condition: propertyCondition || null,
        property_category: propertyCategory,
        listed_on_marketplace: false,
        property_status: propertyStatus,
        occupancy_type: isOccupied ? "occupied" : "vacant",
        ownership_type: ownershipType,
        property_structure: propertyStructure,
        normalized_address: normalizedAddr,
        property_fingerprint: fingerprint,
        ...(existingPropertyId ? { duplicate_of_property_id: existingPropertyId } : {}),
        ...(dupCheck?.existingRent ? { duplicate_old_rent: dupCheck.existingRent } : {}),
      } as any).select().single();

      if (propErr) throw propErr;

      // Log property creation event
      await supabase.from("property_events").insert({
        property_id: prop.id,
        event_type: "status_change",
        old_value: {},
        new_value: { status: propertyStatus },
        performed_by: user.id,
        reason: "Property registered",
      } as any);

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

      if (isHostel) {
        // Hostel branch: create categories, rooms, and bed-space units
        const validCats = hostelCategories.filter(
          (c) => c.label.trim() && parseInt(c.roomCount) > 0 && parseInt(c.capacityPerRoom) > 0
        );
        if (validCats.length === 0) {
          throw new Error("Please add at least one room category");
        }
        for (const cat of validCats) {
          const roomCount = parseInt(cat.roomCount);
          const capacity = parseInt(cat.capacityPerRoom);
          const rentPerBed = parseFloat(cat.monthlyRent) || 0;
          const blockLabel = cat.blockLabel.trim() || "Block A";

          const { data: catRow, error: catErr } = await supabase
            .from("hostel_room_categories")
            .insert({
              property_id: prop.id,
              label: cat.label.trim(),
              capacity_per_room: capacity,
              room_count: roomCount,
              monthly_rent: rentPerBed,
              block_label: blockLabel,
            } as any)
            .select()
            .single();
          if (catErr) throw catErr;

          // Generate rooms (numbered 001, 002, ...)
          const roomsPayload = Array.from({ length: roomCount }, (_, idx) => ({
            property_id: prop.id,
            category_id: catRow.id,
            block_label: blockLabel,
            room_number: String(idx + 1).padStart(3, "0"),
            capacity,
          }));
          const { data: roomRows, error: roomsErr } = await supabase
            .from("hostel_rooms")
            .insert(roomsPayload as any)
            .select();
          if (roomsErr) throw roomsErr;

          // Generate bed-space units for each room
          const bedsPayload = (roomRows || []).flatMap((room: any) =>
            Array.from({ length: capacity }, (_, bedIdx) => ({
              property_id: prop.id,
              hostel_room_id: room.id,
              unit_kind: "bed_space",
              unit_name: `${blockLabel} – Room ${room.room_number} – Bed ${bedIdx + 1}`,
              unit_type: cat.label.trim(),
              bed_label: `Bed ${bedIdx + 1}`,
              monthly_rent: rentPerBed,
              status: "vacant",
            }))
          );
          if (bedsPayload.length > 0) {
            const { error: bedsErr } = await supabase.from("units").insert(bedsPayload as any);
            if (bedsErr) throw bedsErr;
          }
        }
      } else {
        // Standard branch: create units and compute benchmarks
        for (const u of units) {
          if (!u.type || !u.rent) continue;
          const { data: unitData } = await supabase.from("units").insert({
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
          }).select().single();

          // Compute benchmark for each unit
          if (unitData) {
            await supabase.functions.invoke("compute-rent-benchmark", {
              body: {
                property_id: prop.id,
                unit_id: unitData.id,
                zone_key: `${region}|${effectiveArea}`,
                property_class: u.type,
                asking_rent: parseFloat(u.rent),
              },
            });

            // Store market data event
            await supabase.from("rent_market_data").insert({
              property_id: prop.id,
              unit_id: unitData.id,
              zone_key: `${region}|${effectiveArea}`,
              property_class: u.type,
              asking_rent: parseFloat(u.rent),
              event_type: "listing",
              event_date: new Date().toISOString().split("T")[0],
            } as any);
          }
        }
      }

      toast.success(`Property registered! Code: ${propertyCode}. ${propertyStatus === "pending_identity_review" ? "Under identity review." : "Under assessment."}`);
      if (isOccupied) {
        navigate(`/landlord/declare-existing-tenancy?propertyId=${prop.id}`);
      } else {
        navigate("/landlord/my-properties");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to register property");
    } finally {
      setSubmitting(false);
    }
  };

  const getBenchmarkBadge = (benchmark?: UnitForm["benchmark"]) => {
    if (!benchmark || benchmark.pricing_band === "unknown") return null;
    const colors: Record<string, string> = {
      within: "bg-success/10 text-success border-success/20",
      above: "bg-warning/10 text-warning border-warning/20",
      pending_justification: "bg-orange-100 text-orange-700 border-orange-200",
      rejected: "bg-destructive/10 text-destructive border-destructive/20",
    };
    const icons: Record<string, React.ReactNode> = {
      within: <CheckCircle2 className="h-3 w-3" />,
      above: <AlertTriangle className="h-3 w-3" />,
      pending_justification: <Clock className="h-3 w-3" />,
      rejected: <X className="h-3 w-3" />,
    };
    return (
      <Badge variant="outline" className={`text-xs gap-1 ${colors[benchmark.pricing_band] || ""}`}>
        {icons[benchmark.pricing_band]} {benchmark.pricing_label}
      </Badge>
    );
  };

  return (
    <KycGate action="register a property">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Register Property</h1>
          <p className="text-muted-foreground mt-1">Add a new property with its units</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Property Details ── */}
          <ErrorBoundary section="Property Details">
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
                  <Label>Address *</Label>
                  <Input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="e.g. 14 Palm Street" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Region *</Label>
                  <Select value={region} onValueChange={(v) => { setRegion(v); setArea(""); setCustomArea(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Area *</Label>
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

              {/* Ownership Type */}
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

              {/* Property Structure */}
              <div className="space-y-3">
                <Label>Property Structure *</Label>
                <RadioGroup value={propertyStructure} onValueChange={(v) => {
                  setPropertyStructure(v as "single_unit" | "multi_unit");
                  if (v === "single_unit" && units.length > 1) {
                    setUnits([units[0]]);
                  }
                }} className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="single_unit" />
                    <span className="text-sm">Single unit property</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="multi_unit" />
                    <span className="text-sm">Multi-unit property</span>
                  </label>
                </RadioGroup>
                <p className="text-xs text-muted-foreground">
                  {propertyStructure === "single_unit" ? "One unit will be created automatically." : "Add multiple units to this property."}
                </p>
              </div>

              {/* Occupancy Status */}
              <div className="space-y-3">
                <Label>Occupancy Status *</Label>
                <RadioGroup value={occupancyStatus} onValueChange={(v) => setOccupancyStatus(v as "vacant" | "occupied")} className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="vacant" />
                    <span className="text-sm">Vacant — no current tenant</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <RadioGroupItem value="occupied" />
                    <span className="text-sm">Occupied — has existing tenant</span>
                  </label>
                </RadioGroup>
                {occupancyStatus === "occupied" && (
                  <div className="flex items-center gap-2 text-xs text-info bg-info/5 p-3 rounded-lg border border-info/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-info shrink-0" />
                    <span>This property is occupied. After registration, you will be redirected to declare the existing tenancy. The property will not be listed on the marketplace.</span>
                  </div>
                )}
              </div>

              {/* GPS — Map Picker */}
              <ErrorBoundary section="Property Location Map">
                <PropertyLocationPicker
                  region={region}
                  value={gpsLocation}
                  required={true}
                  confirmed={gpsConfirmed}
                  ghanaPostGps={ghanaPostGps}
                  onLocationChange={(loc) => {
                    setGpsLocation(loc ? `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}` : "");
                    if (loc?.address && !address) setAddress(loc.address);
                  }}
                  onConfirmChange={(next) => setGpsConfirmed(!!next)}
                  onGhanaPostGpsChange={setGhanaPostGps}
                />
              </ErrorBoundary>

              {/* Ghana Post GPS required notice */}
              {!ghanaPostGps.trim() && (
                <div className="flex items-center gap-2 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Ghana Post GPS code is required for property registration</span>
                </div>
              )}

              {/* Property Category */}
              <div className="space-y-2">
                <Label>Property Category *</Label>
                <Select value={propertyCategory} onValueChange={(v) => setPropertyCategory(v as "residential" | "commercial" | "hostel")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential Property</SelectItem>
                    <SelectItem value="commercial">Commercial Property</SelectItem>
                    <SelectItem value="hostel">Hostel (for Students)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Hostels are shown only to student tenants. Determines applicable tax rate.</p>
              </div>

              {/* Property condition */}
              <div className="space-y-2">
                <Label>Property Condition Notes</Label>
                <Textarea value={propertyCondition} onChange={(e) => setPropertyCondition(e.target.value)} placeholder="Describe overall condition, recent renovations, etc." rows={3} />
              </div>

              {/* Processing notice */}
              {occupancyStatus === "vacant" && (
                <div className="flex items-center gap-3 rounded-lg border border-primary/30 p-4 bg-primary/5">
                  <Store className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Marketplace Listing</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Your property will be listed on the marketplace after it has been assessed and approved by Rent Control.</p>
                  </div>
                </div>
              )}

              {/* Images */}
              <ErrorBoundary section="Image Upload">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" /> Property Images (up to 6)
                  </Label>
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
              </ErrorBoundary>
            </div>
          </ErrorBoundary>

          {/* ── Hostel Room Categories ── */}
          {isHostel && (
            <ErrorBoundary section="Hostel Rooms">
              <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h2 className="font-semibold text-card-foreground">Hostel Room Categories</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define room types — the system will auto-generate rooms and bed-spaces.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {hostelTotals.rooms} rooms · {hostelTotals.beds} beds
                    </Badge>
                    <Button type="button" variant="outline" size="sm" onClick={addHostelCategory}>
                      <PlusCircle className="h-4 w-4 mr-1" /> Add Category
                    </Button>
                  </div>
                </div>
                <div className="space-y-4">
                  {hostelCategories.map((cat, i) => {
                    const rooms = parseInt(cat.roomCount) || 0;
                    const cap = parseInt(cat.capacityPerRoom) || 0;
                    return (
                      <div key={i} className="bg-muted rounded-lg p-4 space-y-3">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Category Label *</Label>
                            <Input
                              value={cat.label}
                              onChange={(e) => updateHostelCategory(i, { label: e.target.value })}
                              placeholder="e.g. 4-in-room"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Capacity / Room *</Label>
                            <Input
                              type="number" min="1"
                              value={cat.capacityPerRoom}
                              onChange={(e) => updateHostelCategory(i, { capacityPerRoom: e.target.value })}
                              placeholder="e.g. 4"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Number of Rooms *</Label>
                            <Input
                              type="number" min="1"
                              value={cat.roomCount}
                              onChange={(e) => updateHostelCategory(i, { roomCount: e.target.value })}
                              placeholder="e.g. 10"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rent / Bed (GH₵) *</Label>
                            <Input
                              type="number" min="0"
                              value={cat.monthlyRent}
                              onChange={(e) => updateHostelCategory(i, { monthlyRent: e.target.value })}
                              placeholder="e.g. 800"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Block Label</Label>
                            <div className="flex gap-2">
                              <Input
                                value={cat.blockLabel}
                                onChange={(e) => updateHostelCategory(i, { blockLabel: e.target.value })}
                                placeholder="Block A"
                              />
                              {hostelCategories.length > 1 && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeHostelCategory(i)} className="text-destructive shrink-0">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                        {rooms > 0 && cap > 0 && (
                          <p className="text-xs text-muted-foreground">
                            → Will create {rooms} rooms × {cap} beds = <span className="font-medium text-foreground">{rooms * cap} bed-spaces</span>
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </ErrorBoundary>
          )}

          {/* ── Units ── */}
          {!isHostel && (
          <ErrorBoundary section="Units">
            <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-card-foreground">Units ({units.length})</h2>
                {propertyStructure === "multi_unit" && (
                  <Button type="button" variant="outline" size="sm" onClick={addUnit}>
                    <PlusCircle className="h-4 w-4 mr-1" /> Add Unit
                  </Button>
                )}
              </div>
              <div className="space-y-4">
                {units.map((unit, i) => (
                  <div key={i} className="bg-muted rounded-lg p-4 space-y-3">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div className="space-y-1 flex-1 min-w-[120px]">
                        <Label className="text-xs">Unit Name</Label>
                        <Input value={unit.name} onChange={(e) => updateUnit(i, { name: e.target.value })} />
                      </div>
                      <div className="space-y-1 flex-1 min-w-[180px]">
                        <Label className="text-xs">Unit Type</Label>
                        <Input
                          value={unit.type}
                          onChange={(e) => updateUnit(i, { type: e.target.value })}
                          placeholder="e.g. 3-Bedroom Duplex with BQ"
                        />
                      </div>
                      <div className="space-y-1 w-24">
                        <Label className="text-xs">Bedrooms</Label>
                        <Input type="number" value={unit.bedroomCount} onChange={(e) => updateUnit(i, { bedroomCount: e.target.value })} placeholder="0" min="0" />
                      </div>
                      <div className="space-y-1 w-24">
                        <Label className="text-xs">Bathrooms</Label>
                        <Input type="number" value={(unit as any).bathroomCount || ""} onChange={(e) => updateUnit(i, { bathroomCount: e.target.value } as any)} placeholder="0" min="0" />
                      </div>
                      <div className="space-y-1 w-28">
                        <Label className="text-xs">Rent (GH₵)</Label>
                        <Input
                          type="number"
                          value={unit.rent}
                          onChange={(e) => updateUnit(i, { rent: e.target.value })}
                          onBlur={() => computeBenchmarkForUnit(i)}
                          placeholder="e.g. 1200"
                        />
                      </div>
                      {propertyStructure === "multi_unit" && (
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeUnit(i)} disabled={units.length === 1} className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Quick-select type presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {unitTypePresets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => updateUnit(i, { type: preset })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            unit.type === preset
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background text-muted-foreground border-border hover:border-primary/50"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    {/* Benchmark feedback */}
                    {unit.benchmark && unit.benchmark.pricing_band !== "unknown" && (
                      <div className="flex items-center gap-3 text-xs">
                        {getBenchmarkBadge(unit.benchmark)}
                        <span className="text-muted-foreground">
                          Benchmark: GH₵ {unit.benchmark.benchmark_min?.toLocaleString()} – {unit.benchmark.benchmark_max?.toLocaleString()} ({unit.benchmark.confidence} confidence)
                        </span>
                      </div>
                    )}

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
          </ErrorBoundary>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={submitting}>
            {submitting ? "Registering..." : "Register Property"}
          </Button>
        </form>
      </div>
    </KycGate>
  );
};

export default RegisterProperty;

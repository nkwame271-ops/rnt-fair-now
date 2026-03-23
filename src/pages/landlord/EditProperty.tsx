import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save, Lock } from "lucide-react";
import { regions, areasByRegion } from "@/data/dummyData";

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
  const [roomCount, setRoomCount] = useState("");
  const [bathroomCount, setBathroomCount] = useState("");
  const [occupancyType, setOccupancyType] = useState("self_contained");
  const [furnishingStatus, setFurnishingStatus] = useState("unfurnished");
  const [ownershipType, setOwnershipType] = useState("owner");
  const [locationLocked, setLocationLocked] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .eq("id", id)
        .eq("landlord_user_id", user.id)
        .single();
      if (error || !data) {
        toast.error("Property not found");
        navigate("/landlord/my-properties");
        return;
      }
      setPropertyName(data.property_name || "");
      setAddress(data.address);
      setRegion(data.region);
      setArea(data.area);
      setCondition(data.property_condition || "");
      setGhanaPostGps(data.ghana_post_gps || "");
      setPropertyCategory(((data as any).property_category as "residential" | "commercial") || "residential");
      setRoomCount(String((data as any).room_count || ""));
      setBathroomCount(String((data as any).bathroom_count || ""));
      setOccupancyType((data as any).occupancy_type || "self_contained");
      setFurnishingStatus((data as any).furnishing_status || "unfurnished");
      setOwnershipType((data as any).ownership_type || "owner");
      setLocationLocked(data.location_locked || false);
      setLoading(false);
    };
    fetch();
  }, [user, id, navigate]);

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
        room_count: roomCount ? parseInt(roomCount) : null,
        bathroom_count: bathroomCount ? parseInt(bathroomCount) : null,
        occupancy_type: occupancyType,
        furnishing_status: furnishingStatus,
        ownership_type: ownershipType,
        normalized_address: normalizedAddr,
      } as any)
      .eq("id", id!)
      .eq("landlord_user_id", user!.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Property updated successfully");
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
        <p className="text-muted-foreground mt-1">Update your property details</p>
      </div>

      <div className="bg-card rounded-xl p-6 border border-border space-y-4">
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

        {/* New identity fields */}
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Room Count</Label>
            <Input type="number" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} placeholder="e.g. 4" min="1" />
          </div>
          <div className="space-y-2">
            <Label>Bathroom Count</Label>
            <Input type="number" value={bathroomCount} onChange={(e) => setBathroomCount(e.target.value)} placeholder="e.g. 2" min="0" />
          </div>
          <div className="space-y-2">
            <Label>Occupancy Type</Label>
            <Select value={occupancyType} onValueChange={setOccupancyType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="self_contained">Self-Contained</SelectItem>
                <SelectItem value="shared">Shared Facilities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Furnishing Status</Label>
            <Select value={furnishingStatus} onValueChange={setFurnishingStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
                <SelectItem value="semi_furnished">Semi-Furnished</SelectItem>
                <SelectItem value="furnished">Furnished</SelectItem>
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

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
};

export default EditProperty;

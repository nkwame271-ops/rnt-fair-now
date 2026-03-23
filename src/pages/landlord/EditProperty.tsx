import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save, Lock, AlertTriangle } from "lucide-react";
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
  const [ownershipType, setOwnershipType] = useState("owner");
  const [locationLocked, setLocationLocked] = useState(false);
  const [propertyStatus, setPropertyStatus] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null);

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
      setOwnershipType((data as any).ownership_type || "owner");
      setLocationLocked(data.location_locked || false);
      setPropertyStatus((data as any).property_status || "");
      setSuggestedPrice((data as any).suggested_price ? Number((data as any).suggested_price) : null);
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
        <p className="text-muted-foreground mt-1">Update your property details</p>
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
              <p className="text-xs text-muted-foreground mt-1">Adjust your unit rents in the unit management section, then resubmit.</p>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
};

export default EditProperty;

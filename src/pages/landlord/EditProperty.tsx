import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Save } from "lucide-react";
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
    const { error } = await supabase
      .from("properties")
      .update({
        property_name: propertyName || null,
        address,
        region,
        area,
        property_condition: condition || null,
        ghana_post_gps: ghanaPostGps || null,
      })
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
          <Label>Property Condition</Label>
          <Input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="e.g. Newly built, Good condition" />
        </div>
        <div className="space-y-2">
          <Label>Ghana Post GPS</Label>
          <Input value={ghanaPostGps} onChange={(e) => setGhanaPostGps(e.target.value)} placeholder="e.g. GA-123-4567" />
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

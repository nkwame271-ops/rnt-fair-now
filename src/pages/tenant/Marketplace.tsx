import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Bed, Bath, Shield, Calendar, Loader2, Send, Droplets, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { regions } from "@/data/dummyData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";

const fallbackImages = [listing1, listing2, listing3];

interface MarketUnit {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  amenities: string[] | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  has_toilet_bathroom: boolean | null;
  property: {
    id: string;
    property_name: string | null;
    address: string;
    region: string;
    area: string;
    landlord_user_id: string;
    gps_location: string | null;
    property_condition: string | null;
  };
  imageUrl?: string;
}

const Marketplace = () => {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [type, setType] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [units, setUnits] = useState<MarketUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<MarketUnit | null>(null);
  const [viewingMessage, setViewingMessage] = useState("");
  const [viewingDate, setViewingDate] = useState("");
  const [viewingTime, setViewingTime] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    const fetchUnits = async () => {
      const { data } = await supabase
        .from("units")
        .select("*, property:properties(id, property_name, address, region, area, landlord_user_id, gps_location, property_condition)")
        .eq("status", "vacant");

      if (!data) { setLoading(false); return; }

      // Fetch images for each property
      const propertyIds = [...new Set(data.map((u: any) => u.property?.id).filter(Boolean))];
      const { data: images } = await supabase
        .from("property_images")
        .select("property_id, image_url, is_primary")
        .in("property_id", propertyIds);

      const imageMap: Record<string, string> = {};
      (images || []).forEach((img: any) => {
        if (!imageMap[img.property_id] || img.is_primary) {
          imageMap[img.property_id] = img.image_url;
        }
      });

      setUnits(data.map((u: any, i: number) => ({
        ...u,
        imageUrl: imageMap[u.property?.id] || fallbackImages[i % fallbackImages.length],
      })));
      setLoading(false);
    };
    fetchUnits();
  }, []);

  const filtered = units.filter((u) => {
    const prop = u.property;
    if (!prop) return false;
    if (search && !(prop.property_name || "").toLowerCase().includes(search.toLowerCase()) && !prop.area.toLowerCase().includes(search.toLowerCase())) return false;
    if (region !== "all" && prop.region !== region) return false;
    if (type !== "all" && u.unit_type !== type) return false;
    if (minPrice && u.monthly_rent < parseFloat(minPrice)) return false;
    if (maxPrice && u.monthly_rent > parseFloat(maxPrice)) return false;
    return true;
  });

  const handleRequestViewing = async () => {
    if (!user || !selectedUnit) return;
    setSubmittingRequest(true);
    try {
      const { error } = await supabase.from("viewing_requests").insert({
        tenant_user_id: user.id,
        landlord_user_id: selectedUnit.property.landlord_user_id,
        property_id: selectedUnit.property.id,
        unit_id: selectedUnit.id,
        message: viewingMessage || null,
        preferred_date: viewingDate || null,
        preferred_time: viewingTime || null,
      });
      if (error) throw error;
      toast.success("Viewing request sent to landlord!");
      setSelectedUnit(null);
      setViewingMessage("");
      setViewingDate("");
      setViewingTime("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rental Marketplace</h1>
        <p className="text-muted-foreground mt-1">Find verified rental properties across Ghana</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by area or property name..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Region" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Self-Contained"].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-3">
        <Input type="number" placeholder="Min price (GH₵)" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="w-full sm:w-40" />
        <Input type="number" placeholder="Max price (GH₵)" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="w-full sm:w-40" />
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} properties found</div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <p className="text-muted-foreground">No vacant units available matching your criteria.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((unit, i) => (
            <motion.div
              key={unit.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card rounded-xl shadow-card border border-border overflow-hidden group cursor-pointer hover:shadow-elevated transition-all"
              onClick={() => setSelectedUnit(unit)}
            >
              <div className="relative h-48 overflow-hidden">
                <img src={unit.imageUrl} alt={unit.unit_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-semibold px-2 py-1 rounded-full">
                  <Shield className="h-3 w-3" /> Registered
                </div>
                <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur px-2.5 py-1 rounded-lg text-sm font-bold text-card-foreground">
                  GH₵ {unit.monthly_rent.toLocaleString()}/mo
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-card-foreground text-sm line-clamp-1">{unit.property.property_name || unit.unit_name}</h3>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" /> {unit.property.area}, {unit.property.region}
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {unit.unit_type}</span>
                  {unit.water_available && <span className="flex items-center gap-1"><Droplets className="h-3 w-3" /> Water</span>}
                  {unit.electricity_available && <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Power</span>}
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {(unit.amenities || []).slice(0, 3).map((a) => (
                    <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail & Viewing Request Modal */}
      {selectedUnit && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setSelectedUnit(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={selectedUnit.imageUrl} alt="" className="w-full h-56 object-cover rounded-t-2xl" />
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-card-foreground">{selectedUnit.property.property_name || selectedUnit.unit_name}</h2>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {selectedUnit.property.address}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">GH₵ {selectedUnit.monthly_rent.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
              </div>

              {selectedUnit.property.property_condition && (
                <p className="text-sm text-muted-foreground">{selectedUnit.property.property_condition}</p>
              )}

              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedUnit.unit_type}</div>
                  <div className="text-xs text-muted-foreground">Type</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedUnit.water_available ? "Yes" : "No"}</div>
                  <div className="text-xs text-muted-foreground">Water</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedUnit.electricity_available ? "Yes" : "No"}</div>
                  <div className="text-xs text-muted-foreground">Electricity</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(selectedUnit.amenities || []).map((a) => (
                  <Badge key={a} variant="secondary">{a}</Badge>
                ))}
              </div>

              {/* Viewing Request Form */}
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-semibold text-card-foreground text-sm">Request a Viewing</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Preferred Date</Label>
                    <Input type="date" value={viewingDate} onChange={(e) => setViewingDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preferred Time</Label>
                    <Select value={viewingTime} onValueChange={setViewingTime}>
                      <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
                      <SelectContent>
                        {["Morning (8-12)", "Afternoon (12-4)", "Evening (4-7)"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Textarea value={viewingMessage} onChange={(e) => setViewingMessage(e.target.value)} placeholder="Optional message to landlord..." rows={2} />
                <Button className="w-full" onClick={handleRequestViewing} disabled={submittingRequest}>
                  <Send className="h-4 w-4 mr-2" />
                  {submittingRequest ? "Sending..." : "Send Viewing Request"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;

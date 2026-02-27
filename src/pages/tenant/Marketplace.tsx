import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Bed, Bath, Shield, Calendar, Loader2, Send, Droplets, Zap, Clock, Heart, MessageCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { regions } from "@/data/dummyData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKycStatus } from "@/hooks/useKycStatus";
import { toast } from "sonner";
import { format, addDays } from "date-fns";

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
  availableSoon?: boolean;
  availableFrom?: string;
}

const Marketplace = () => {
  const { user } = useAuth();
  const { isVerified: kycVerified } = useKycStatus();
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
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState("all");
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const fetchUnits = async () => {
      const { data: vacantData } = await (supabase
        .from("units")
        .select("*, property:properties!inner(id, property_name, address, region, area, landlord_user_id, gps_location, property_condition, listed_on_marketplace)")
        .eq("status", "vacant") as any).eq("property.listed_on_marketplace", true);

      const thirtyDaysFromNow = format(addDays(new Date(), 30), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      const { data: expiringTenancies } = await supabase
        .from("tenancies")
        .select("unit_id, end_date")
        .gte("end_date", today)
        .lte("end_date", thirtyDaysFromNow)
        .eq("status", "active");

      let expiringUnits: any[] = [];
      if (expiringTenancies && expiringTenancies.length > 0) {
        const expiringUnitIds = expiringTenancies.map((t) => t.unit_id);
        const { data: occupiedData } = await (supabase
          .from("units")
          .select("*, property:properties!inner(id, property_name, address, region, area, landlord_user_id, gps_location, property_condition, listed_on_marketplace)")
          .in("id", expiringUnitIds) as any).eq("property.listed_on_marketplace", true);

        if (occupiedData) {
          const endDateMap: Record<string, string> = {};
          expiringTenancies.forEach((t) => { endDateMap[t.unit_id] = t.end_date; });
          expiringUnits = occupiedData.map((u: any) => ({
            ...u,
            availableSoon: true,
            availableFrom: endDateMap[u.id],
          }));
        }
      }

      const allData = [...(vacantData || []), ...expiringUnits];
      const seen = new Set<string>();
      const deduped = allData.filter((u: any) => {
        if (seen.has(u.id)) return false;
        seen.add(u.id);
        return true;
      });

      if (deduped.length === 0) { setLoading(false); return; }

      const propertyIds: string[] = [...new Set(deduped.map((u: any) => u.property?.id).filter(Boolean))];
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

      setUnits(deduped.map((u: any, i: number) => ({
        ...u,
        imageUrl: imageMap[u.property?.id] || fallbackImages[i % fallbackImages.length],
      })));
      setLoading(false);
    };
    fetchUnits();
  }, []);

  // Fetch watchlist
  useEffect(() => {
    if (!user) return;
    const fetchWatchlist = async () => {
      const { data } = await supabase
        .from("watchlist")
        .select("unit_id")
        .eq("tenant_user_id", user.id);
      if (data) {
        setWatchlist(new Set(data.map(w => w.unit_id)));
      }
    };
    fetchWatchlist();
  }, [user]);

  const toggleWatchlist = async (unitId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (watchlist.has(unitId)) {
      await supabase.from("watchlist").delete().eq("tenant_user_id", user.id).eq("unit_id", unitId);
      setWatchlist(prev => { const next = new Set(prev); next.delete(unitId); return next; });
      toast.success("Removed from watchlist");
    } else {
      await supabase.from("watchlist").insert({ tenant_user_id: user.id, unit_id: unitId });
      setWatchlist(prev => new Set(prev).add(unitId));
      toast.success("Added to watchlist");
    }
  };

  const handleSendMessage = async () => {
    if (!user || !selectedUnit || !messageText.trim()) return;
    setSendingMessage(true);
    try {
      const { error } = await supabase.from("marketplace_messages").insert({
        sender_user_id: user.id,
        receiver_user_id: selectedUnit.property.landlord_user_id,
        unit_id: selectedUnit.id,
        message: messageText.trim(),
      });
      if (error) throw error;
      toast.success("Message sent to landlord!");
      setMessageText("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const filtered = units.filter((u) => {
    const prop = u.property;
    if (!prop) return false;
    if (activeTab === "watchlist" && !watchlist.has(u.id)) return false;
    if (search && !(prop.property_name || "").toLowerCase().includes(search.toLowerCase()) && !prop.area.toLowerCase().includes(search.toLowerCase())) return false;
    if (region !== "all" && prop.region !== region) return false;
    if (type !== "all" && u.unit_type !== type) return false;
    if (minPrice && u.monthly_rent < parseFloat(minPrice)) return false;
    if (maxPrice && u.monthly_rent > parseFloat(maxPrice)) return false;
    return true;
  });

  const handleRequestViewing = async () => {
    if (!user || !selectedUnit) return;
    if (!kycVerified) {
      toast.error("You must verify your Ghana Card before applying for a viewing. Go to your Profile to complete verification.");
      return;
    }
    setSubmittingRequest(true);
    try {
      const { data: vr, error } = await supabase.from("viewing_requests").insert({
        tenant_user_id: user.id,
        landlord_user_id: selectedUnit.property.landlord_user_id,
        property_id: selectedUnit.property.id,
        unit_id: selectedUnit.id,
        message: viewingMessage || null,
        preferred_date: viewingDate || null,
        preferred_time: viewingTime || null,
        status: "awaiting_payment",
      }).select().single();
      if (error) throw error;

      const { data: payData, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "viewing_fee", viewingRequestId: vr.id },
      });
      if (payErr) throw new Error(payErr.message);
      if (payData?.error) throw new Error(payData.error);

      if (payData?.authorization_url) {
        window.location.href = payData.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Listings</TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-1">
            <Heart className="h-3 w-3" /> My Watchlist ({watchlist.size})
          </TabsTrigger>
        </TabsList>
      </Tabs>

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
          <p className="text-muted-foreground">
            {activeTab === "watchlist" ? "Your watchlist is empty. Click the heart icon on listings to save them." : "No vacant units available matching your criteria."}
          </p>
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
                {unit.availableSoon && (
                  <div className="absolute top-3 right-12 flex items-center gap-1 bg-secondary/90 text-secondary-foreground text-[10px] font-semibold px-2 py-1 rounded-full">
                    <Clock className="h-3 w-3" /> Available {unit.availableFrom ? format(new Date(unit.availableFrom), "MMM d") : "Soon"}
                  </div>
                )}
                {/* Watchlist heart */}
                <button
                  onClick={(e) => toggleWatchlist(unit.id, e)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-card/80 backdrop-blur flex items-center justify-center hover:bg-card transition-colors"
                >
                  <Heart className={`h-4 w-4 ${watchlist.has(unit.id) ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                </button>
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
                  {unit.availableSoon && (
                    <Badge variant="outline" className="text-[10px] border-secondary text-secondary-foreground bg-secondary/10">
                      Available Soon
                    </Badge>
                  )}
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

              {selectedUnit.availableSoon && selectedUnit.availableFrom && (
                <div className="flex items-center gap-2 text-sm bg-secondary/10 text-secondary-foreground rounded-lg px-3 py-2">
                  <Clock className="h-4 w-4" />
                  <span>Available from {format(new Date(selectedUnit.availableFrom), "MMMM d, yyyy")}</span>
                </div>
              )}

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

              {/* Message Landlord */}
              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="font-semibold text-card-foreground text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" /> Message Landlord
                </h3>
                <Textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Ask a question about this property..."
                  rows={2}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageText.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendingMessage ? "Sending..." : "Send Message"}
                </Button>
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
                  {submittingRequest ? "Processing..." : "Pay GH₵ 2 & Send Viewing Request"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">A GH₵ 2 viewing fee is required to send this request</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;

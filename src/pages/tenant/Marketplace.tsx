import { useState } from "react";
import { motion } from "framer-motion";
import { Search, MapPin, Bed, Bath, Shield, Phone, Calendar, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listings, regions, type Listing } from "@/data/dummyData";

import listing1 from "@/assets/listing-1.jpg";
import listing2 from "@/assets/listing-2.jpg";
import listing3 from "@/assets/listing-3.jpg";
import listing4 from "@/assets/listing-4.jpg";
import listing5 from "@/assets/listing-5.jpg";
import listing6 from "@/assets/listing-6.jpg";

const imageMap: Record<string, string> = {
  "listing-1": listing1,
  "listing-2": listing2,
  "listing-3": listing3,
  "listing-4": listing4,
  "listing-5": listing5,
  "listing-6": listing6,
};

const Marketplace = () => {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [type, setType] = useState("all");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  const filtered = listings.filter((l) => {
    if (search && !l.title.toLowerCase().includes(search.toLowerCase()) && !l.area.toLowerCase().includes(search.toLowerCase())) return false;
    if (region !== "all" && l.region !== region) return false;
    if (type !== "all" && l.type !== type) return false;
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rental Marketplace</h1>
        <p className="text-muted-foreground mt-1">Find verified rental properties across Ghana</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by area or title..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom"].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <div className="text-sm text-muted-foreground">{filtered.length} properties found</div>

      {/* Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((listing, i) => (
          <motion.div
            key={listing.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl shadow-card border border-border overflow-hidden group cursor-pointer hover:shadow-elevated transition-all"
            onClick={() => setSelectedListing(listing)}
          >
            <div className="relative h-48 overflow-hidden">
              <img
                src={imageMap[listing.image]}
                alt={listing.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {listing.verified && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-primary/90 text-primary-foreground text-[10px] font-semibold px-2 py-1 rounded-full">
                  <Shield className="h-3 w-3" /> Verified
                </div>
              )}
              <div className="absolute bottom-3 right-3 bg-card/90 backdrop-blur px-2.5 py-1 rounded-lg text-sm font-bold text-card-foreground">
                GH₵ {listing.price.toLocaleString()}/mo
              </div>
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-card-foreground text-sm line-clamp-1">{listing.title}</h3>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <MapPin className="h-3 w-3" /> {listing.area}, {listing.region}
              </div>
              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {listing.bedrooms} bed</span>
                <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {listing.bathrooms} bath</span>
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {listing.advance} mo adv</span>
              </div>
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {listing.amenities.slice(0, 3).map((a) => (
                  <Badge key={a} variant="secondary" className="text-[10px]">{a}</Badge>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 bg-foreground/40 flex items-center justify-center p-4" onClick={() => setSelectedListing(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={imageMap[selectedListing.image]} alt="" className="w-full h-56 object-cover rounded-t-2xl" />
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-card-foreground">{selectedListing.title}</h2>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                    <MapPin className="h-3.5 w-3.5" /> {selectedListing.address}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">GH₵ {selectedListing.price.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">per month</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{selectedListing.description}</p>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedListing.bedrooms}</div>
                  <div className="text-xs text-muted-foreground">Bedrooms</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedListing.bathrooms}</div>
                  <div className="text-xs text-muted-foreground">Bathrooms</div>
                </div>
                <div className="bg-muted rounded-lg p-3 text-center">
                  <div className="font-semibold text-card-foreground">{selectedListing.advance} mo</div>
                  <div className="text-xs text-muted-foreground">Advance</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedListing.amenities.map((a) => (
                  <Badge key={a} variant="secondary">{a}</Badge>
                ))}
              </div>
              <div className="border-t border-border pt-4">
                <div className="text-sm text-muted-foreground mb-1">Landlord</div>
                <div className="font-semibold text-card-foreground">{selectedListing.landlord}</div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Phone className="h-3 w-3" /> {selectedListing.phone}
                </div>
              </div>
              <Button className="w-full" onClick={() => setSelectedListing(null)}>
                Contact Landlord
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;

import { useState, useEffect, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, MapPin, Navigation, ChevronDown, Check } from "lucide-react";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/gpsUtils";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface LocationData {
  lat: number;
  lng: number;
  address?: string;
}

interface Props {
  region?: string;
  value?: string; // "lat, lng" format
  onLocationChange: (location: LocationData | null) => void;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

// Child component that handles map click events
const MapClickHandler = ({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) => {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Child component to pan map programmatically
const MapPanner = ({ center }: { center: [number, number] | null }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 15, { duration: 1 });
    }
  }, [center, map]);
  return null;
};

const PropertyLocationPicker = ({ region, value, onLocationChange }: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [panTo, setPanTo] = useState<[number, number] | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parts = value.split(",").map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setMarkerPos([parts[0], parts[1]]);
        setManualLat(parts[0].toFixed(6));
        setManualLng(parts[1].toFixed(6));
      }
    }
  }, []);

  const getMapCenter = (): [number, number] => {
    if (markerPos) return markerPos;
    if (region && GHANA_REGIONS[region]) {
      const r = GHANA_REGIONS[region];
      return [r.lat, r.lng];
    }
    return [7.9465, -1.0232]; // Ghana center
  };

  const getMapZoom = () => {
    if (markerPos) return 15;
    if (region && GHANA_REGIONS[region]) return 10;
    return 7;
  };

  const updateLocation = useCallback((lat: number, lng: number, address?: string) => {
    setMarkerPos([lat, lng]);
    setManualLat(lat.toFixed(6));
    setManualLng(lng.toFixed(6));
    onLocationChange({ lat, lng, address });
  }, [onLocationChange]);

  const handleMapClick = (lat: number, lng: number) => {
    updateLocation(lat, lng);
    setPanTo(null); // Don't pan on click
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&countrycodes=gh&limit=5`
      );
      const data: NominatimResult[] = await res.json();
      setSearchResults(data);
      setShowResults(true);
    } catch {
      toast.error("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSearch();
    }
  };

  const selectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    updateLocation(lat, lng, result.display_name);
    setPanTo([lat, lng]);
    setShowResults(false);
    setSearchQuery(result.display_name.split(",").slice(0, 2).join(","));
  };

  const handleCenterOnDevice = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPanTo([pos.coords.latitude, pos.coords.longitude]);
        toast.info("Map centered on your location. Drag the pin or click the map to set the property's actual position.");
      },
      () => {
        toast.error("Could not get your location.");
      }
    );
  };

  const handleManualApply = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Enter valid coordinates");
      return;
    }
    updateLocation(lat, lng);
    setPanTo([lat, lng]);
  };

  // Close results on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" /> Property Location
      </Label>

      {/* Address Search */}
      <div className="relative" ref={resultsRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search address in Ghana..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          <Button type="button" variant="outline" onClick={handleSearch} disabled={searching}>
            {searching ? "..." : "Search"}
          </Button>
        </div>
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-popover border border-border rounded-lg shadow-elevated max-h-48 overflow-y-auto">
            {searchResults.map((r) => (
              <button
                key={r.place_id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors border-b border-border last:border-0 text-popover-foreground"
                onClick={() => selectResult(r)}
              >
                {r.display_name}
              </button>
            ))}
          </div>
        )}
        {showResults && searchResults.length === 0 && !searching && (
          <div className="absolute z-[1000] mt-1 w-full bg-popover border border-border rounded-lg shadow-elevated p-3 text-sm text-muted-foreground">
            No results found. Try a different search term.
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-lg overflow-hidden border border-border h-[280px]">
        <MapContainer
          center={getMapCenter()}
          zoom={getMapZoom()}
          style={{ height: "100%", width: "100%" }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onMapClick={handleMapClick} />
          <MapPanner center={panTo} />
          {markerPos && (
            <Marker
              position={markerPos}
              draggable={true}
              eventHandlers={{
                dragend: (e) => {
                  const pos = e.target.getLatLng();
                  updateLocation(pos.lat, pos.lng);
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {/* Center on device button */}
      <Button type="button" variant="ghost" size="sm" onClick={handleCenterOnDevice} className="text-xs">
        <Navigation className="h-3.5 w-3.5 mr-1.5" /> Center on my device (map only)
      </Button>

      {/* Manual coordinate entry */}
      <Collapsible open={manualOpen} onOpenChange={setManualOpen}>
        <CollapsibleTrigger asChild>
          <button type="button" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${manualOpen ? "rotate-180" : ""}`} />
            Enter coordinates manually
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="flex gap-2 items-end">
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Latitude</Label>
              <Input
                type="number"
                step="any"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="e.g. 5.614818"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Longitude</Label>
              <Input
                type="number"
                step="any"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="e.g. -0.205874"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleManualApply}>
              Apply
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Selected coordinates display */}
      {markerPos && (
        <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
          <Check className="h-4 w-4" />
          <span>Selected: {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}</span>
        </div>
      )}
    </div>
  );
};

export default PropertyLocationPicker;

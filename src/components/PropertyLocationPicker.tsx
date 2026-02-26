import { useState, useEffect, useRef, useCallback } from "react";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, MapPin, Navigation, ChevronDown, Check, AlertTriangle, Globe } from "lucide-react";
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
  onConfirmChange?: (confirmed: boolean) => void;
  onGhanaPostGpsChange?: (code: string) => void;
  ghanaPostGps?: string;
  confirmed?: boolean;
  required?: boolean;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}


const PropertyLocationPicker = ({
  region,
  value,
  onLocationChange,
  onConfirmChange,
  onGhanaPostGpsChange,
  ghanaPostGps = "",
  confirmed = false,
  required = false,
}: Props) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [markerPos, setMarkerPos] = useState<[number, number] | null>(null);
  const [panTo, setPanTo] = useState<[number, number] | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

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
    // Reset confirmation when location changes
    if (onConfirmChange) onConfirmChange(false);
  }, [onLocationChange, onConfirmChange]);

  const handleMapClick = (lat: number, lng: number) => {
    updateLocation(lat, lng);
    setPanTo(null);
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([7.9465, -1.0232], 7);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const onMapClick = (e: L.LeafletMouseEvent) => {
      updateLocation(e.latlng.lat, e.latlng.lng);
      setPanTo(null);
    };

    map.on("click", onMapClick);

    return () => {
      map.off("click", onMapClick);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, [updateLocation]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const targetCenter: [number, number] = panTo
      ?? markerPos
      ?? (region && GHANA_REGIONS[region]
        ? [GHANA_REGIONS[region].lat, GHANA_REGIONS[region].lng]
        : [7.9465, -1.0232]);

    const targetZoom = markerPos || panTo ? 15 : region && GHANA_REGIONS[region] ? 10 : 7;
    map.flyTo(targetCenter, targetZoom, { duration: 1 });

    if (markerPos) {
      if (!markerRef.current) {
        const marker = L.marker(markerPos, { draggable: true }).addTo(map);
        marker.on("dragend", (e) => {
          const pos = (e.target as L.Marker).getLatLng();
          updateLocation(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      } else {
        markerRef.current.setLatLng(markerPos);
      }
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
  }, [markerPos, panTo, region, updateLocation]);

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
        // ONLY pan the map — NEVER set as property location
        setPanTo([pos.coords.latitude, pos.coords.longitude]);
        toast.info("Map centered on your device. Click or drag the pin to set the PROPERTY's actual position.", { duration: 5000 });
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
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Coordinates out of range");
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
        {required && <span className="text-destructive">*</span>}
      </Label>

      {/* Important notice */}
      <div className="flex items-start gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg px-3 py-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          Pin the <strong>property's physical location</strong>, not your current device location.
          Use address search or click the map to place the pin accurately.
        </span>
      </div>

      {/* Address Search */}
      <div className="relative" ref={resultsRef}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search property address in Ghana..."
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
      <div className="rounded-lg overflow-hidden border border-border h-[300px]">
        <div ref={mapContainerRef} className="h-full w-full" />
      </div>

      {/* Center on device — clearly labeled as map-only */}
      <Button type="button" variant="ghost" size="sm" onClick={handleCenterOnDevice} className="text-xs text-muted-foreground">
        <Navigation className="h-3.5 w-3.5 mr-1.5" /> Center map on my device (does NOT set property location)
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

      {/* GhanaPost GPS Code (optional) */}
      {onGhanaPostGpsChange && (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> GhanaPost GPS Code (optional)
          </Label>
          <Input
            value={ghanaPostGps}
            onChange={(e) => onGhanaPostGpsChange(e.target.value.toUpperCase())}
            placeholder="e.g. GA-123-4567"
            className="text-sm font-mono"
            maxLength={20}
          />
        </div>
      )}

      {/* Selected coordinates display + confirmation */}
      {markerPos ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
            <Check className="h-4 w-4" />
            <span>Pin placed: {markerPos[0].toFixed(6)}, {markerPos[1].toFixed(6)}</span>
          </div>

          {/* Confirmation checkbox */}
          {onConfirmChange && (
            <label className="flex items-start gap-2.5 cursor-pointer bg-muted rounded-lg px-3 py-2.5 border border-border">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => onConfirmChange(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm">
                I confirm this pin represents the <strong>property's physical location</strong>, not my current device position.
              </span>
            </label>
          )}
        </div>
      ) : required ? (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <MapPin className="h-4 w-4" />
          <span>Please select the property location on the map before submitting.</span>
        </div>
      ) : null}
    </div>
  );
};

export default PropertyLocationPicker;
import { useState, useEffect, useRef, useCallback } from "react";
import { GoogleMap, Marker, Autocomplete, useJsApiLoader } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MapPin, Navigation, ChevronDown, Check, AlertTriangle, Globe } from "lucide-react";
import { toast } from "sonner";
import { GHANA_REGIONS } from "@/lib/gpsUtils";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";

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

const mapContainerStyle = { width: "100%", height: "300px" };
const GHANA_CENTER = { lat: 7.9465, lng: -1.0232 };

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
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });

  const [markerPos, setMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState("");
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);

  // Parse initial value
  useEffect(() => {
    if (value) {
      const parts = value.split(",").map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setMarkerPos({ lat: parts[0], lng: parts[1] });
        setManualLat(parts[0].toFixed(6));
        setManualLng(parts[1].toFixed(6));
      }
    }
  }, []);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        setResolvedAddress(results[0].formatted_address);
      } else {
        setResolvedAddress("");
      }
    });
  }, []);

  const getCenter = useCallback(() => {
    if (markerPos) return markerPos;
    if (region && GHANA_REGIONS[region]) {
      const r = GHANA_REGIONS[region];
      return { lat: r.lat, lng: r.lng };
    }
    return GHANA_CENTER;
  }, [markerPos, region]);

  const getZoom = () => {
    if (markerPos) return 15;
    if (region && GHANA_REGIONS[region]) return 10;
    return 7;
  };

  const updateLocation = useCallback((lat: number, lng: number, address?: string) => {
    setMarkerPos({ lat, lng });
    setManualLat(lat.toFixed(6));
    setManualLng(lng.toFixed(6));
    onLocationChange({ lat, lng, address });
    if (onConfirmChange) onConfirmChange(false);
    // Reverse geocode if no address provided
    if (!address) {
      reverseGeocode(lat, lng);
    } else {
      setResolvedAddress(address);
    }
  }, [onLocationChange, onConfirmChange, reverseGeocode]);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      updateLocation(e.latLng.lat(), e.latLng.lng());
    }
  }, [updateLocation]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      updateLocation(e.latLng.lat(), e.latLng.lng());
    }
  }, [updateLocation]);

  const onPlaceSelected = () => {
    const place = autocompleteRef.current?.getPlace();
    if (place?.geometry?.location) {
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      updateLocation(lat, lng, place.formatted_address);
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(15);
    }
  };

  const handleCenterOnDevice = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const center = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current?.panTo(center);
        mapRef.current?.setZoom(15);
        toast.info("Map centered on your device. Click or drag the pin to set the PROPERTY's actual position.", { duration: 5000 });
      },
      () => toast.error("Could not get your location.")
    );
  };

  const handleManualApply = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) { toast.error("Enter valid coordinates"); return; }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { toast.error("Coordinates out of range"); return; }
    updateLocation(lat, lng);
    mapRef.current?.panTo({ lat, lng });
    mapRef.current?.setZoom(15);
  };

  if (!isLoaded) {
    return (
      <div className="space-y-3">
        <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Property Location</Label>
        <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">Loading map...</div>
      </div>
    );
  }

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

      {/* Address Search with Google Places Autocomplete */}
      <Autocomplete
        onLoad={(ac) => { autocompleteRef.current = ac; }}
        onPlaceChanged={onPlaceSelected}
        options={{ componentRestrictions: { country: "gh" } }}
      >
        <Input placeholder="Search property address in Ghana..." />
      </Autocomplete>

      {/* Google Map */}
      <div className="rounded-lg overflow-hidden border border-border">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={getCenter()}
          zoom={getZoom()}
          onClick={handleMapClick}
          onLoad={(map) => { mapRef.current = map; }}
          options={{
            streetViewControl: false,
            mapTypeControl: true,
            fullscreenControl: false,
          }}
        >
          {markerPos && (
            <Marker
              position={markerPos}
              draggable
              onDragEnd={handleMarkerDragEnd}
            />
          )}
        </GoogleMap>
      </div>

      {/* Center on device */}
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
              <Input type="number" step="any" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="e.g. 5.614818" />
            </div>
            <div className="space-y-1 flex-1">
              <Label className="text-xs">Longitude</Label>
              <Input type="number" step="any" value={manualLng} onChange={(e) => setManualLng(e.target.value)} placeholder="e.g. -0.205874" />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={handleManualApply}>Apply</Button>
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

      {/* Selected coordinates display + resolved address + confirmation */}
      {markerPos ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
            <Check className="h-4 w-4" />
            <span>Pin placed: {markerPos.lat.toFixed(6)}, {markerPos.lng.toFixed(6)}</span>
          </div>
          {resolvedAddress && (
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
              📍 Resolved address: <strong>{resolvedAddress}</strong>
            </div>
          )}
          {onConfirmChange && (
            <label className="flex items-start gap-2.5 cursor-pointer bg-muted rounded-lg px-3 py-2.5 border border-border">
              <Checkbox checked={confirmed} onCheckedChange={(v) => onConfirmChange(!!v)} className="mt-0.5" />
              <span className="text-sm">I confirm this pin represents the <strong>property's physical location</strong>, not my current device position.</span>
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

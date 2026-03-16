import { useCallback, useRef } from "react";
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { useState } from "react";

const GOOGLE_MAPS_API_KEY = "AIzaSyBbj3EaLVeMViYbbn8Zrzgqu1qg4OMSLQ4";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  color?: "green" | "blue" | "red" | "gold";
}

interface PropertyMapProps {
  markers: MapMarker[];
  height?: string;
  center?: [number, number];
  zoom?: number;
}

const GHANA_CENTER = { lat: 7.9465, lng: -1.0232 };

const MARKER_COLORS: Record<string, string> = {
  green: "#2d8a56",
  blue: "#4285F4",
  red: "#EA4335",
  gold: "#FBBC04",
};

const PropertyMap = ({ markers, height = "400px", center, zoom = 7 }: PropertyMapProps) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const [activeMarker, setActiveMarker] = useState<number | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));

  const mapCenter = center
    ? { lat: center[0], lng: center[1] }
    : validMarkers.length > 0
      ? { lat: validMarkers[0].lat, lng: validMarkers[0].lng }
      : GHANA_CENTER;

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    if (validMarkers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      validMarkers.forEach(m => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 30);
    }
  }, [validMarkers]);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Loading map...
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-xl border border-border overflow-hidden">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={mapCenter}
        zoom={validMarkers.length > 0 ? 10 : zoom}
        onLoad={onLoad}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {validMarkers.map((m, i) => (
          <Marker
            key={i}
            position={{ lat: m.lat, lng: m.lng }}
            onClick={() => setActiveMarker(i)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: MARKER_COLORS[m.color || "green"],
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 2,
              scale: 8,
            }}
          >
            {activeMarker === i && (
              <InfoWindow onCloseClick={() => setActiveMarker(null)}>
                <div style={{ minWidth: 150 }}>
                  <strong style={{ fontSize: 13 }}>{m.label}</strong>
                  {m.detail && <><br /><span style={{ fontSize: 11, color: "#666" }}>{m.detail}</span></>}
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}
      </GoogleMap>
    </div>
  );
};

export default PropertyMap;

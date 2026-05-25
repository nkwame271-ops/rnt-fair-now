import { GoogleMap, Marker, Polyline, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";
import { useMemo } from "react";

interface Ping { latitude: number; longitude: number; recorded_at: string }

/**
 * Render a polyline trail of live-location pings on a Google Map.
 * Used in the safety report detail to visualize the user's movement
 * during an active emergency.
 */
const SafetyLocationTrail = ({ pings, height = "260px" }: { pings: Ping[]; height?: string }) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });

  // Pings come newest-first; reverse so the line is chronological.
  const path = useMemo(
    () => [...pings].reverse().map((p) => ({ lat: p.latitude, lng: p.longitude })),
    [pings],
  );

  if (!isLoaded) return <div className="text-xs text-muted-foreground">Loading map...</div>;
  if (path.length === 0) return null;

  const last = path[path.length - 1];
  const first = path[0];

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height, borderRadius: 8 }}
      center={last}
      zoom={16}
    >
      <Polyline path={path} options={{ strokeColor: "#dc2626", strokeWeight: 3, strokeOpacity: 0.9 }} />
      <Marker position={first} label={{ text: "S", color: "#fff" }} />
      <Marker
        position={last}
        icon={{ path: google.maps.SymbolPath.CIRCLE, fillColor: "#dc2626", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2, scale: 8 }}
      />
    </GoogleMap>
  );
};

export default SafetyLocationTrail;

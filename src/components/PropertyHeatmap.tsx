import { useEffect, useRef } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";

interface HeatmapPoint {
  lat: number;
  lng: number;
  weight?: number;
}

interface Props {
  points: HeatmapPoint[];
  height?: string;
}

const GHANA_CENTER = { lat: 7.9465, lng: -1.0232 };

const PropertyHeatmap = ({ points, height = "450px" }: Props) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const mapRef = useRef<google.maps.Map | null>(null);
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || points.length === 0) return;

    // Remove existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
    }

    const heatmapData = points
      .filter(p => p.lat && p.lng && !isNaN(p.lat) && !isNaN(p.lng))
      .map(p => ({
        location: new google.maps.LatLng(p.lat, p.lng),
        weight: p.weight || 1,
      }));

    if (heatmapData.length === 0) return;

    heatmapRef.current = new google.maps.visualization.HeatmapLayer({
      data: heatmapData,
      map: mapRef.current,
      radius: 30,
      opacity: 0.7,
      gradient: [
        "rgba(0, 255, 0, 0)",
        "rgba(0, 255, 0, 0.4)",
        "rgba(45, 138, 86, 0.6)",
        "rgba(255, 200, 0, 0.7)",
        "rgba(255, 140, 0, 0.8)",
        "rgba(255, 69, 0, 0.9)",
        "rgba(200, 0, 0, 1)",
      ],
    });
  }, [isLoaded, points]);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center text-sm text-muted-foreground">
        Loading heatmap...
      </div>
    );
  }

  return (
    <div style={{ height }} className="rounded-xl border border-border overflow-hidden">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={GHANA_CENTER}
        zoom={7}
        onLoad={(map) => { mapRef.current = map; }}
        options={{
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      />
    </div>
  );
};

export default PropertyHeatmap;

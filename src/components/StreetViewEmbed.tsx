import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  lat: number;
  lng: number;
  height?: string;
}

const StreetViewEmbed = ({ lat, lng, height = "250px" }: Props) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const containerRef = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    const sv = new google.maps.StreetViewService();
    sv.getPanorama({ location: { lat, lng }, radius: 200 }, (data, status) => {
      if (status === google.maps.StreetViewStatus.OK && data?.location?.latLng) {
        setAvailable(true);
        new google.maps.StreetViewPanorama(containerRef.current!, {
          position: data.location.latLng,
          pov: { heading: 0, pitch: 0 },
          zoom: 1,
          addressControl: false,
          fullscreenControl: false,
          motionTrackingControl: false,
        });
      } else {
        setAvailable(false);
      }
    });
  }, [isLoaded, lat, lng]);

  if (!isLoaded) {
    return (
      <div style={{ height }} className="bg-muted rounded-lg flex items-center justify-center text-sm text-muted-foreground">
        Loading Street View...
      </div>
    );
  }

  if (available === false) {
    return (
      <div style={{ height: "80px" }} className="bg-muted rounded-lg flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <EyeOff className="h-4 w-4" />
        Street View not available for this location
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="h-3.5 w-3.5" /> Street View
      </div>
      <div ref={containerRef} style={{ height }} className="rounded-lg overflow-hidden border border-border" />
    </div>
  );
};

export default StreetViewEmbed;

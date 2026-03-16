import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";
import { School, Cross, Landmark, ShoppingCart, Pill, Loader2 } from "lucide-react";

interface NearbyPlace {
  name: string;
  type: string;
  distance?: string;
  duration?: string;
}

interface Props {
  lat: number;
  lng: number;
}

const PLACE_TYPES: { type: string; label: string; icon: React.ElementType }[] = [
  { type: "school", label: "School", icon: School },
  { type: "hospital", label: "Hospital", icon: Cross },
  { type: "supermarket", label: "Market", icon: ShoppingCart },
  { type: "pharmacy", label: "Pharmacy", icon: Pill },
  { type: "bank", label: "Bank/ATM", icon: Landmark },
];

const NearbyAmenities = ({ lat, lng }: Props) => {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(true);
  const mapDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoaded || !mapDivRef.current) return;

    const map = new google.maps.Map(mapDivRef.current, { center: { lat, lng }, zoom: 14 });
    const service = new google.maps.places.PlacesService(map);
    const origin = new google.maps.LatLng(lat, lng);
    const results: NearbyPlace[] = [];
    let completed = 0;

    PLACE_TYPES.forEach(({ type, label }) => {
      service.nearbySearch(
        { location: { lat, lng }, radius: 2000, type },
        (res, status) => {
          completed++;
          if (status === google.maps.places.PlacesServiceStatus.OK && res && res.length > 0) {
            // Take closest result
            const closest = res[0];
            const place: NearbyPlace = { name: closest.name || label, type: label };

            // Calculate distance using geometry
            if (closest.geometry?.location) {
              const dist = google.maps.geometry
                ? google.maps.geometry.spherical.computeDistanceBetween(origin, closest.geometry.location)
                : null;
              if (dist !== null) {
                place.distance = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;
                const walkMin = Math.round(dist / 80); // ~80m/min walking
                place.duration = `${walkMin} min walk`;
              }
            }
            results.push(place);
          }

          if (completed === PLACE_TYPES.length) {
            // Try Distance Matrix for driving times
            if (results.length > 0) {
              const destinations = res ? undefined : undefined; // We'll use a simpler approach
              setPlaces(results.sort((a, b) => (a.distance || "").localeCompare(b.distance || "")));
            }
            setLoading(false);
          }
        }
      );
    });
  }, [isLoaded, lat, lng]);

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Finding nearby amenities...
      </div>
    );
  }

  if (places.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nearby Amenities</h4>
      <div className="grid grid-cols-1 gap-1.5">
        {places.map((p, i) => {
          const typeDef = PLACE_TYPES.find(t => t.label === p.type);
          const Icon = typeDef?.icon || Landmark;
          return (
            <div key={i} className="flex items-center gap-2 text-sm bg-muted/50 rounded-lg px-3 py-2">
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-foreground truncate flex-1">{p.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                {p.distance && <span className="font-medium text-primary">{p.distance}</span>}
                {p.duration && <span>· {p.duration}</span>}
              </div>
            </div>
          );
        })}
      </div>
      {/* Hidden div for PlacesService */}
      <div ref={mapDivRef} style={{ display: "none" }} />
    </div>
  );
};

export default NearbyAmenities;

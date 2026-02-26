import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons in bundled environments
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

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

const MARKER_COLORS: Record<string, string> = {
  green: "hsl(152,55%,38%)",
  blue: "hsl(210,60%,50%)",
  red: "hsl(0,72%,50%)",
  gold: "hsl(43,85%,55%)",
};

const createColoredIcon = (color: string) => {
  const fill = MARKER_COLORS[color] || MARKER_COLORS.green;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41">
    <path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${fill}" stroke="white" stroke-width="1.5"/>
    <circle cx="12.5" cy="12.5" r="5" fill="white"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [25, 41],
    iconAnchor: [12.5, 41],
    popupAnchor: [0, -35],
  });
};

// Ghana center
const GHANA_CENTER: [number, number] = [7.9465, -1.0232];

const PropertyMap = ({ markers, height = "400px", center, zoom = 7 }: PropertyMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up previous
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const mapCenter = center || (markers.length > 0 ? [markers[0].lat, markers[0].lng] as [number, number] : GHANA_CENTER);
    const map = L.map(mapRef.current).setView(mapCenter, markers.length > 0 ? 10 : zoom);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    const validMarkers = markers.filter(m => m.lat && m.lng && !isNaN(m.lat) && !isNaN(m.lng));

    validMarkers.forEach((m) => {
      const icon = createColoredIcon(m.color || "green");
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      marker.bindPopup(`
        <div style="min-width:150px">
          <strong style="font-size:13px">${m.label}</strong>
          ${m.detail ? `<br/><span style="font-size:11px;color:#666">${m.detail}</span>` : ""}
        </div>
      `);
    });

    // Fit bounds if multiple markers
    if (validMarkers.length > 1) {
      const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [markers, center, zoom]);

  return (
    <div
      ref={mapRef}
      style={{ height, width: "100%" }}
      className="rounded-xl border border-border overflow-hidden z-0"
    />
  );
};

export default PropertyMap;

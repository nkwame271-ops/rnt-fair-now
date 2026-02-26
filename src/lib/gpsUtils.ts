/**
 * Parse GPS location string into lat/lng.
 * Supports formats: "lat, lng", "lat,lng", "lat lng"
 */
export const parseGPS = (gps: string | null | undefined): { lat: number; lng: number } | null => {
  if (!gps) return null;
  const cleaned = gps.trim().replace(/[()]/g, "");
  // Try comma separated
  const parts = cleaned.split(/[,\s]+/).map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    // Validate roughly within Ghana bounds or reasonable global range
    return { lat: parts[0], lng: parts[1] };
  }
  return null;
};

/**
 * Ghana regions with approximate center coordinates for choropleth-style mapping
 */
export const GHANA_REGIONS: Record<string, { lat: number; lng: number }> = {
  "Greater Accra": { lat: 5.6037, lng: -0.1870 },
  "Ashanti": { lat: 6.6885, lng: -1.6244 },
  "Western": { lat: 5.5, lng: -2.2 },
  "Western North": { lat: 6.2, lng: -2.5 },
  "Eastern": { lat: 6.5, lng: -0.5 },
  "Central": { lat: 5.5, lng: -1.2 },
  "Volta": { lat: 6.6, lng: 0.45 },
  "Oti": { lat: 7.5, lng: 0.3 },
  "Northern": { lat: 9.4, lng: -0.8 },
  "North East": { lat: 10.2, lng: -0.3 },
  "Savannah": { lat: 9.0, lng: -1.8 },
  "Upper East": { lat: 10.7, lng: -0.8 },
  "Upper West": { lat: 10.3, lng: -2.5 },
  "Bono": { lat: 7.5, lng: -2.3 },
  "Bono East": { lat: 7.7, lng: -1.5 },
  "Ahafo": { lat: 7.0, lng: -2.4 },
};

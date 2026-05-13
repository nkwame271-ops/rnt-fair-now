import { supabase } from "@/integrations/supabase/client";

export const GHANA_POST_GPS_FORMAT = /^[A-Z]{2}-\d{2,4}-\d{3,4}$/;

export type DistanceLevel = "ok" | "review" | "block";

export interface ResolvedGps {
  lat: number;
  lng: number;
  region?: string;
  district?: string;
  area?: string;
  formatted?: string;
  cached?: boolean;
}

export interface DistanceClassification {
  level: DistanceLevel;
  message: string;
}

export const validateGhanaPostGpsFormat = (code: string): boolean =>
  GHANA_POST_GPS_FORMAT.test(code.trim().toUpperCase());

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

export function classifyDistance(meters: number): DistanceClassification {
  if (meters <= 50) {
    return { level: "ok", message: `Locations match (${meters} m apart)` };
  }
  if (meters <= 150) {
    return {
      level: "review",
      message: `Map pin is ${meters} m from the GhanaPostGPS point — saved with "Location Needs Review".`,
    };
  }
  return {
    level: "block",
    message:
      "The selected map location does not match the GhanaPostGPS location. Please adjust the map pin or confirm the correct GPS address.",
  };
}

export async function resolveGhanaPostGps(code: string): Promise<ResolvedGps | { error: string }> {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "");
  if (!validateGhanaPostGpsFormat(normalized)) return { error: "invalid_format" };
  const { data, error } = await supabase.functions.invoke("resolve-ghana-post-gps", {
    body: { code: normalized },
  });
  if (error) return { error: "lookup_failed" };
  if (!data || (data as any).error) return { error: (data as any)?.error ?? "lookup_failed" };
  return data as ResolvedGps;
}

export const googleMapsLink = (lat: number, lng: number) =>
  `https://www.google.com/maps?q=${lat},${lng}`;

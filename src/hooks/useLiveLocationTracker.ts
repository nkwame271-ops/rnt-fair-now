import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Streams the user's GPS to safety_location_pings until the emergency is closed.
 * Throttles to one ping per 15s. Auto-stops when `enabled` flips false.
 */
export const useLiveLocationTracker = (reportId: string | null, enabled: boolean) => {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const lastPingAt = useRef(0);

  useEffect(() => {
    if (!reportId || !enabled || !user?.id || !("geolocation" in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const now = Date.now();
        if (now - lastPingAt.current < 15_000) return;
        lastPingAt.current = now;
        await supabase.from("safety_location_pings").insert({
          report_id: reportId,
          user_id: user.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        } as any);
      },
      (err) => {
        console.warn("live-location error", err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [reportId, enabled, user?.id]);
};

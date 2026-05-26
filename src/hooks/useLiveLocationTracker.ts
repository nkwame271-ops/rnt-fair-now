import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Streams the user's GPS to safety_location_pings until the emergency is closed.
 * Throttles to one ping per 15s. Auto-stops when `enabled` flips false.
 *
 * Behavior:
 * - Fires an immediate one-shot ping via getCurrentPosition so admins see a
 *   point even before watchPosition warms up.
 * - Logs insert failures (RLS, network) instead of swallowing them.
 * - Surfaces geolocation permission/availability errors via toast so users
 *   know the live-share banner won't actually stream.
 */
export const useLiveLocationTracker = (reportId: string | null, enabled: boolean) => {
  const { user } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const lastPingAt = useRef(0);
  const warnedRef = useRef(false);

  useEffect(() => {
    if (!reportId || !enabled || !user?.id) return;
    if (!("geolocation" in navigator)) {
      toast.error("Live location unavailable: geolocation not supported on this device.");
      return;
    }

    const insertPing = async (pos: GeolocationPosition) => {
      const { error } = await supabase.from("safety_location_pings").insert({
        report_id: reportId,
        user_id: user.id,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      } as any);
      if (error) {
        console.error("safety_location_pings insert failed", error);
        if (!warnedRef.current) {
          warnedRef.current = true;
          toast.error(`Live location failed to send: ${error.message}`);
        }
      }
    };

    // Immediate one-shot ping so the admin trail isn't empty.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        lastPingAt.current = Date.now();
        void insertPing(pos);
      },
      (err) => {
        console.warn("initial live-location error", err);
        toast.error(
          err.code === err.PERMISSION_DENIED
            ? "Live location blocked — please allow location access."
            : "Could not capture live location."
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastPingAt.current < 15_000) return;
        lastPingAt.current = now;
        void insertPing(pos);
      },
      (err) => {
        console.warn("live-location watch error", err);
        if (!warnedRef.current && err.code === err.PERMISSION_DENIED) {
          warnedRef.current = true;
          toast.error("Live location permission denied.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      warnedRef.current = false;
    };
  }, [reportId, enabled, user?.id]);
};

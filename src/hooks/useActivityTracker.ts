import { useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ActivityEvent {
  user_id: string;
  event_type: string;
  event_detail: string | null;
  metadata: Record<string, unknown>;
}

const FLUSH_INTERVAL = 10_000; // 10 seconds
const DEDUP_MS = 2_000;

const getBrowserInfo = () => ({
  userAgent: navigator.userAgent,
  language: navigator.language,
  platform: navigator.platform,
  screenWidth: screen.width,
  screenHeight: screen.height,
  windowWidth: window.innerWidth,
  windowHeight: window.innerHeight,
});

export const useActivityTracker = () => {
  const { user, role } = useAuth();
  const { pathname } = useLocation();
  const queue = useRef<ActivityEvent[]>([]);
  const lastNav = useRef<{ path: string; time: number }>({ path: "", time: 0 });
  const loginLogged = useRef(false);
  const flushing = useRef(false);

  const enqueue = useCallback((evt: Omit<ActivityEvent, "user_id">) => {
    if (!user) return;
    queue.current.push({ ...evt, user_id: user.id });
  }, [user]);

  const flush = useCallback(async () => {
    if (flushing.current || queue.current.length === 0) return;
    flushing.current = true;
    const batch = queue.current.splice(0, queue.current.length);
    try {
      await supabase.from("admin_activity_log").insert(batch as any);
    } catch (e) {
      // Re-queue on failure
      queue.current.unshift(...batch);
    }
    flushing.current = false;
  }, []);

  // Flush interval
  useEffect(() => {
    if (role !== "regulator") return;
    const id = setInterval(flush, FLUSH_INTERVAL);
    const onUnload = () => {
      if (queue.current.length > 0 && user) {
        const payload = JSON.stringify(queue.current);
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/admin_activity_log`;
        navigator.sendBeacon(url + `?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, new Blob([payload], { type: "application/json" }));
      }
    };
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(id);
      window.removeEventListener("beforeunload", onUnload);
      flush();
    };
  }, [role, flush, user]);

  // Navigation tracking
  useEffect(() => {
    if (role !== "regulator" || !user) return;
    const now = Date.now();
    if (pathname === lastNav.current.path && now - lastNav.current.time < DEDUP_MS) return;
    lastNav.current = { path: pathname, time: now };
    enqueue({
      event_type: "navigation",
      event_detail: pathname,
      metadata: { timestamp: new Date().toISOString() },
    });
  }, [pathname, role, user, enqueue]);

  // Login tracking
  useEffect(() => {
    if (role !== "regulator" || !user || loginLogged.current) return;
    loginLogged.current = true;
    enqueue({
      event_type: "login",
      event_detail: "Session started",
      metadata: { ...getBrowserInfo(), timestamp: new Date().toISOString() },
    });
  }, [role, user, enqueue]);

  // Error tracking
  useEffect(() => {
    if (role !== "regulator") return;

    const onError = (event: ErrorEvent) => {
      enqueue({
        event_type: "error",
        event_detail: event.message?.substring(0, 500) || "Unknown error",
        metadata: {
          stack: event.error?.stack?.substring(0, 1000),
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          timestamp: new Date().toISOString(),
        },
      });
    };

    const onUnhandled = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || event.reason?.toString() || "Unhandled rejection";
      enqueue({
        event_type: "error",
        event_detail: msg.substring(0, 500),
        metadata: {
          stack: event.reason?.stack?.substring(0, 1000),
          type: "unhandled_rejection",
          timestamp: new Date().toISOString(),
        },
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandled);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandled);
    };
  }, [role, enqueue]);
};

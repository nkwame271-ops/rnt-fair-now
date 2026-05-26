import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Siren, X, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureGate } from "@/hooks/useFeatureGate";

const PERM_KEY = "emergency_alerts_permission_prompted_v1";

/**
 * Persistent emergency alert ringer for regulator admins.
 * - Real-time subscription to unacknowledged panic_emergency reports
 * - Siren via Web Audio API (works as long as user has interacted with page)
 * - Browser Notification on each new alert (with permission)
 * - One-time permission prompt for admins
 * - Persistent blinking banner until acknowledged
 */
const EmergencyAlertRinger = () => {
  const navigate = useNavigate();
  const { visible: canView } = useFeatureGate("emergency_view_all");
  const { visible: canAck } = useFeatureGate("emergency_acknowledge");
  const [active, setActive] = useState<any[]>([]);
  const [showPermPrompt, setShowPermPrompt] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sirenNodesRef = useRef<{ osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; lfoGain: GainNode } | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // One-time permission prompt
  useEffect(() => {
    if (!canView) return;
    try {
      const prompted = localStorage.getItem(PERM_KEY);
      const notifPerm = typeof Notification !== "undefined" ? Notification.permission : "denied";
      if (!prompted && notifPerm === "default") {
        setShowPermPrompt(true);
      }
    } catch {}
  }, [canView]);

  const requestPermissions = useCallback(async () => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      // Unlock audio context on user gesture
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) audioCtxRef.current = new Ctx();
      }
      if (audioCtxRef.current?.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      localStorage.setItem(PERM_KEY, "1");
    } catch {}
    setShowPermPrompt(false);
  }, []);

  const dismissPrompt = () => {
    try { localStorage.setItem(PERM_KEY, "1"); } catch {}
    setShowPermPrompt(false);
  };

  // Load + subscribe
  useEffect(() => {
    if (!canView) return;
    let mounted = true;

    const loadOpen = async () => {
      const { data } = await supabase
        .from("safety_reports")
        .select("id, ticket_number, emergency_type, user_name_snapshot, latitude, longitude, created_at")
        .eq("report_kind", "panic_emergency")
        .is("acknowledged_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (mounted && data) {
        setActive(data);
        data.forEach((r: any) => seenIdsRef.current.add(r.id));
      }
    };
    loadOpen();

    const channel = supabase
      .channel("emergency-ringer")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "safety_reports", filter: "report_kind=eq.panic_emergency" },
        (payload) => {
          const rec = payload.new as any;
          setActive((prev) => [rec, ...prev.filter((r) => r.id !== rec.id)]);
          if (!seenIdsRef.current.has(rec.id)) {
            seenIdsRef.current.add(rec.id);
            // Fire system notification
            try {
              if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                const n = new Notification("🚨 LIVE EMERGENCY ALERT", {
                  body: `${rec.ticket_number} — ${rec.user_name_snapshot ?? "Unknown"}${rec.emergency_type ? ` (${rec.emergency_type})` : ""}`,
                  tag: `emergency-${rec.id}`,
                  requireInteraction: true,
                });
                n.onclick = () => {
                  window.focus();
                  navigate(`/regulator/safety/${rec.id}`);
                  n.close();
                };
              }
            } catch {}
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "safety_reports", filter: "report_kind=eq.panic_emergency" },
        (payload) => {
          const rec = payload.new as any;
          if (rec.acknowledged_at) {
            setActive((prev) => prev.filter((r) => r.id !== rec.id));
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [canView, navigate]);

  // Siren via Web Audio API — start/stop based on active count
  useEffect(() => {
    if (active.length === 0) {
      // Stop siren
      if (sirenNodesRef.current) {
        try {
          sirenNodesRef.current.osc.stop();
          sirenNodesRef.current.lfo.stop();
        } catch {}
        sirenNodesRef.current = null;
      }
      return;
    }
    if (sirenNodesRef.current) return; // already playing

    try {
      if (!audioCtxRef.current) {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const lfo = ctx.createOscillator(); // modulates pitch for siren wail
      const lfoGain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.value = 700;
      lfo.type = "sine";
      lfo.frequency.value = 1.5; // 1.5 Hz wail
      lfoGain.gain.value = 300; // +/- 300 Hz sweep
      gain.gain.value = 0.18;

      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      lfo.start();
      sirenNodesRef.current = { osc, gain, lfo, lfoGain };
    } catch (e) {
      console.warn("Siren unavailable", e);
    }
  }, [active.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sirenNodesRef.current) {
        try {
          sirenNodesRef.current.osc.stop();
          sirenNodesRef.current.lfo.stop();
        } catch {}
        sirenNodesRef.current = null;
      }
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  const acknowledge = async (id: string) => {
    if (!canAck) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("safety_reports")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: u.user?.id, status: "acknowledged" })
      .eq("id", id);
    setActive((prev) => prev.filter((r) => r.id !== id));
  };

  if (!canView) return null;

  // Permission prompt (shown once)
  if (showPermPrompt && active.length === 0) {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] w-[min(520px,calc(100vw-1rem))]">
        <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 shadow-lg p-3 flex items-center gap-3">
          <BellRing className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-semibold">Enable emergency notifications and sound alerts</p>
            <p className="opacity-80">Allow alarms and system notifications so you're alerted to panic emergencies even when this tab is in the background.</p>
          </div>
          <Button size="sm" onClick={requestPermissions}>Enable</Button>
          <Button size="sm" variant="ghost" onClick={dismissPrompt}>Later</Button>
        </div>
      </div>
    );
  }

  if (active.length === 0) return null;

  const top = active[0];
  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] w-[min(640px,calc(100vw-1rem))]">
      <div className="rounded-xl border-2 border-red-600 bg-red-600/95 text-white shadow-2xl p-3 animate-pulse">
        <div className="flex items-center gap-3">
          <Siren className="h-6 w-6 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">
              🚨 LIVE EMERGENCY {top.emergency_type ? `· ${top.emergency_type.toUpperCase()}` : ""}
            </p>
            <p className="text-xs opacity-90 truncate">
              {top.ticket_number} — {top.user_name_snapshot ?? "Unknown"}
              {active.length > 1 && ` (+${active.length - 1} more)`}
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate(`/regulator/safety/${top.id}`)}>
            Open
          </Button>
          {canAck && (
            <Button size="sm" variant="outline" className="bg-white/10 border-white text-white hover:bg-white/20" onClick={() => acknowledge(top.id)}>
              <X className="h-4 w-4 mr-1" /> Ack
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmergencyAlertRinger;

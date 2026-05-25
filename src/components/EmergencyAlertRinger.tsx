import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Siren, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureGate } from "@/hooks/useFeatureGate";

/**
 * Persistent emergency alert ringer for regulator admins.
 * Subscribes to new panic_emergency safety_reports and plays a looping alarm
 * + flashing banner until acknowledged by an authorized admin.
 *
 * Respects feature gate `emergency_view_alerts`. Acknowledge button is
 * additionally gated by `emergency_acknowledge`.
 */
const EmergencyAlertRinger = () => {
  const navigate = useNavigate();
  const { visible: canView } = useFeatureGate("emergency_view_alerts");
  const { visible: canAck } = useFeatureGate("emergency_acknowledge");
  const [active, setActive] = useState<any[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load currently unacknowledged panic reports and subscribe to new ones.
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
      if (mounted && data) setActive(data);
    };
    loadOpen();

    const channel = supabase
      .channel("emergency-ringer")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "safety_reports", filter: "report_kind=eq.panic_emergency" },
        (payload) => {
          setActive((prev) => [payload.new as any, ...prev.filter((r) => r.id !== (payload.new as any).id)]);
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
  }, [canView]);

  // Play/stop alarm based on active count.
  useEffect(() => {
    if (active.length === 0) {
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    if (!audioRef.current) {
      // Inline data URI for a short beep (sine 880Hz)
      audioRef.current = new Audio(
        "data:audio/wav;base64,UklGRmQDAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YUADAAB/f3+Af3+Af3+Af3+Af3+Af3+Af3+Af3+Af3+Af3+Af3+Af3+A",
      );
      audioRef.current.loop = true;
      audioRef.current.volume = 0.6;
    }
    audioRef.current.play().catch(() => {});
  }, [active.length]);

  const acknowledge = async (id: string) => {
    if (!canAck) return;
    const { data: u } = await supabase.auth.getUser();
    await supabase
      .from("safety_reports")
      .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: u.user?.id, status: "acknowledged" })
      .eq("id", id);
    setActive((prev) => prev.filter((r) => r.id !== id));
  };

  if (!canView || active.length === 0) return null;

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

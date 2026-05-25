import { useEffect, useState } from "react";
import { Siren, Phone, BellRing, PhoneCall, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { EMERGENCY_TYPES, type EmergencyType } from "@/lib/safetyCategories";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureGate } from "@/hooks/useFeatureGate";
import { useLiveLocationTracker } from "@/hooks/useLiveLocationTracker";
import { toast } from "sonner";

interface Props {
  role: "tenant" | "landlord" | "student";
}

type ActionTaken = "call" | "alert" | "call_and_alert";

const SafetyPanicButton = ({ role }: Props) => {
  const { user } = useAuth();
  const { visible } = useFeatureGate("emergency_alert", { role });
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EmergencyType | null>(null);
  const [note, setNote] = useState("");
  const [allowLive, setAllowLive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);

  useLiveLocationTracker(activeReportId, tracking);

  const selectedType = type ? EMERGENCY_TYPES.find((t) => t.value === type) : null;

  const getLocation = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });

  const placeCall = (tel: string | undefined) => {
    if (!tel) {
      toast.error("No number available for this type — use Send Alert.");
      return;
    }
    window.location.href = `tel:${tel}`;
  };

  const sendAlert = async (action: ActionTaken) => {
    if (!type || !user) return;
    setSubmitting(true);
    const pos = await getLocation();
    try {
      const { data, error } = await supabase.functions.invoke("submit-safety-report", {
        body: {
          report_kind: "panic_emergency",
          emergency_type: type,
          is_silent: false,
          user_role: role,
          severity: "critical",
          latitude: pos?.coords.latitude,
          longitude: pos?.coords.longitude,
          location_accuracy: pos?.coords.accuracy,
          action_taken: action,
          live_tracking_enabled: allowLive,
          user_note: note || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const reportId = data?.report_id || data?.id;
      if (reportId) {
        setActiveReportId(reportId);
        if (allowLive) setTracking(true);
      }
      toast.success(`🚨 Alert sent — Ticket ${data?.ticket_number ?? ""}`, { duration: 8000 });
    } catch (err: any) {
      console.error("panic alert failed", err);
      toast.error(`Failed to send alert: ${err?.message || "Try the Call button."}`);
    } finally {
      setSubmitting(false);
    }
  };

  const onAction = async (action: ActionTaken) => {
    if (!type) {
      toast.error("Pick an emergency type first.");
      return;
    }
    if (action === "call") {
      placeCall(selectedType?.tel);
      return;
    }
    if (action === "alert") {
      await sendAlert("alert");
      setOpen(false);
      reset();
      return;
    }
    if (action === "call_and_alert") {
      await sendAlert("call_and_alert");
      placeCall(selectedType?.tel);
      setOpen(false);
      reset();
    }
  };

  const reset = () => {
    setType(null);
    setNote("");
    setAllowLive(true);
  };

  const stopTracking = async () => {
    if (!activeReportId) return;
    setTracking(false);
    await supabase
      .from("safety_reports")
      .update({ tracking_stopped_at: new Date().toISOString(), live_tracking_enabled: false } as any)
      .eq("id", activeReportId);
    setActiveReportId(null);
    toast.success("Live location sharing stopped.");
  };

  if (!visible) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Panic / Emergency button"
        className="fixed bottom-36 sm:bottom-20 right-4 z-[10000] h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/40 flex items-center justify-center animate-pulse"
      >
        <Siren className="h-6 w-6" />
      </button>

      {tracking && (
        <div className="fixed bottom-52 sm:bottom-36 right-4 z-[10000] bg-amber-50 border border-amber-300 rounded-lg p-2 shadow flex items-center gap-2 text-xs">
          <MapPin className="h-4 w-4 text-amber-700 animate-pulse" />
          <span className="text-amber-800 font-medium">Live location is being shared</span>
          <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={stopTracking}>
            Stop
          </Button>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Siren className="h-5 w-5" /> Emergency Alert
            </DialogTitle>
            <DialogDescription>
              Pick the type, then choose Call, Send Alert, or both.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Emergency type</Label>
            <div className="grid grid-cols-1 gap-2">
              {EMERGENCY_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-lg border text-sm text-left flex items-center justify-between ${
                    type === t.value ? "border-red-600 bg-red-50" : "border-border"
                  }`}
                >
                  <span>{t.label}</span>
                  {t.tel && <span className="text-xs font-mono text-muted-foreground">{t.tel}</span>}
                </button>
              ))}
            </div>
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Short note (optional)…"
            rows={2}
          />

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <Label htmlFor="live" className="text-xs flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Share live location with admin
            </Label>
            <Switch id="live" checked={allowLive} onCheckedChange={setAllowLive} />
          </div>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => onAction("call")}
              disabled={!type || submitting}
            >
              <Phone className="h-4 w-4 mr-2" /> Call {selectedType?.tel ? `(${selectedType.tel})` : ""}
            </Button>
            <Button
              onClick={() => onAction("alert")}
              disabled={!type || submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <BellRing className="h-4 w-4 mr-2" /> Send Alert
            </Button>
            <Button
              onClick={() => onAction("call_and_alert")}
              disabled={!type || submitting}
              className="bg-red-700 hover:bg-red-800 text-white"
            >
              <PhoneCall className="h-4 w-4 mr-2" /> Call + Send Alert
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SafetyPanicButton;

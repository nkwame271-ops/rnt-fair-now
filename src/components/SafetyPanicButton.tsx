import { useState } from "react";
import { Siren, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { EMERGENCY_TYPES, type EmergencyType } from "@/lib/safetyCategories";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface Props {
  role: "tenant" | "landlord" | "student";
}

const SafetyPanicButton = ({ role }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EmergencyType | null>(null);
  const [silent, setSilent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getLocation = (): Promise<GeolocationPosition | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });

  const send = async () => {
    if (!type || !user) return;
    setSubmitting(true);
    const pos = await getLocation();
    try {
      const { data, error } = await supabase.functions.invoke("submit-safety-report", {
        body: {
          report_kind: "panic_emergency",
          emergency_type: type,
          is_silent: silent,
          user_role: role,
          severity: "critical",
          latitude: pos?.coords.latitude,
          longitude: pos?.coords.longitude,
          location_accuracy: pos?.coords.accuracy,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!silent) {
        toast.success(`🚨 Alert sent — Ticket ${data.ticket_number}`, { duration: 8000 });
      }
      setOpen(false);
      setType(null);
      setSilent(false);
    } catch (err: any) {
      console.error("panic alert failed", err);
      const msg = err?.message || err?.error || "Try Call Police directly.";
      toast.error(`Failed to send alert: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Panic / Emergency button"
        className="fixed bottom-20 right-4 z-[60] h-14 w-14 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/40 flex items-center justify-center animate-pulse"
      >
        <Siren className="h-6 w-6" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Siren className="h-5 w-5" /> Emergency Alert
            </DialogTitle>
            <DialogDescription>
              Pick a type and send. No long form required.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2">
            {EMERGENCY_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                className={`p-3 rounded-lg border text-sm text-left ${
                  type === t.value ? "border-red-600 bg-red-50" : "border-border"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
            <Label htmlFor="silent" className="text-sm">Silent Alert</Label>
            <Switch id="silent" checked={silent} onCheckedChange={setSilent} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={() => window.open("tel:191")}
            >
              <Phone className="h-4 w-4 mr-1" /> Call Police
            </Button>
            <Button
              onClick={send}
              disabled={!type || submitting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? "Sending..." : "Send Alert"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SafetyPanicButton;

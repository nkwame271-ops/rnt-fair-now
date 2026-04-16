import { useState } from "react";
import { CalendarDays, Plus, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/lib/notificationService";

interface Slot {
  date: string;
  time_start: string;
  time_end: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  complaintId: string;
  complaintType: "tenant" | "landlord";
  complainantUserId: string;
  complainantName: string;
  complainantPhone?: string;
  complaintCode?: string;
  officeName?: string;
  onScheduled: () => void;
}

const ScheduleComplainantDialog = ({
  open, onOpenChange, complaintId, complaintType,
  complainantUserId, complainantName, complainantPhone,
  complaintCode, officeName, onScheduled,
}: Props) => {
  const { user } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([{ date: "", time_start: "09:00", time_end: "10:00" }]);
  const [submitting, setSubmitting] = useState(false);

  const addSlot = () => setSlots(prev => [...prev, { date: "", time_start: "09:00", time_end: "10:00" }]);
  const removeSlot = (i: number) => setSlots(prev => prev.filter((_, idx) => idx !== i));
  const updateSlot = (i: number, field: keyof Slot, value: string) => {
    setSlots(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleSubmit = async () => {
    if (!user) return;
    const validSlots = slots.filter(s => s.date && s.time_start && s.time_end);
    if (validSlots.length === 0) {
      toast.error("Add at least one valid time slot");
      return;
    }
    setSubmitting(true);
    try {
      // Update complaint status
      const table = complaintType === "tenant" ? "complaints" : "landlord_complaints";
      await supabase.from(table).update({ status: "schedule_complainant" } as any).eq("id", complaintId);

      // Insert schedule
      const { error } = await supabase.from("complaint_schedules").insert({
        complaint_id: complaintId,
        complaint_type: complaintType,
        created_by: user.id,
        available_slots: validSlots,
        status: "pending_selection",
      } as any);
      if (error) throw error;

      // Notify complainant
      await supabase.from("notifications").insert({
        user_id: complainantUserId,
        title: "Appointment Scheduling",
        body: `Rent Control has offered ${validSlots.length} appointment slot(s) for your complaint. Please select a time.`,
        link: complaintType === "tenant" ? "/tenant/my-cases" : "/landlord/complaints",
      });

      if (complainantPhone) {
        const slotDetails = validSlots.map(s =>
          `${new Date(s.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${s.time_start}-${s.time_end}`
        ).join("; ");
        const codePart = complaintCode ? ` for complaint ${complaintCode}` : "";
        const officePart = officeName ? ` Visit: ${officeName} Office, Rent Control Department.` : " Visit your nearest Rent Control Office.";
        const message = `RentGhana: Appointment slots available${codePart}. Options: ${slotDetails}.${officePart} Log in to select your preferred time.`;
        sendNotification("complaint_reminder", {
          phone: complainantPhone,
          user_id: complainantUserId,
          data: { message },
        });
      }

      toast.success("Schedule sent to complainant!");
      onOpenChange(false);
      setSlots([{ date: "", time_start: "09:00", time_end: "10:00" }]);
      onScheduled();
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" /> Schedule Complainant
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Select available appointment slots for <strong>{complainantName}</strong> to visit Rent Control Department.
        </p>
        <div className="space-y-3">
          {slots.map((slot, i) => (
            <div key={i} className="flex items-end gap-2 bg-muted/50 rounded-lg p-3 border border-border">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={slot.date} onChange={(e) => updateSlot(i, "date", e.target.value)} />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="time" value={slot.time_start} onChange={(e) => updateSlot(i, "time_start", e.target.value)} />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="time" value={slot.time_end} onChange={(e) => updateSlot(i, "time_end", e.target.value)} />
              </div>
              {slots.length > 1 && (
                <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive shrink-0" onClick={() => removeSlot(i)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSlot} className="w-full">
            <Plus className="h-4 w-4 mr-1" /> Add Another Slot
          </Button>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Clock className="h-4 w-4 mr-1" />}
            {submitting ? "Sending..." : "Send Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleComplainantDialog;

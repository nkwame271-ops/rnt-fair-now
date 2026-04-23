import { useState, useEffect } from "react";
import { CalendarDays, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/lib/notificationService";

interface Slot {
  date: string;
  time_start: string;
  time_end: string;
}

interface Schedule {
  id: string;
  complaint_id: string;
  available_slots: Slot[];
  selected_slot: Slot | null;
  status: string;
}

interface Props {
  complaintTable: "complaints" | "landlord_complaints";
  userIdColumn: string;
}

const AppointmentSlotPicker = ({ complaintTable, userIdColumn }: Props) => {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchSchedules = async () => {
      // Get ALL complaints for this user (not filtered by status)
      const { data: complaints } = await (supabase
        .from(complaintTable)
        .select("id, complaint_code") as any)
        .eq(userIdColumn, user.id);

      if (!complaints || complaints.length === 0) {
        setLoading(false);
        return;
      }

      const complaintIds = complaints.map((c: any) => c.id);
      const { data: schedulesData } = await supabase
        .from("complaint_schedules")
        .select("*")
        .in("complaint_id", complaintIds)
        .in("status", ["pending_selection", "confirmed"]);

      setSchedules((schedulesData || []).map((s: any) => ({
        id: s.id,
        complaint_id: s.complaint_id,
        available_slots: s.available_slots || [],
        selected_slot: s.selected_slot,
        status: s.status,
      })));
      setLoading(false);
    };
    fetchSchedules();
  }, [user]);

  const handleSelectSlot = async (scheduleId: string, slot: Slot) => {
    if (!user) return;
    setSelecting(scheduleId);
    try {
      const { error } = await supabase
        .from("complaint_schedules")
        .update({
          selected_slot: slot as any,
          selected_by: user.id,
          selected_at: new Date().toISOString(),
          status: "confirmed",
        } as any)
        .eq("id", scheduleId);
      if (error) throw error;

      // Find schedule for context (complaint id, created_by admin)
      const schedule = schedules.find(s => s.id === scheduleId);

      // Resolve complaint office + code, complainant phone
      let officeName = "";
      let complaintCode = "";
      let createdByAdmin: string | null = null;
      if (schedule) {
        const { data: complaint } = await (supabase
          .from(complaintTable)
          .select("complaint_code, office_id") as any)
          .eq("id", schedule.complaint_id)
          .maybeSingle();
        complaintCode = complaint?.complaint_code || "";
        if (complaint?.office_id) {
          const { data: office } = await supabase.from("offices").select("name").eq("id", complaint.office_id).maybeSingle();
          officeName = office?.name || "";
        }
        const { data: schedRow } = await supabase
          .from("complaint_schedules")
          .select("created_by")
          .eq("id", scheduleId)
          .maybeSingle();
        createdByAdmin = schedRow?.created_by || null;
      }

      // SMS confirmation to complainant
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.phone) {
        const dateStr = new Date(slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
        const codePart = complaintCode ? ` for complaint ${complaintCode}` : "";
        const officePart = officeName ? ` at ${officeName} Office, Rent Control Department` : " at the Rent Control Office";
        const message = `RentControl: Appointment confirmed${codePart}. Date: ${dateStr}, Time: ${slot.time_start}-${slot.time_end}${officePart}. Please arrive on time.`;
        sendNotification("complaint_reminder", {
          phone: profile.phone,
          user_id: user.id,
          data: { message },
        });
      }

      // Notify admin who created the schedule
      if (createdByAdmin) {
        await supabase.from("notifications").insert({
          user_id: createdByAdmin,
          title: "Appointment Confirmed",
          body: `Complainant confirmed appointment${complaintCode ? ` for ${complaintCode}` : ""} on ${new Date(slot.date).toLocaleDateString("en-GB")} ${slot.time_start}-${slot.time_end}.`,
          link: "/regulator/complaints",
        });
      }

      setSchedules(prev => prev.map(s =>
        s.id === scheduleId ? { ...s, selected_slot: slot, status: "confirmed" } : s
      ));
      toast.success("Appointment confirmed!");
    } catch (err: any) {
      toast.error(err.message || "Failed to select slot");
    } finally {
      setSelecting(null);
    }
  };

  if (loading || schedules.length === 0) return null;

  return (
    <div className="space-y-4">
      {schedules.map((schedule) => (
        <div key={schedule.id} className="bg-card rounded-xl p-5 border-2 border-primary/30 shadow-card space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-card-foreground">Appointment Scheduling</h3>
            {schedule.status === "confirmed" && (
              <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full ml-auto">
                <CheckCircle2 className="h-3 w-3" /> Confirmed
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {schedule.status === "confirmed"
              ? "Your appointment has been confirmed."
              : "Rent Control has offered the following appointment times. Please select one."}
          </p>

          {schedule.status === "confirmed" && schedule.selected_slot ? (
            <div className="bg-success/5 border border-success/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-success" />
                <span className="font-semibold text-foreground">
                  {new Date(schedule.selected_slot.date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {schedule.selected_slot.time_start} — {schedule.selected_slot.time_end}
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {schedule.available_slots.map((slot, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectSlot(schedule.id, slot)}
                  disabled={selecting === schedule.id}
                  className="flex items-center justify-between bg-muted/50 hover:bg-primary/5 border border-border hover:border-primary/40 rounded-lg p-3 text-sm transition-all text-left"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <div className="font-medium text-foreground">
                        {new Date(slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </div>
                      <div className="text-xs text-muted-foreground">{slot.time_start} — {slot.time_end}</div>
                    </div>
                  </div>
                  {selecting === schedule.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <span className="text-xs font-medium text-primary">Select</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AppointmentSlotPicker;

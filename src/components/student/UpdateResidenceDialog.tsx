import { useState } from "react";
import { Loader2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  current: { school: string | null; hostel_or_hall: string | null; room_or_bed_space: string | null } | null;
  onUpdated?: () => void;
  trigger?: React.ReactNode;
}

const UpdateResidenceDialog = ({ current, onUpdated, trigger }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState(current?.school || "");
  const [hostel, setHostel] = useState(current?.hostel_or_hall || "");
  const [room, setRoom] = useState(current?.room_or_bed_space || "");
  const [reason, setReason] = useState("");

  const unchanged =
    (school || "") === (current?.school || "") &&
    (hostel || "") === (current?.hostel_or_hall || "") &&
    (room || "") === (current?.room_or_bed_space || "");

  const submit = async () => {
    if (!user) return;
    if (unchanged) { toast.error("Update at least one field"); return; }
    if (!school.trim() && !hostel.trim()) { toast.error("School or hostel is required"); return; }
    setSaving(true);
    try {
      const { error } = await (supabase.from("tenants") as any)
        .update({
          school: school.trim() || null,
          hostel_or_hall: hostel.trim() || null,
          room_or_bed_space: room.trim() || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      // Tag the most-recent open history row with the change reason (trigger created the row)
      if (reason.trim()) {
        await (supabase.from("student_residence_history") as any)
          .update({ change_reason: reason.trim() })
          .eq("tenant_user_id", user.id)
          .is("effective_to", null);
      }

      toast.success("Residence updated. Previous record kept in your history.");
      setOpen(false);
      setReason("");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Could not update residence");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Home className="h-3.5 w-3.5" /> Update Residence
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Residence</DialogTitle>
          <DialogDescription>
            Your previous residence will be kept in your history with the date you moved out.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="res-school">Institution / School</Label>
            <Input id="res-school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. University of Ghana" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-hostel">Hostel / Hall</Label>
            <Input id="res-hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="e.g. Volta Hall" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-room">Room / Bed space (optional)</Label>
            <Input id="res-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 12, Bed B" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="res-reason">Reason for change (optional)</Label>
            <Textarea id="res-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. End of academic year, transferred halls" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || unchanged}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Save residence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateResidenceDialog;

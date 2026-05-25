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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { regions } from "@/data/dummyData";

interface Current {
  school: string | null;
  hostel_or_hall: string | null;
  room_or_bed_space: string | null;
  hostel_region?: string | null;
  hostel_contact_number?: string | null;
  hostel_landlord_name?: string | null;
  ghana_post_gps?: string | null;
  hostel_location_address?: string | null;
}

interface Props {
  current: Current | null;
  onUpdated?: () => void;
  trigger?: React.ReactNode;
}

const GPS_RE = /^[A-Z]{2}-\d{3}-\d{4}$/;

const UpdateResidenceDialog = ({ current, onUpdated, trigger }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [school, setSchool] = useState(current?.school || "");
  const [hostel, setHostel] = useState(current?.hostel_or_hall || "");
  const [room, setRoom] = useState(current?.room_or_bed_space || "");
  const [hostelRegion, setHostelRegion] = useState(current?.hostel_region || "");
  const [hostelContact, setHostelContact] = useState(current?.hostel_contact_number || "");
  const [landlordName, setLandlordName] = useState(current?.hostel_landlord_name || "");
  const [gps, setGps] = useState(current?.ghana_post_gps || "");
  const [locationAddress, setLocationAddress] = useState(current?.hostel_location_address || "");
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!user) return;
    if (!school.trim() && !hostel.trim()) { toast.error("School or hostel is required"); return; }
    const gpsTrim = gps.trim().toUpperCase();
    if (gpsTrim && !GPS_RE.test(gpsTrim)) {
      toast.error("GhanaPostGPS should look like GA-123-4567");
      return;
    }
    const contactDigits = hostelContact.replace(/\D/g, "");

    setSaving(true);
    try {
      const { error } = await (supabase.from("tenants") as any)
        .update({
          school: school.trim() || null,
          hostel_or_hall: hostel.trim() || null,
          room_or_bed_space: room.trim() || null,
          hostel_region: hostelRegion || null,
          hostel_contact_number: contactDigits || null,
          hostel_landlord_name: landlordName.trim() || null,
          ghana_post_gps: gpsTrim || null,
          hostel_location_address: locationAddress.trim() || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      if (reason.trim()) {
        await (supabase.from("student_residence_history") as any)
          .update({ change_reason: reason.trim() })
          .eq("tenant_user_id", user.id)
          .is("effective_to", null);
      }

      toast.success("Accommodation details updated. Previous record kept in your history.");
      setOpen(false);
      setReason("");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Could not update accommodation details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <Home className="h-3.5 w-3.5" /> Update Accommodation Details
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Accommodation Details</DialogTitle>
          <DialogDescription>
            Add or correct your hostel info. Previous values are kept in your residence history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Accommodation</p>
            <div className="space-y-1.5">
              <Label htmlFor="res-school">Institution / School</Label>
              <Input id="res-school" value={school} onChange={(e) => setSchool(e.target.value)} placeholder="e.g. University of Ghana" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-hostel">Hostel / Hall name</Label>
              <Input id="res-hostel" value={hostel} onChange={(e) => setHostel(e.target.value)} placeholder="e.g. Volta Hall" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-room">Room number</Label>
              <Input id="res-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Room 12B" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-contact">Hostel contact number</Label>
              <Input id="res-contact" type="tel" value={hostelContact} onChange={(e) => setHostelContact(e.target.value)} placeholder="0XX XXX XXXX" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-landlord">Landlord / Hostel manager name</Label>
              <Input id="res-landlord" value={landlordName} onChange={(e) => setLandlordName(e.target.value)} placeholder="If known" />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Location</p>
            <div className="space-y-1.5">
              <Label htmlFor="res-region">Hostel region</Label>
              <Select value={hostelRegion} onValueChange={setHostelRegion}>
                <SelectTrigger id="res-region"><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-gps">GhanaPostGPS</Label>
              <Input id="res-gps" value={gps} onChange={(e) => setGps(e.target.value.toUpperCase())} placeholder="e.g. GA-123-4567" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-address">Hostel address / map description</Label>
              <Textarea id="res-address" value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} rows={2} placeholder="Describe the location or paste a Google Maps address" />
              <p className="text-xs text-muted-foreground">Tip: pin the location on Google Maps, then paste the full address here.</p>
            </div>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border">
            <Label htmlFor="res-reason">Reason for change (optional)</Label>
            <Textarea id="res-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. End of academic year, moved hostels" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Save accommodation details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateResidenceDialog;

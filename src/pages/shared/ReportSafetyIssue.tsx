import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { SAFETY_CATEGORIES } from "@/lib/safetyCategories";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";

interface Props {
  role: "tenant" | "landlord" | "student";
  backTo: string;
}

const ReportSafetyIssue = ({ role, backTo }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string>("");
  const [severity, setSeverity] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [hostel, setHostel] = useState("");
  const [school, setSchool] = useState("");
  const [silent, setSilent] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number; acc?: number }>({});

  const captureLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => toast.error("Could not get location")
    );
  };

  const submit = async () => {
    if (!user) return;
    if (!category) return toast.error("Please choose a category");
    setSubmitting(true);
    try {
      const evidence_urls: string[] = [];
      if (files) {
        for (const file of Array.from(files)) {
          const path = `${user.id}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from("safety-evidence").upload(path, file);
          if (upErr) console.warn("Evidence upload failed", upErr);
          else evidence_urls.push(path);
        }
      }
      const { data, error } = await supabase.functions.invoke("submit-safety-report", {
        body: {
          report_kind: "safety_report",
          category,
          severity,
          description,
          hostel_or_hall: hostel || null,
          school: school || null,
          is_silent: silent,
          evidence_urls,
          user_role: role,
          latitude: coords.lat,
          longitude: coords.lng,
          location_accuracy: coords.acc,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Report submitted — Ticket ${data.ticket_number}`);
      navigate(backTo);
    } catch (err: any) {
      console.error("safety submit error", err);
      const msg = err?.message || err?.error || "Could not reach safety service";
      toast.error(`Failed to submit report: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-600" />
            Report Safety Issue
          </CardTitle>
          <CardDescription>
            For serious safety concerns that are not an immediate emergency. For immediate danger,
            use the red Panic button.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {SAFETY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe what happened"
            />
          </div>

          {role === "student" && (
            <>
              <div>
                <Label>School</Label>
                <Input value={school} onChange={(e) => setSchool(e.target.value)} />
              </div>
              <div>
                <Label>Hostel / Hall</Label>
                <Input value={hostel} onChange={(e) => setHostel(e.target.value)} />
              </div>
            </>
          )}

          <div>
            <Label>Evidence (optional)</Label>
            <Input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div>
              <p className="text-sm font-medium">Location</p>
              <p className="text-xs text-muted-foreground">
                {coords.lat
                  ? `${coords.lat.toFixed(5)}, ${coords.lng?.toFixed(5)}`
                  : "Not captured"}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
              Capture
            </Button>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <Label htmlFor="silent">Silent submission</Label>
            <Switch id="silent" checked={silent} onCheckedChange={setSilent} />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(backTo)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting} className="flex-1">
              {submitting ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportSafetyIssue;

import { useEffect, useState } from "react";
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
import { ShieldAlert, CreditCard, Loader2 } from "lucide-react";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";

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
  const [anonymous, setAnonymous] = useState(false);
  const [files, setFiles] = useState<FileList | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number; acc?: number }>({});
  const [locationUnknown, setLocationUnknown] = useState(false);
  const [writtenDirections, setWrittenDirections] = useState("");
  const [nearestLandmark, setNearestLandmark] = useState("");
  const [personInvolved, setPersonInvolved] = useState("");
  const [incidentDateTime, setIncidentDateTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [feeAmount, setFeeAmount] = useState<number | null>(null);

  const feeKey = role === "student" ? "student_safety_report_fee" : "safety_report_fee";

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("feature_flags") as any)
        .select("fee_amount, fee_enabled")
        .eq("feature_key", feeKey)
        .maybeSingle();
      if (data?.fee_enabled) setFeeAmount(Number(data.fee_amount) || 0);
      else setFeeAmount(0);
    })();
  }, [feeKey]);

  const captureLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
        setLocationUnknown(false);
      },
      () => toast.error("Could not get location")
    );
  };


  const submit = async () => {
    if (!user) return;
    if (!category) return toast.error("Please choose a category");
    if (!description.trim()) return toast.error("Please describe what happened");
    if (locationUnknown && !writtenDirections.trim() && !nearestLandmark.trim()) {
      return toast.error("Provide directions or a landmark when location is unknown");
    }
    setSubmitting(true);
    try {
      const evidence_paths: string[] = [];
      if (files) {
        for (const file of Array.from(files)) {
          const path = `${user.id}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from("safety-evidence").upload(path, file);
          if (upErr) console.warn("Evidence upload failed", upErr);
          else evidence_paths.push(path);
        }
      }

      const payload = {
        report_kind: "safety_report",
        category,
        severity,
        description,
        hostel_or_hall: hostel || null,
        school: school || null,
        is_silent: silent,
        is_anonymous: anonymous,
        user_role: role,
        latitude: locationUnknown ? null : coords.lat ?? null,
        longitude: locationUnknown ? null : coords.lng ?? null,
        location_accuracy: locationUnknown ? null : coords.acc ?? null,
        location_unknown: locationUnknown,
        written_directions: writtenDirections || null,
        nearest_landmark: nearestLandmark || null,
        person_involved: personInvolved || null,
        incident_datetime: incidentDateTime ? new Date(incidentDateTime).toISOString() : null,
      };

      // Create draft awaiting payment
      const { data: draft, error: dErr } = await (supabase
        .from("pending_safety_report_drafts") as any)
        .insert({
          user_id: user.id,
          user_role: role,
          payload,
          evidence_paths,
          amount: feeAmount ?? 0,
          status: "pending_payment",
        })
        .select("id")
        .single();
      if (dErr) throw dErr;

      const checkoutType = role === "student" ? "student_safety_report_draft" : "safety_report_draft";
      const { data: payRaw, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: checkoutType, draftId: draft.id, callbackPath: `${backTo}?status=safety_paid` },
      });
      let payData: any = payRaw;
      if (typeof payRaw === "string") {
        try { payData = JSON.parse(payRaw); } catch {}
      }
      if (payErr || payData?.error || !payData?.reference) {
        try { await (supabase.from("pending_safety_report_drafts") as any).delete().eq("id", draft.id); } catch {}
        const reason = payData?.error || payErr?.message || "Could not start payment. Please try again.";
        throw new Error(reason);
      }
      if (payData?.reference) sessionStorage.setItem("pendingPaymentReference", payData.reference);
      if (!startBrandedCheckout(payData as any)) {
        throw new Error("No secure checkout details received");
      }
      toast.success("Opening secure checkout…");
    } catch (err: any) {
      console.error("safety submit error", err);
      const msg = err?.message || err?.error || "Could not start payment";
      toast.error(`Failed: ${msg}`);
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
            use the red Panic button (free, no payment required).
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
            <Label>Incident date & time</Label>
            <Input type="datetime-local" value={incidentDateTime} onChange={(e) => setIncidentDateTime(e.target.value)} />
          </div>

          <div>
            <Label>Person involved (optional)</Label>
            <Input value={personInvolved} onChange={(e) => setPersonInvolved(e.target.value)} placeholder="Name, description or relationship" maxLength={200} />
          </div>

          <div>
            <Label>Photos / videos (optional)</Label>
            <Input type="file" multiple accept="image/*,video/*" onChange={(e) => setFiles(e.target.files)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <Label htmlFor="location_unknown">I don't know my exact location</Label>
            <Switch id="location_unknown" checked={locationUnknown} onCheckedChange={setLocationUnknown} />
          </div>

          {!locationUnknown && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
              <div>
                <p className="text-sm font-medium">Current location / map pin</p>
                <p className="text-xs text-muted-foreground">
                  {coords.lat
                    ? `${coords.lat.toFixed(5)}, ${coords.lng?.toFixed(5)}`
                    : "Not captured"}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={captureLocation}>
                Use my location
              </Button>
            </div>
          )}

          <div>
            <Label>Written directions {locationUnknown ? "*" : "(optional)"}</Label>
            <Textarea value={writtenDirections} onChange={(e) => setWrittenDirections(e.target.value)} rows={2} placeholder="How to find the place" maxLength={500} />
          </div>

          <div>
            <Label>Nearest landmark {locationUnknown ? "*" : "(optional)"}</Label>
            <Input value={nearestLandmark} onChange={(e) => setNearestLandmark(e.target.value)} placeholder="e.g. beside Melcom, opposite fuel station" maxLength={200} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <Label htmlFor="silent">Silent submission</Label>
            <Switch id="silent" checked={silent} onCheckedChange={setSilent} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
            <div>
              <Label htmlFor="anonymous">Report anonymously</Label>
              <p className="text-xs text-muted-foreground">Hides your name from responders. Your account remains on file for abuse protection.</p>
            </div>
            <Switch id="anonymous" checked={anonymous} onCheckedChange={setAnonymous} />
          </div>

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Safety Report Fee</p>
              <p className="text-muted-foreground">
                A fee of <strong>GHS {(feeAmount ?? 0).toFixed(2)}</strong> applies to file this
                Safety Report. Your report is created only after payment is confirmed.
                Emergency Panic alerts remain free.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(backTo)} className="flex-1" disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting || feeAmount === null} className="flex-1">
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Redirecting…</>
              ) : (
                <>Pay GHS {(feeAmount ?? 0).toFixed(2)} & Submit</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportSafetyIssue;

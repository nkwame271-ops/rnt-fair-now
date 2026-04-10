import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, FileText, MapPin, Info, ArrowRight, ArrowLeft, Navigation, AlertTriangle, Check, Mic, Square, Play, Trash2, ImagePlus, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { complaintTypes, regions, areasByRegion } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
// Complaints are in-app only per notification spec — no SMS/email import needed
import { useFeeConfig } from "@/hooks/useFeatureFlag";

const steps = ["Complaint Type", "Property Details", "Location", "Description & Evidence", "Review & Submit"];

const FileComplaint = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const feeConfig = useFeeConfig("complaint_fee");
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [form, setForm] = useState({
    type: "",
    landlordName: "",
    landlordPhone: "",
    address: "",
    region: "",
    area: "",
    description: "",
    amount: "",
    date: "",
    gpsLocation: "",
    gpsConfirmed: false,
  });

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  const areas = form.region ? areasByRegion[form.region] || [] : [];

  // Audio recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.onerror = () => {
        toast.error("Audio recording failed. Please try again.");
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      toast.error("Could not access microphone. Please allow microphone access.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const deleteRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
  };

  // Image handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imageFiles.length + files.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    const newFiles = [...imageFiles, ...files].slice(0, 5);
    setImageFiles(newFiles);
    setImagePreviews(newFiles.map((f) => URL.createObjectURL(f)));
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCaptureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported by your browser");
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setForm(prev => ({ ...prev, gpsLocation: loc, gpsConfirmed: false }));
        setGettingLocation(false);
        toast.success("Location captured! Please confirm it matches the complaint property.");
      },
      () => {
        setGettingLocation(false);
        toast.error("Could not get your location. Please enable location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const uploadFiles = async (complaintId: string) => {
    const evidenceUrls: string[] = [];
    let uploadedAudioUrl: string | null = null;

    // Upload images
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const ext = file.name.split(".").pop();
      const path = `complaints/${complaintId}/evidence-${i}.${ext}`;
      const { error } = await supabase.storage.from("application-evidence").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
        evidenceUrls.push(urlData.publicUrl);
      }
    }

    // Upload audio
    if (audioBlob) {
      const path = `complaints/${complaintId}/audio.webm`;
      const { error } = await supabase.storage.from("application-evidence").upload(path, audioBlob, { contentType: "audio/webm" });
      if (!error) {
        const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(path);
        uploadedAudioUrl = urlData.publicUrl;
      }
    }

    return { evidenceUrls, uploadedAudioUrl };
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error("You must be logged in to file a complaint");
      return;
    }
    if (!form.type || !form.landlordName || !form.address || !form.region || !form.description) {
      toast.error("Please fill in all required fields before submitting");
      return;
    }
    setSubmitting(true);
    try {
      const complaintCode = `RC-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;

      // Resolve office from complaint region/area
      const { data: officeId } = await supabase.rpc("resolve_office_id", { p_region: form.region, p_area: form.area || null });
      const resolvedOffice = officeId || "accra_central";

      const { data: complaint, error } = await supabase.from("complaints").insert({
        tenant_user_id: user.id,
        complaint_code: complaintCode,
        complaint_type: form.type,
        landlord_name: form.landlordName,
        property_address: form.address,
        region: form.region,
        description: form.description,
        status: feeConfig.enabled ? "pending_payment" : "submitted",
        gps_location: form.gpsLocation || null,
        gps_confirmed: form.gpsConfirmed,
        gps_confirmed_at: form.gpsConfirmed ? new Date().toISOString() : null,
        office_id: resolvedOffice,
      } as any).select("id").single();

      if (error) throw error;
      if (!complaint?.id) throw new Error("Complaint was not created properly");

      // Create a case record for this complaint
      try {
        const { data: caseNumber } = await supabase.rpc("generate_case_number");
        await supabase.from("cases").insert({
          case_number: caseNumber || `CASE-${Date.now()}`,
          office_id: resolvedOffice,
          user_id: user.id,
          case_type: "complaint",
          related_complaint_id: complaint.id,
          metadata: { complaint_code: complaintCode },
        } as any);
      } catch (e) {
        console.error("Case creation error:", e);
      }

      // Upload evidence files
      if (imageFiles.length > 0 || audioBlob) {
        const { evidenceUrls, uploadedAudioUrl } = await uploadFiles(complaint.id);
        await supabase.from("complaints").update({
          evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
          audio_url: uploadedAudioUrl || undefined,
        } as any).eq("id", complaint.id);
      }

      // Complaint filing is in-app only per notification spec — no SMS/email

      // If fee is disabled, skip payment entirely
      if (!feeConfig.enabled) {
        toast.success("Complaint filed successfully!");
        navigate("/tenant/my-cases");
        return;
      }

      const { data: rawData, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "complaint_fee", complaintId: complaint.id },
      });

      let data = rawData;
      if (typeof rawData === "string") {
        try { data = JSON.parse(rawData); } catch { data = rawData; }
      }

      if (payErr) {
        let errorMsg = payErr.message || "Payment initiation failed";
        try {
          if ((payErr as any).context) {
            const body = await (payErr as any).context.json();
            errorMsg = body?.error || errorMsg;
          }
        } catch (_) {}
        throw new Error(errorMsg);
      }
      if (data?.error) throw new Error(data.error);

      if (data?.authorization_url) {
        if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
      } else if (data?.skipped || (data && !data.error)) {
        // Fee waived — update complaint to submitted directly
        await supabase.from("complaints").update({ status: "submitted" }).eq("id", complaint.id);
        toast.success("Complaint filed successfully!");
        navigate("/tenant/my-cases");
      } else {
        throw new Error("No checkout URL received. Please try again.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">File a Complaint</h1>
        <p className="text-muted-foreground mt-1">Report a tenancy violation to Rent Control</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>
      <div className="text-sm font-semibold text-foreground">{steps[step]}</div>

      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
        {step === 0 && (
          <div className="space-y-4">
            <Label>What type of violation are you reporting?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {complaintTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => update("type", t)}
                  className={`text-left p-3 rounded-lg border text-sm font-medium transition-all ${
                    form.type === t
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-card-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Landlord / Agent Name</Label>
                <Input value={form.landlordName} onChange={(e) => update("landlordName", e.target.value)} placeholder="e.g. Mr. Kofi Boateng" />
              </div>
              <div className="space-y-2">
                <Label>Landlord Phone (optional)</Label>
                <Input value={form.landlordPhone} onChange={(e) => update("landlordPhone", e.target.value)} placeholder="024 555 1234" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property Address</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="e.g. 12 Ring Road, Osu" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => setForm(prev => ({ ...prev, region: v, area: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District / Area</Label>
                <Select value={form.area} onValueChange={(v) => update("area", v)} disabled={!form.region}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Label className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Complaint Location (GPS)
            </Label>
            <div className="flex items-start gap-2 text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Please capture your GPS location <strong>at or near the property</strong> where the complaint occurred. This helps the Rent Control team locate the property faster.
              </span>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCaptureGps}
              disabled={gettingLocation}
              className="w-full"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {gettingLocation ? "Getting location..." : form.gpsLocation ? "Recapture GPS Location" : "Capture My GPS Location"}
            </Button>

            {form.gpsLocation && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                  <Check className="h-4 w-4" />
                  <span>Location captured: {form.gpsLocation}</span>
                </div>
                <label className="flex items-start gap-2.5 cursor-pointer bg-muted rounded-lg px-3 py-2.5 border border-border">
                  <Checkbox
                    checked={form.gpsConfirmed}
                    onCheckedChange={(v) => update("gpsConfirmed", !!v)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    I confirm I am at or near the <strong>property in question</strong> and this GPS location is accurate.
                  </span>
                </label>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              GPS capture is optional but highly recommended for faster resolution.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the incident in detail</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What happened? Include dates, amounts, and any relevant context..." />
            </div>

            {/* Audio Recording */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5" /> Voice Recording (optional)
              </Label>
              <p className="text-xs text-muted-foreground">Can't type? Record a voice message describing your complaint.</p>

              {!audioUrl ? (
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  onClick={isRecording ? stopRecording : startRecording}
                  className="w-full"
                >
                  {isRecording ? (
                    <>
                      <Square className="h-4 w-4 mr-2" />
                      <span className="animate-pulse">Recording... Tap to stop</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4 mr-2" /> Start Recording
                    </>
                  )}
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-muted rounded-lg p-3 border border-border">
                  <Play className="h-4 w-4 text-primary shrink-0" />
                  <audio src={audioUrl} controls className="flex-1 h-8" />
                  <Button type="button" variant="ghost" size="icon" onClick={deleteRecording} className="shrink-0">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <ImagePlus className="h-3.5 w-3.5" /> Supporting Images (optional, max 5)
              </Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => imageInputRef.current?.click()}
                disabled={imageFiles.length >= 5}
                className="w-full"
              >
                <ImagePlus className="h-4 w-4 mr-2" />
                {imageFiles.length > 0 ? `${imageFiles.length}/5 images selected — Add more` : "Upload Images"}
              </Button>

              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={src} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount involved (GH₵)</Label>
                <Input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-2">
                <Label>Date of incident</Label>
                <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold text-card-foreground">{form.type}</span></div>
              <div><span className="text-muted-foreground">Landlord:</span> <span className="font-semibold text-card-foreground">{form.landlordName || "—"}</span></div>
              <div><span className="text-muted-foreground">Property:</span> <span className="font-semibold text-card-foreground">{form.address || "—"}</span></div>
              <div><span className="text-muted-foreground">Location:</span> <span className="font-semibold text-card-foreground">{form.area}, {form.region}</span></div>
              {form.gpsLocation && (
                <div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold text-card-foreground">{form.gpsLocation} {form.gpsConfirmed ? "✓ Confirmed" : ""}</span></div>
              )}
              <div><span className="text-muted-foreground">Description:</span> <span className="font-semibold text-card-foreground">{form.description || "—"}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold text-card-foreground">GH₵ {form.amount || "—"}</span></div>
              {audioBlob && (
                <div><span className="text-muted-foreground">Voice Recording:</span> <span className="font-semibold text-success">✓ Attached</span></div>
              )}
              {imageFiles.length > 0 && (
                <div><span className="text-muted-foreground">Evidence Images:</span> <span className="font-semibold text-success">✓ {imageFiles.length} image(s)</span></div>
              )}
            </div>
            {feeConfig.enabled && (
              <div className="bg-card rounded-lg border border-border p-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Complaint Filing Fee</span><span className="font-semibold text-primary">GH₵ {feeConfig.amount.toFixed(2)}</span></div>
                <p className="text-xs text-muted-foreground">You'll be redirected to make an online payment for the filing fee. Your complaint will be submitted once payment is confirmed.</p>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <span>By submitting, you confirm the information provided is accurate. False complaints may result in penalties under Act 220.</span>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      {step < 4 ? (
          <Button onClick={() => {
            if (step === 0 && !form.type) {
              toast.error("Please select a complaint type before proceeding");
              return;
            }
            if (step === 1) {
              if (!form.landlordName.trim()) { toast.error("Landlord / Agent Name is required"); return; }
              if (!form.address.trim()) { toast.error("Property Address is required"); return; }
              if (!form.region) { toast.error("Region is required"); return; }
            }
            if (step === 3 && !form.description.trim() && !audioBlob) {
              toast.error("Please describe the incident or record a voice message before proceeding");
              return;
            }
            setStep(step + 1);
          }}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing..." : feeConfig.enabled ? `Pay GH₵ ${feeConfig.amount.toFixed(2)} & Submit` : "Submit Complaint"} <FileText className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default FileComplaint;

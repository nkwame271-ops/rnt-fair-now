import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, FileText, MapPin, Info, ArrowRight, ArrowLeft, Navigation, AlertTriangle, Check, Mic, Square, Play, Trash2, ImagePlus, X, Building2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { complaintTypes, regions, areasByRegion } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useJsApiLoader } from "@react-google-maps/api";
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from "@/lib/googleMaps";

const steps = ["Office", "Complaint Type", "Property Details", "Location", "Description & Evidence", "Review & Submit"];

const FileComplaint = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  useJsApiLoader({ id: "google-map-script", googleMapsApiKey: GOOGLE_MAPS_API_KEY, libraries: GOOGLE_MAPS_LIBRARIES });
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [offices, setOffices] = useState<{ id: string; name: string; region: string }[]>([]);
  const [form, setForm] = useState({
    type: "",
    landlordName: "",
    landlordPhone: "",
    address: "",
    region: "",
    area: "",
    officeId: "",
    description: "",
    amount: "",
    date: "",
    gpsLocation: "",
    gpsConfirmed: false,
    // Property snapshot fields (for similarity engine)
    propertyName: "",
    propertyType: "",
    unitDescription: "",
    monthlyRent: "",
    addressDescription: "",
    // Location capture method
    locationMethod: "" as "" | "live" | "gps_code" | "map_search",
    locationLat: null as number | null,
    locationLng: null as number | null,
    gpsCode: "",
    placeName: "",
    placeId: "",
  });

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  const areas = form.region ? areasByRegion[form.region] || [] : [];

  // Load all offices once
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("offices").select("id, name, region").order("name");
      setOffices(data || []);
    })();
  }, []);

  const officesInRegion = form.region ? offices.filter((o) => o.region === form.region) : [];

  // Student residence history (defaults complaints to current residence; allows picking a previous one)
  const [residences, setResidences] = useState<{ id: string; school: string | null; hostel_or_hall: string | null; room_or_bed_space: string | null; effective_from: string; effective_to: string | null }[]>([]);
  const [selectedResidenceId, setSelectedResidenceId] = useState<string>("");
  const [isStudent, setIsStudent] = useState(false);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: t } = await supabase.from("tenants").select("is_student").eq("user_id", user.id).maybeSingle();
      if (!t?.is_student) return;
      setIsStudent(true);
      const { data: hist } = await (supabase.from("student_residence_history") as any)
        .select("id, school, hostel_or_hall, room_or_bed_space, effective_from, effective_to")
        .eq("tenant_user_id", user.id)
        .order("effective_from", { ascending: false });
      const rows = (hist || []) as any[];
      setResidences(rows);
      const current = rows.find((r) => r.effective_to == null) || rows[0];
      if (current) {
        setSelectedResidenceId(current.id);
        setForm((prev) => ({
          ...prev,
          propertyType: prev.propertyType || "hostel",
          propertyName: prev.propertyName || current.hostel_or_hall || "",
          unitDescription: prev.unitDescription || current.room_or_bed_space || "",
        }));
      }
    })();
  }, [user]);

  const applyResidence = (id: string) => {
    setSelectedResidenceId(id);
    const r = residences.find((x) => x.id === id);
    if (!r) return;
    setForm((prev) => ({
      ...prev,
      propertyName: r.hostel_or_hall || "",
      unitDescription: r.room_or_bed_space || "",
    }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4"
        : MediaRecorder.isTypeSupported("audio/ogg") ? "audio/ogg" : "";
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
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

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };
  const deleteRecording = () => { if (audioUrl) URL.revokeObjectURL(audioUrl); setAudioBlob(null); setAudioUrl(null); };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (imageFiles.length + files.length > 5) { toast.error("Maximum 5 images allowed"); return; }
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
    if (!navigator.geolocation) { toast.error("Geolocation not supported by your browser"); return; }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
        setForm(prev => ({
          ...prev,
          gpsLocation: loc,
          gpsConfirmed: false,
          locationMethod: "live",
          locationLat: pos.coords.latitude,
          locationLng: pos.coords.longitude,
        }));
        setGettingLocation(false);
        toast.success("Location captured! Please confirm it matches the complaint property.");
      },
      () => { setGettingLocation(false); toast.error("Could not get your location. Please enable location access."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleGeocodeGpsCode = async () => {
    const code = form.gpsCode.trim();
    if (!code) { toast.error("Enter a GPS or digital address"); return; }
    setGettingLocation(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(code + ", Ghana")}&key=AIzaSyBbj3EaLVeMViYbbn8Zrzgqu1qg4OMSLQ4`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "OK" && json.results?.[0]) {
        const loc = json.results[0].geometry.location;
        setForm(prev => ({
          ...prev,
          locationMethod: "gps_code",
          locationLat: loc.lat,
          locationLng: loc.lng,
          gpsLocation: `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}`,
        }));
        toast.success("Address located on the map.");
      } else {
        toast.error("Address not found — check and retry.");
      }
    } catch {
      toast.error("Could not geocode address. Try again.");
    } finally {
      setGettingLocation(false);
    }
  };

  const handleMapSearchSelect = (place: { lat: number; lng: number; name: string; place_id: string }) => {
    setForm(prev => ({
      ...prev,
      locationMethod: "map_search",
      locationLat: place.lat,
      locationLng: place.lng,
      placeName: place.name,
      placeId: place.place_id,
      gpsLocation: `${place.lat.toFixed(6)}, ${place.lng.toFixed(6)}`,
    }));
  };

  const uploadFiles = async (complaintId: string) => {
    const evidenceUrls: string[] = [];
    let uploadedAudioUrl: string | null = null;
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
    if (!user) { toast.error("You must be logged in to file a complaint"); return; }
    if (!form.officeId) { toast.error("Please select a Rent Control office"); return; }
    if (!form.type || !form.landlordName || !form.address || !form.region || !form.description) {
      toast.error("Please fill in all required fields before submitting"); return;
    }
    if (!form.propertyType || !form.monthlyRent) {
      toast.error("Please complete the Property Details (type and monthly rent)"); return;
    }
    if (!form.locationMethod || form.locationLat === null || form.locationLng === null) {
      toast.error("Please provide the property location to continue."); return;
    }
    setSubmitting(true);
    try {
      const complaintCode = `RC-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;
      const { data: ticketNumber } = await supabase.rpc("generate_complaint_ticket");

      // 1. Insert complaint_properties snapshot first
      const { data: cp, error: cpErr } = await supabase.from("complaint_properties").insert({
        tenant_user_id: user.id,
        landlord_name: form.landlordName,
        property_name: form.propertyName || null,
        property_type: form.propertyType,
        unit_description: form.unitDescription || null,
        monthly_rent: parseFloat(form.monthlyRent) || 0,
        address_description: form.addressDescription || null,
        lat: form.locationLat,
        lng: form.locationLng,
        gps_code: form.gpsCode || null,
        place_name: form.placeName || null,
        place_id: form.placeId || null,
        location_method: form.locationMethod,
      } as any).select("id").single();

      if (cpErr) console.error("complaint_properties insert error:", cpErr);

      const { data: complaint, error } = await supabase.from("complaints").insert({
        tenant_user_id: user.id,
        complaint_code: complaintCode,
        ticket_number: ticketNumber || undefined,
        complaint_type: form.type,
        landlord_name: form.landlordName,
        property_address: form.address,
        region: form.region,
        description: form.description,
        status: "submitted",
        payment_status: "awaiting",
        gps_location: `${form.locationLat}, ${form.locationLng}`,
        gps_confirmed: form.gpsConfirmed,
        gps_confirmed_at: form.gpsConfirmed ? new Date().toISOString() : null,
        office_id: form.officeId,
        complaint_property_id: cp?.id || null,
      } as any).select("id").single();

      if (error) throw error;
      if (!complaint?.id) throw new Error("Complaint was not created properly");

      // Link back: update complaint_properties.complaint_id
      if (cp?.id) {
        await supabase.from("complaint_properties").update({ complaint_id: complaint.id } as any).eq("id", cp.id);
      }

      try {
        const { data: caseNumber } = await supabase.rpc("generate_case_number");
        await supabase.from("cases").insert({
          case_number: caseNumber || `CASE-${Date.now()}`,
          office_id: form.officeId,
          user_id: user.id,
          case_type: "complaint",
          related_complaint_id: complaint.id,
          metadata: { complaint_code: complaintCode },
        } as any);
      } catch (e) {
        console.error("Case creation error:", e);
      }

      if (imageFiles.length > 0 || audioBlob) {
        const { evidenceUrls, uploadedAudioUrl } = await uploadFiles(complaint.id);
        await supabase.from("complaints").update({
          evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
          audio_url: uploadedAudioUrl || undefined,
        } as any).eq("id", complaint.id);
      }

      // Fire-and-forget similarity check
      if (cp?.id) {
        supabase.functions.invoke("run-similarity-check", {
          body: { source_type: "complaint_property", source_id: cp.id },
        }).catch((e) => console.error("similarity check failed:", e));
      }

      toast.success("Complaint submitted! An officer will review and contact you regarding any required fee.");
      navigate("/tenant/my-cases");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOffice = offices.find((o) => o.id === form.officeId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">File a Complaint</h1>
        <p className="text-muted-foreground mt-1">Report a tenancy violation to Rent Control</p>
      </div>

      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
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
            <div className="flex items-start gap-2 text-xs bg-info/10 text-info border border-info/20 rounded-lg px-3 py-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Choose the Rent Control office that should handle your case. This is usually the office in the region where the property is located.</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Region <span className="text-destructive">*</span></Label>
                <Select value={form.region} onValueChange={(v) => setForm(prev => ({ ...prev, region: v, area: "", officeId: "" }))}>
                  <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rent Control Office <span className="text-destructive">*</span></Label>
                <Select value={form.officeId} onValueChange={(v) => update("officeId", v)} disabled={!form.region}>
                  <SelectTrigger><SelectValue placeholder={form.region ? "Select office" : "Select region first"} /></SelectTrigger>
                  <SelectContent>
                    {officesInRegion.length === 0 && form.region && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">No offices in {form.region}</div>
                    )}
                    {officesInRegion.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {selectedOffice && (
              <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-lg p-3 text-sm">
                <Building2 className="h-4 w-4 text-success" />
                <span className="text-foreground"><strong>{selectedOffice.name}</strong> — {selectedOffice.region}</span>
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <Label>What type of violation are you reporting?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {complaintTypes.map((t) => (
                <button key={t} onClick={() => update("type", t)}
                  className={`text-left p-3 rounded-lg border text-sm font-medium transition-all ${
                    form.type === t ? "border-primary bg-primary/5 text-primary" : "border-border text-card-foreground hover:border-primary/50"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {isStudent && residences.length > 0 && (
              <div className="bg-info/5 border border-info/20 rounded-lg p-3 space-y-2">
                <Label className="flex items-center gap-1.5 text-xs font-semibold text-info uppercase tracking-wide">
                  <Building2 className="h-3.5 w-3.5" /> File complaint about which residence?
                </Label>
                <Select value={selectedResidenceId} onValueChange={applyResidence}>
                  <SelectTrigger><SelectValue placeholder="Select residence" /></SelectTrigger>
                  <SelectContent>
                    {residences.map((r) => {
                      const current = r.effective_to == null;
                      const dates = `${new Date(r.effective_from).toLocaleDateString("en-GB", { month: "short", year: "numeric" })} – ${r.effective_to ? new Date(r.effective_to).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Present"}`;
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          {(r.hostel_or_hall || "Unnamed")}{r.room_or_bed_space ? ` · ${r.room_or_bed_space}` : ""} {current ? "(Current)" : `(${dates})`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Defaults to your current residence. Pick a previous one if the complaint relates to where you used to live.</p>
              </div>
            )}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Landlord / Agent Name <span className="text-destructive">*</span></Label>
                <Input value={form.landlordName} onChange={(e) => update("landlordName", e.target.value)} placeholder="e.g. Mr. Kofi Boateng" />
              </div>
              <div className="space-y-2">
                <Label>Landlord Phone (optional)</Label>
                <Input value={form.landlordPhone} onChange={(e) => update("landlordPhone", e.target.value)} placeholder="024 555 1234" />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property / Building Name (optional)</Label>
                <Input value={form.propertyName} onChange={(e) => update("propertyName", e.target.value)} placeholder="e.g. Oak Court Apartments" />
              </div>
              <div className="space-y-2">
                <Label>Property Type <span className="text-destructive">*</span></Label>
                <Select value={form.propertyType} onValueChange={(v) => update("propertyType", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residential">Residential</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="hostel">Student Hostel</SelectItem>
                    <SelectItem value="hall_of_residence">Hall of Residence</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit Description (optional)</Label>
                <Input value={form.unitDescription} onChange={(e) => update("unitDescription", e.target.value)} placeholder="e.g. Room 4, Block B" />
              </div>
              <div className="space-y-2">
                <Label>Monthly Rent (GH₵) <span className="text-destructive">*</span></Label>
                <Input type="number" value={form.monthlyRent} onChange={(e) => update("monthlyRent", e.target.value)} placeholder="e.g. 1200" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property Address <span className="text-destructive">*</span></Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="e.g. 12 Ring Road, Osu" />
            </div>
            <div className="space-y-2">
              <Label>Address / Area Description (optional)</Label>
              <Input value={form.addressDescription} onChange={(e) => update("addressDescription", e.target.value)} placeholder="Street, neighbourhood, landmark..." />
            </div>
            <div className="space-y-2">
              <Label>District / Area (optional)</Label>
              <Select value={form.area} onValueChange={(v) => update("area", v)} disabled={!form.region}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Label className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Property Location <span className="text-destructive">*</span></Label>
            <div className="flex items-start gap-2 text-xs bg-warning/10 text-warning border border-warning/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Choose <strong>one</strong> of the three methods below to pin the property location. This helps us match your complaint to the registered property record.</span>
            </div>

            {/* Tab selector */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(["map_search", "live", "gps_code"] as const).map((m) => {
                const labels = { map_search: "Search on Map", live: "Live Location", gps_code: "GPS / Digital Address" };
                const active = (form.locationMethod || "map_search") === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, locationMethod: m }))}
                    className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {labels[m]}
                  </button>
                );
              })}
            </div>

            {/* Live Location */}
            {(form.locationMethod === "live" || (!form.locationMethod && false)) && (
              <div className="space-y-2">
                <Button type="button" variant="outline" onClick={handleCaptureGps} disabled={gettingLocation} className="w-full">
                  <Navigation className="h-4 w-4 mr-2" />
                  {gettingLocation ? "Getting location..." : form.locationMethod === "live" && form.locationLat ? "Recapture My Location" : "Use My Current Location"}
                </Button>
                {form.locationMethod === "live" && form.locationLat !== null && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                    <Check className="h-4 w-4" />
                    <span>Location captured: {form.locationLat.toFixed(6)}, {form.locationLng?.toFixed(6)}</span>
                  </div>
                )}
              </div>
            )}

            {/* GPS Code */}
            {form.locationMethod === "gps_code" && (
              <div className="space-y-2">
                <Input
                  value={form.gpsCode}
                  onChange={(e) => update("gpsCode", e.target.value)}
                  placeholder="e.g. GA-123-4567"
                  onBlur={() => form.gpsCode && handleGeocodeGpsCode()}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleGeocodeGpsCode} disabled={gettingLocation || !form.gpsCode}>
                  {gettingLocation ? "Locating..." : "Locate Address"}
                </Button>
                {form.locationMethod === "gps_code" && form.locationLat !== null && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                    <Check className="h-4 w-4" />
                    <span>Found: {form.locationLat.toFixed(6)}, {form.locationLng?.toFixed(6)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Map Search (default) */}
            {(form.locationMethod === "map_search" || !form.locationMethod) && (
              <div className="space-y-2">
                <Input
                  placeholder="Search a place, building, or address (autocomplete)"
                  value={form.placeName}
                  onChange={(e) => update("placeName", e.target.value)}
                  ref={(el) => {
                    if (!el || (el as any).__autocomplete_attached) return;
                    if (typeof window === "undefined" || !(window as any).google?.maps?.places) return;
                    const ac = new (window as any).google.maps.places.Autocomplete(el, {
                      componentRestrictions: { country: "gh" },
                      fields: ["geometry", "name", "place_id", "formatted_address"],
                    });
                    ac.addListener("place_changed", () => {
                      const p = ac.getPlace();
                      if (p?.geometry?.location) {
                        handleMapSearchSelect({
                          lat: p.geometry.location.lat(),
                          lng: p.geometry.location.lng(),
                          name: p.name || p.formatted_address || "",
                          place_id: p.place_id || "",
                        });
                      }
                    });
                    (el as any).__autocomplete_attached = true;
                  }}
                />
                {form.locationMethod === "map_search" && form.locationLat !== null && (
                  <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2">
                    <Check className="h-4 w-4" />
                    <span>{form.placeName} ({form.locationLat.toFixed(6)}, {form.locationLng?.toFixed(6)})</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Tip: type a place name or address — Google will suggest matches.</p>
              </div>
            )}

            {form.locationLat !== null && (
              <label className="flex items-start gap-2.5 cursor-pointer bg-muted rounded-lg px-3 py-2.5 border border-border">
                <Checkbox checked={form.gpsConfirmed} onCheckedChange={(v) => update("gpsConfirmed", !!v)} className="mt-0.5" />
                <span className="text-sm">I confirm this location refers to the <strong>property in question</strong>.</span>
              </label>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the incident in detail</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What happened? Include dates, amounts, and any relevant context..." />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><Mic className="h-3.5 w-3.5" /> Voice Recording (optional)</Label>
              <p className="text-xs text-muted-foreground">Can't type? Record a voice message describing your complaint.</p>
              {!audioUrl ? (
                <Button type="button" variant={isRecording ? "destructive" : "outline"} onClick={isRecording ? stopRecording : startRecording} className="w-full">
                  {isRecording ? (<><Square className="h-4 w-4 mr-2" /><span className="animate-pulse">Recording... Tap to stop</span></>) : (<><Mic className="h-4 w-4 mr-2" /> Start Recording</>)}
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
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5"><ImagePlus className="h-3.5 w-3.5" /> Supporting Images (optional, max 5)</Label>
              <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />
              <Button type="button" variant="outline" onClick={() => imageInputRef.current?.click()} disabled={imageFiles.length >= 5} className="w-full">
                <ImagePlus className="h-4 w-4 mr-2" />
                {imageFiles.length > 0 ? `${imageFiles.length}/5 images selected — Add more` : "Upload Images"}
              </Button>
              {imagePreviews.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <img src={src} alt={`Evidence ${i + 1}`} className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {step === 5 && (
          <div className="space-y-4 text-sm">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div><span className="text-muted-foreground">Office:</span> <span className="font-semibold text-card-foreground">{selectedOffice?.name || "—"}</span></div>
              <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold text-card-foreground">{form.type}</span></div>
              <div><span className="text-muted-foreground">Landlord:</span> <span className="font-semibold text-card-foreground">{form.landlordName || "—"}</span></div>
              <div><span className="text-muted-foreground">Property:</span> <span className="font-semibold text-card-foreground">{form.address || "—"}</span></div>
              <div><span className="text-muted-foreground">Location:</span> <span className="font-semibold text-card-foreground">{form.area ? `${form.area}, ` : ""}{form.region}</span></div>
              {form.gpsLocation && (<div><span className="text-muted-foreground">GPS:</span> <span className="font-semibold text-card-foreground">{form.gpsLocation} {form.gpsConfirmed ? "✓ Confirmed" : ""}</span></div>)}
              <div><span className="text-muted-foreground">Description:</span> <span className="font-semibold text-card-foreground">{form.description || "—"}</span></div>
              {audioBlob && (<div><span className="text-muted-foreground">Voice Recording:</span> <span className="font-semibold text-success">✓ Attached</span></div>)}
              {imageFiles.length > 0 && (<div><span className="text-muted-foreground">Evidence Images:</span> <span className="font-semibold text-success">✓ {imageFiles.length} image(s)</span></div>)}
            </div>
            <div className="flex items-start gap-2 text-xs bg-info/5 p-3 rounded-lg border border-info/20">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <span><strong>No payment required at this stage.</strong> An officer will review your complaint and, if a filing fee applies, will request payment from you. You'll see a "Pay Now" button on your dashboard once requested.</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted p-3 rounded-lg border border-border">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>By submitting, you confirm the information provided is accurate. False complaints may result in penalties under Act 220.</span>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 5 ? (
          <Button onClick={() => {
            if (step === 0) {
              if (!form.region) { toast.error("Please select a region"); return; }
              if (!form.officeId) { toast.error("Please select the Rent Control office to handle your case"); return; }
            }
            if (step === 1 && !form.type) { toast.error("Please select a complaint type"); return; }
            if (step === 2) {
              if (!form.landlordName.trim()) { toast.error("Landlord / Agent Name is required"); return; }
              if (!form.address.trim()) { toast.error("Property Address is required"); return; }
            }
            if (step === 4 && !form.description.trim() && !audioBlob) {
              toast.error("Please describe the incident or record a voice message"); return;
            }
            setStep(step + 1);
          }}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Complaint"} <FileText className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default FileComplaint;

import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Plus, Loader2, Upload, X, Clock, CheckCircle2, Image, Mic, Square, Play, Trash2, CalendarDays, CreditCard, Receipt } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { regions } from "@/data/dummyData";
import AppointmentSlotPicker from "@/components/AppointmentSlotPicker";

const complaintTypes = [
  "Tenant refusing to vacate",
  "Tenant damaging property",
  "Unpaid rent",
  "Unauthorized subletting",
  "Noise / disturbance",
  "Other",
];

const statusConfig: Record<string, string> = {
  submitted: "bg-info/10 text-info",
  under_review: "bg-warning/10 text-warning",
  in_progress: "bg-primary/10 text-primary",
  schedule_complainant: "bg-accent/10 text-accent-foreground",
  resolved: "bg-success/10 text-success",
  closed: "bg-muted text-muted-foreground",
};

const LandlordComplaints = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleMap, setScheduleMap] = useState<Record<string, any>>({});
  const [basketMap, setBasketMap] = useState<Record<string, any[]>>({});
  const [paying, setPaying] = useState<string | null>(null);

  const [complaintType, setComplaintType] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [documents, setDocuments] = useState<File[]>([]);

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!user) return;
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (reference) {
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-payment", { body: { reference } });
          if (data?.verified) toast.success("Payment confirmed! Your complaint is now ready for scheduling.");
        } catch (_) {}
        setSearchParams({}, { replace: true });
        await new Promise((r) => setTimeout(r, 1500));
        await fetchComplaints();
        setTimeout(() => fetchComplaints(), 3000);
      })();
    } else {
      fetchComplaints();
    }
  }, [user]);

  // Realtime: refresh when admin requests payment / status changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`landlord_complaints:${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "landlord_complaints", filter: `landlord_user_id=eq.${user.id}` }, () => fetchComplaints())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchComplaints = async () => {
    const { data } = await supabase
      .from("landlord_complaints")
      .select("*")
      .eq("landlord_user_id", user!.id)
      .order("created_at", { ascending: false });
    setComplaints(data || []);

    // Fetch schedules + basket items
    if (data && data.length > 0) {
      const ids = data.map((c: any) => c.id);
      const { data: schedules } = await supabase
        .from("complaint_schedules")
        .select("*")
        .in("complaint_id", ids)
        .in("status", ["pending_selection", "confirmed"]);
      if (schedules) {
        const map: Record<string, any> = {};
        schedules.forEach((s: any) => { map[s.complaint_id] = s; });
        setScheduleMap(map);
      }

      const payIds = data.filter((c: any) => c.payment_status === "pending" && Number(c.outstanding_amount) > 0).map((c: any) => c.id);
      if (payIds.length > 0) {
        const { data: items } = await (supabase.from("complaint_basket_items") as any)
          .select("id, complaint_id, label, amount, kind")
          .in("complaint_id", payIds)
          .eq("complaint_table", "landlord_complaints")
          .order("created_at");
        const bm: Record<string, any[]> = {};
        (items || []).forEach((it: any) => { (bm[it.complaint_id] ||= []).push(it); });
        setBasketMap(bm);
      }
    }

    setLoading(false);
  };

  const handlePayNow = async (complaint: any) => {
    setPaying(complaint.id);
    try {
      const { data: rawData, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "complaint_fee", complaintId: complaint.id },
      });
      let data = rawData;
      if (typeof rawData === "string") { try { data = JSON.parse(rawData); } catch {} }
      if (error) {
        let msg = error.message || "Payment initiation failed";
        try {
          if ((error as any).context) {
            const body = await (error as any).context.json();
            msg = body?.error || msg;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Could not start payment");
    } finally {
      setPaying(null);
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setDocuments(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 6));
  };

  const resetForm = () => {
    setComplaintType(""); setTenantName(""); setPropertyAddress("");
    setRegion(""); setDescription(""); setDocuments([]);
    deleteRecording();
  };

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

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const evidenceUrls: string[] = [];
      for (const file of documents) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("application-evidence").upload(path, file);
        if (error) { console.error(error); continue; }
        const { data: { publicUrl } } = supabase.storage.from("application-evidence").getPublicUrl(path);
        evidenceUrls.push(publicUrl);
      }

      // Upload audio if recorded
      let uploadedAudioUrl: string | null = null;
      if (audioBlob) {
        const audioPath = `${user.id}/${Date.now()}_voice.webm`;
        const { error: audioErr } = await supabase.storage.from("application-evidence").upload(audioPath, audioBlob);
        if (!audioErr) {
          const { data: { publicUrl } } = supabase.storage.from("application-evidence").getPublicUrl(audioPath);
          uploadedAudioUrl = publicUrl;
        }
      }

      const code = `LC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;

      // Resolve office
      const { data: officeId } = await supabase.rpc("resolve_office_id", { p_region: region, p_area: null });
      const resolvedOffice = officeId || "accra_central";

      const { data: complaint, error } = await supabase.from("landlord_complaints").insert({
        landlord_user_id: user.id,
        complaint_code: code,
        complaint_type: complaintType,
        tenant_name: tenantName || null,
        property_address: propertyAddress,
        region,
        description,
        evidence_urls: evidenceUrls,
        audio_url: uploadedAudioUrl,
        office_id: resolvedOffice,
      } as any).select("id").single();

      if (error) throw error;

      // Create case
      try {
        const { data: caseNumber } = await supabase.rpc("generate_case_number");
        await supabase.from("cases").insert({
          case_number: caseNumber || `CASE-${Date.now()}`,
          office_id: resolvedOffice,
          user_id: user.id,
          case_type: "complaint",
          related_complaint_id: complaint?.id || null,
          metadata: { complaint_code: code },
        } as any);
      } catch (e) { console.error("Case creation error:", e); }
      toast.success(`Complaint filed! Code: ${code}`);
      setDialogOpen(false);
      resetForm();
      fetchComplaints();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <AlertTriangle className="h-7 w-7 text-warning" /> Complaints
          </h1>
          <p className="text-muted-foreground mt-1">File and track complaints with Rent Control</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> File Complaint
        </Button>
      </div>

      {/* Appointment scheduling cards */}
      <AppointmentSlotPicker complaintTable="landlord_complaints" userIdColumn="landlord_user_id" />

      {complaints.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No complaints filed</h3>
          <p className="text-sm text-muted-foreground mt-1">File a complaint if you have an issue to report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-5 border border-border shadow-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-primary">{c.complaint_code}</span>
                    <span className="text-sm text-muted-foreground">{c.complaint_type}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {c.property_address}, {c.region} • {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={`${statusConfig[c.status] || ""} text-xs`}>{c.status.replace("_", " ")}</Badge>
              </div>
              <p className="text-sm text-foreground">{c.description}</p>

              {/* Pay Now CTA when admin has requested payment */}
              {c.status === "pending_payment" && c.payment_status === "pending" && Number(c.outstanding_amount) > 0 && (
                <div className="bg-warning/5 border border-warning/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CreditCard className="h-4 w-4 text-warning" /> Filing fee requested
                      </div>
                      <div className="text-sm text-muted-foreground mt-0.5">
                        An officer has set the fee for this complaint. Pay to proceed to scheduling.
                      </div>
                    </div>
                    <Button onClick={() => handlePayNow(c)} disabled={paying === c.id}>
                      {paying === c.id ? "Processing..." : "Pay Now"}
                    </Button>
                  </div>

                  {basketMap[c.id]?.length > 0 && (
                    <div className="bg-background border border-border rounded-md divide-y divide-border">
                      {basketMap[c.id].map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-foreground truncate">{it.label}</span>
                            {it.kind === "manual_adjustment" && (
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning shrink-0">Manual</span>
                            )}
                          </div>
                          <span className="font-medium text-foreground tabular-nums">GH₵ {Number(it.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-warning/30 pt-2">
                    <span className="text-sm font-semibold text-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground">GH₵ {Number(c.outstanding_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {c.payment_status === "paid" && (
                <div className="bg-success/5 border border-success/20 rounded-lg p-3 flex items-center gap-2 text-sm">
                  <Receipt className="h-4 w-4 text-success" />
                  <span className="text-foreground"><strong>Filing fee paid.</strong> Your complaint is ready for scheduling.</span>
                </div>
              )}
              {/* Appointment info */}
              {scheduleMap[c.id] && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" /> Appointment
                  </div>
                  {scheduleMap[c.id].status === "confirmed" && scheduleMap[c.id].selected_slot ? (
                    <div className="text-sm mt-1">
                      <span className="font-medium text-foreground">
                        {new Date(scheduleMap[c.id].selected_slot.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </span>{" "}
                      <span className="text-muted-foreground">{scheduleMap[c.id].selected_slot.time_start} — {scheduleMap[c.id].selected_slot.time_end}</span>
                      <span className="ml-2 text-xs font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">Confirmed</span>
                    </div>
                  ) : (
                    <div className="text-sm mt-1 text-warning font-medium">Awaiting your slot selection (check above)</div>
                  )}
                </div>
              )}
              {c.evidence_urls?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {c.evidence_urls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Doc ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Complaint Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" /> File a Complaint
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Complaint Type *</Label>
              <Select value={complaintType} onValueChange={setComplaintType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {complaintTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tenant Name (if applicable)</Label>
              <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="Name of tenant involved" />
            </div>
            <div className="space-y-2">
              <Label>Property Address *</Label>
              <Input value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)} placeholder="Address of affected property" />
            </div>
            <div className="space-y-2">
              <Label>Region *</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>{regions.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue in detail..."
                className="min-h-[100px]"
              />
            </div>
            {/* Voice Note */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" /> Voice Note (optional)</Label>
              <p className="text-xs text-muted-foreground">Can't type? Record a voice note describing your issue.</p>
              {!audioUrl ? (
                <Button
                  type="button"
                  variant={isRecording ? "destructive" : "outline"}
                  size="sm"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="gap-2"
                >
                  {isRecording ? <><Square className="h-4 w-4" /> Stop Recording</> : <><Mic className="h-4 w-4" /> Start Recording</>}
                </Button>
              ) : (
                <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                  <audio src={audioUrl} controls className="h-8 flex-1" />
                  <Button type="button" variant="ghost" size="icon" onClick={deleteRecording} className="h-8 w-8 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Image className="h-3.5 w-3.5" /> Supporting Documents (up to 6)</Label>
              <input type="file" accept="image/*,.pdf" multiple onChange={handleDocChange} className="text-sm" />
              {documents.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {documents.map((f, i) => (
                    <div key={i} className="relative">
                      <Badge variant="secondary" className="text-xs pr-5">{f.name.slice(0, 15)}</Badge>
                      <button onClick={() => setDocuments(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !complaintType || !propertyAddress.trim() || !region || !description.trim()}
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Submit Complaint
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandlordComplaints;

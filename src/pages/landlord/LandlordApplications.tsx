import { useState, useEffect, useRef } from "react";
import { ClipboardList, Plus, Loader2, Mic, MicOff, Upload, X, Image, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
import { useFeeConfig } from "@/hooks/useFeatureFlag";

const applicationTypes = [
  { value: "rent_increase", label: "Rent Increase Request" },
  { value: "tenant_ejection", label: "Tenant Ejection Request" },
  { value: "regulatory_request", label: "Regulatory Request" },
  { value: "archive_search", label: "Archive Search" },
  { value: "other", label: "Other" },
];

const statusConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-warning/10 text-warning", icon: <Clock className="h-3 w-3" /> },
  under_review: { color: "bg-info/10 text-info", icon: <Clock className="h-3 w-3" /> },
  approved: { color: "bg-success/10 text-success", icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected: { color: "bg-destructive/10 text-destructive", icon: <XCircle className="h-3 w-3" /> },
};

const LandlordApplications = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [appType, setAppType] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchApplications();
  }, [user]);

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("landlord_applications")
      .select("*")
      .eq("landlord_user_id", user!.id)
      .order("created_at", { ascending: false });
    setApplications(data || []);
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setImages(prev => [...prev, ...Array.from(e.target.files!)].slice(0, 6));
    }
  };

  const resetForm = () => {
    setAppType(""); setSubject(""); setDescription("");
    setImages([]); setAudioBlob(null);
  };

  const { amount: archiveFee, enabled: archiveFeeEnabled } = useFeeConfig("archive_search_fee");

  const handleSubmit = async () => {
    if (!user) return;

    // Archive search paywall
    if (appType === "archive_search" && archiveFeeEnabled && archiveFee > 0) {
      setSubmitting(true);
      try {
        // Save form data to sessionStorage for post-payment restoration
        sessionStorage.setItem("archive_search_form", JSON.stringify({ subject, description }));

        const { data, error } = await supabase.functions.invoke("paystack-checkout", {
          body: {
            type: "archive_search_fee",
            userId: user.id,
            email: user.email,
            callbackUrl: window.location.href,
          },
        });
        if (error) throw error;
        if (data?.status === "skipped") {
          // Fee is 0 or disabled, proceed directly
        } else if (data?.authorization_url) {
          window.location.href = data.authorization_url;
          return;
        }
      } catch (err: any) {
        toast.error(err.message || "Payment initiation failed");
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(true);
    try {
      // Upload images
      const evidenceUrls: string[] = [];
      for (const file of images) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("application-evidence").upload(path, file);
        if (error) { console.error(error); continue; }
        const { data: { publicUrl } } = supabase.storage.from("application-evidence").getPublicUrl(path);
        evidenceUrls.push(publicUrl);
      }

      // Upload audio
      let audioUrl: string | null = null;
      if (audioBlob) {
        const path = `${user.id}/${Date.now()}_voice.webm`;
        const { error } = await supabase.storage.from("application-evidence").upload(path, audioBlob);
        if (!error) {
          const { data: { publicUrl } } = supabase.storage.from("application-evidence").getPublicUrl(path);
          audioUrl = publicUrl;
        }
      }

      const { error } = await supabase.from("landlord_applications").insert({
        landlord_user_id: user.id,
        application_type: appType,
        subject,
        description,
        evidence_urls: evidenceUrls,
        audio_url: audioUrl,
      } as any);

      if (error) throw error;
      toast.success("Application submitted successfully");
      setDialogOpen(false);
      resetForm();
      fetchApplications();
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
            <ClipboardList className="h-7 w-7 text-primary" /> Applications
          </h1>
          <p className="text-muted-foreground mt-1">Submit requests to Rent Control for review</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> New Application
        </Button>
      </div>

      {applications.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No applications yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Submit your first application to Rent Control.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const sc = statusConfig[app.status] || statusConfig.pending;
            return (
              <div key={app.id} className="bg-card rounded-xl p-5 border border-border shadow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-card-foreground">{app.subject}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {applicationTypes.find(t => t.value === app.application_type)?.label || app.application_type}
                      {" • "}{new Date(app.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={`${sc.color} gap-1`}>{sc.icon}{app.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-sm text-foreground">{app.description}</p>
                {app.evidence_urls?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {app.evidence_urls.map((url: string, i: number) => (
                      <img key={i} src={url} alt={`Evidence ${i + 1}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                    ))}
                  </div>
                )}
                {app.audio_url && (
                  <audio controls src={app.audio_url} className="w-full h-8" />
                )}
                {app.reviewer_notes && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <span className="text-muted-foreground font-medium">Reviewer Notes: </span>
                    <span className="text-foreground">{app.reviewer_notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Application Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" /> New Application
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Application Type *</Label>
              <Select value={appType} onValueChange={setAppType}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {applicationTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief subject line" />
            </div>
            <div className="space-y-2">
              <Label>Description / Reason *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your request in detail, including reasons and any relevant context..."
                className="min-h-[100px]"
              />
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Image className="h-3.5 w-3.5" /> Evidence Images (up to 6)</Label>
              <input type="file" accept="image/*" multiple onChange={handleImageChange} className="text-sm" />
              {images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {images.map((img, i) => (
                    <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Voice recording */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mic className="h-3.5 w-3.5" /> Voice Message (optional)</Label>
              <p className="text-xs text-muted-foreground">Record a voice message if you prefer to explain verbally</p>
              <div className="flex items-center gap-3">
                {!recording ? (
                  <Button type="button" variant="outline" size="sm" onClick={startRecording}>
                    <Mic className="h-4 w-4 mr-1" /> Start Recording
                  </Button>
                ) : (
                  <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
                    <MicOff className="h-4 w-4 mr-1 animate-pulse" /> Stop Recording
                  </Button>
                )}
                {audioBlob && !recording && (
                  <div className="flex items-center gap-2 flex-1">
                    <audio controls src={URL.createObjectURL(audioBlob)} className="h-8 flex-1" />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setAudioBlob(null)} className="h-6 w-6">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || !appType || !subject.trim() || !description.trim()}
              className="w-full"
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
              Submit Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LandlordApplications;

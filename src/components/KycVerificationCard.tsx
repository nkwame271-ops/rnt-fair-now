import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, Upload, Loader2, CheckCircle2, XCircle, Clock, IdCard, AlertTriangle } from "lucide-react";

const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;

type KycRecord = {
  id: string;
  status: string;
  ghana_card_number: string;
  ghana_card_front_url: string | null;
  ghana_card_back_url: string | null;
  selfie_url: string | null;
  ai_match_result: string | null;
  reviewer_notes: string | null;
};

const KycVerificationCard = () => {
  const { user } = useAuth();
  const [kyc, setKyc] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [ghanaCardNumber, setGhanaCardNumber] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setKyc(data as KycRecord);
        setGhanaCardNumber(data.ghana_card_number || "");
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const startCamera = useCallback(async () => {
    try {
      setCameraReady(false);
      setCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      streamRef.current = stream;
      // Wait for ref to be available after setCameraOpen triggers re-render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      toast.error("Unable to access camera. Please allow camera permissions.");
      setCameraOpen(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
    setCameraReady(false);
  }, []);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) {
      toast.error("Camera not ready yet. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (blob) {
        setSelfieBlob(blob);
        setSelfiePreview(URL.createObjectURL(blob));
        stopCamera();
      } else {
        toast.error("Failed to capture image. Please try again.");
      }
    }, "image/jpeg", 0.85);
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const uploadFile = async (file: File | Blob, path: string) => {
    const { error } = await supabase.storage.from("identity-documents").upload(path, file, { upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    return path; // Return the storage path, not a public URL
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!GHANA_CARD_REGEX.test(ghanaCardNumber)) {
      toast.error("Invalid Ghana Card format. Use: GHA-XXXXXXXXX-X");
      return;
    }
    if (!frontFile) { toast.error("Please upload Ghana Card front image"); return; }
    if (!backFile) { toast.error("Please upload Ghana Card back image"); return; }
    if (!selfieBlob) { toast.error("Please take a live selfie"); return; }

    setSubmitting(true);
    try {
      const ts = Date.now();
      const frontPath = await uploadFile(frontFile, `${user.id}/ghana-card-front-${ts}.jpg`);
      const backPath = await uploadFile(backFile, `${user.id}/ghana-card-back-${ts}.jpg`);
      const selfiePath = await uploadFile(selfieBlob, `${user.id}/selfie-${ts}.jpg`);

      // AI face matching - pass file paths, edge function generates signed URLs
      let aiResult = { match_score: 0, match_result: "pending" };
      try {
        const { data } = await supabase.functions.invoke("kyc-face-match", {
          body: { ghanaCardFrontPath: frontPath, selfiePath },
        });
        if (data?.match_score !== undefined) {
          aiResult = data;
        }
      } catch {
        console.warn("AI face matching unavailable, proceeding with manual review");
      }

      // Store file paths (not public URLs) since bucket is private
      if (kyc) {
        await supabase.from("kyc_verifications").update({
          ghana_card_number: ghanaCardNumber,
          ghana_card_front_url: frontPath,
          ghana_card_back_url: backPath,
          selfie_url: selfiePath,
          status: "pending",
          ai_match_score: aiResult.match_score,
          ai_match_result: aiResult.match_result,
        }).eq("id", kyc.id);
      } else {
        await supabase.from("kyc_verifications").insert({
          user_id: user.id,
          ghana_card_number: ghanaCardNumber,
          ghana_card_front_url: frontPath,
          ghana_card_back_url: backPath,
          selfie_url: selfiePath,
          status: "pending",
          ai_match_score: aiResult.match_score,
          ai_match_result: aiResult.match_result,
        });
      }

      toast.success("KYC documents submitted for verification!");
      const { data: updated } = await supabase.from("kyc_verifications").select("*").eq("user_id", user.id).maybeSingle();
      setKyc(updated as KycRecord);
    } catch (err: any) {
      toast.error(err.message || "Failed to submit KYC documents");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card><CardContent className="p-6 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;

  const statusBadge = () => {
    switch (kyc?.status) {
      case "verified": return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case "pending": return <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" />Pending Verification</Badge>;
      default: return <Badge variant="outline"><AlertTriangle className="h-3 w-3 mr-1" />Not Submitted</Badge>;
    }
  };

  if (kyc?.status === "verified") {
    return (
      <Card className="border-success/30 bg-success/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Ghana Card Verified</h3>
              <p className="text-sm text-muted-foreground">{kyc.ghana_card_number} · Your identity has been verified</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (kyc?.status === "pending") {
    return (
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Verification Pending</h3>
              <p className="text-sm text-muted-foreground">Your Ghana Card ({kyc.ghana_card_number}) is being reviewed. This typically takes 1-2 business days.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={kyc?.status === "rejected" ? "border-destructive/30" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <IdCard className="h-5 w-5 text-primary" /> Ghana Card Verification
            </CardTitle>
            <CardDescription>
              {kyc?.status === "rejected"
                ? "Your previous submission was rejected. Please resubmit."
                : "Verify your identity to unlock all platform features"}
            </CardDescription>
          </div>
          {statusBadge()}
        </div>
        {kyc?.status === "rejected" && kyc.reviewer_notes && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mt-2">
            <strong>Reason:</strong> {kyc.reviewer_notes}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Ghana Card Number */}
        <div className="space-y-2">
          <Label>Ghana Card Number</Label>
          <Input
            value={ghanaCardNumber}
            onChange={(e) => setGhanaCardNumber(e.target.value.toUpperCase())}
            placeholder="GHA-XXXXXXXXX-X"
            maxLength={15}
          />
          {ghanaCardNumber && !GHANA_CARD_REGEX.test(ghanaCardNumber) && (
            <p className="text-xs text-destructive">Format: GHA-XXXXXXXXX-X (e.g., GHA-123456789-0)</p>
          )}
        </div>

        {/* Front & Back uploads */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Ghana Card Front</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">{frontFile ? frontFile.name : "Click to upload"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFrontFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="space-y-2">
            <Label>Ghana Card Back</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">{backFile ? backFile.name : "Click to upload"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setBackFile(e.target.files?.[0] || null)} />
            </label>
          </div>
        </div>

        {/* Selfie */}
        <div className="space-y-2">
          <Label>Live Selfie</Label>
          {selfiePreview ? (
            <div className="relative w-40">
              <img src={selfiePreview} alt="Selfie" className="w-40 h-40 object-cover rounded-lg border border-border" />
              <Button variant="destructive" size="sm" className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full" onClick={() => { setSelfieBlob(null); setSelfiePreview(null); }}>
                <XCircle className="h-3 w-3" />
              </Button>
            </div>
          ) : cameraOpen ? (
            <div className="space-y-2">
              <div className="relative">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  onPlaying={() => setCameraReady(true)}
                  className="w-full max-w-sm rounded-lg border border-border" 
                />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/80 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Camera loading...
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={captureSelfie} size="sm" disabled={!cameraReady}>
                  <Camera className="h-4 w-4 mr-1" />Capture
                </Button>
                <Button onClick={stopCamera} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={startCamera} variant="outline" size="sm">
              <Camera className="h-4 w-4 mr-1" /> Open Camera & Take Selfie
            </Button>
          )}
        </div>

        <Button onClick={handleSubmit} disabled={submitting} className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <IdCard className="h-4 w-4 mr-2" />}
          {submitting ? "Submitting..." : "Submit for Verification"}
        </Button>
      </CardContent>
    </Card>
  );
};

export default KycVerificationCard;

import { useState } from "react";
import { Shield, Fingerprint, MessageSquare, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancyId: string;
  onSigned: () => void;
}

const DigitalSignatureDialog = ({ open, onOpenChange, tenancyId, onSigned }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState<"choose" | "otp_send" | "otp_verify" | "signing" | "done">("choose");
  const [otpCode, setOtpCode] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSendOtp = async () => {
    if (!user) return;
    setSending(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("phone").eq("user_id", user.id).single();
      const p = profile?.phone || "";
      setPhone(p);
      const { data, error } = await supabase.functions.invoke("send-otp", { body: { phone: p } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setStep("otp_verify");
      toast.success("OTP sent to your phone");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyAndSign = async () => {
    if (!user || !otpCode || otpCode.length < 6) return;
    setVerifying(true);
    try {
      // Verify OTP
      const { data: otpResult, error: otpError } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otpCode },
      });
      if (otpError) throw otpError;
      if (!otpResult?.verified) throw new Error(otpResult?.error || "Invalid OTP");

      setStep("signing");

      // Record signature
      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
      };

      await supabase.from("tenancy_signatures").insert({
        tenancy_id: tenancyId,
        signer_user_id: user.id,
        signer_role: "tenant",
        signature_method: "otp",
        device_info: deviceInfo,
        signed_at: new Date().toISOString(),
        signature_hash: btoa(`${tenancyId}:${user.id}:${Date.now()}`),
      } as any);

      // Update tenancy
      await supabase.from("tenancies").update({
        tenant_signed_at: new Date().toISOString(),
        agreement_version: 2,
        execution_timestamp: new Date().toISOString(),
        status: "active",
        tenant_accepted: true,
      }).eq("id", tenancyId);

      setStep("done");
      toast.success("Agreement signed successfully!");
      setTimeout(() => {
        onOpenChange(false);
        onSigned();
      }, 1500);
    } catch (err: any) {
      toast.error(err.message || "Signing failed");
      setStep("otp_verify");
    } finally {
      setVerifying(false);
    }
  };

  const handlePasskeySign = async () => {
    if (!user) return;
    // Check if WebAuthn is available
    if (!window.PublicKeyCredential) {
      toast.error("Passkey not supported on this device. Using OTP instead.");
      setStep("otp_send");
      return;
    }

    setStep("signing");
    try {
      // Create a simple challenge for signing
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const credential = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "RentControlGhana", id: window.location.hostname },
          user: {
            id: new TextEncoder().encode(user.id),
            name: user.email || "tenant",
            displayName: "Tenant Signature",
          },
          pubKeyCredParams: [{ alg: -7, type: "public-key" }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 60000,
        },
      });

      if (!credential) throw new Error("Passkey authentication cancelled");

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        method: "passkey",
      };

      await supabase.from("tenancy_signatures").insert({
        tenancy_id: tenancyId,
        signer_user_id: user.id,
        signer_role: "tenant",
        signature_method: "passkey",
        device_info: deviceInfo,
        signed_at: new Date().toISOString(),
        signature_hash: btoa(`${tenancyId}:${user.id}:passkey:${Date.now()}`),
      } as any);

      await supabase.from("tenancies").update({
        tenant_signed_at: new Date().toISOString(),
        agreement_version: 2,
        execution_timestamp: new Date().toISOString(),
        status: "active",
        tenant_accepted: true,
      }).eq("id", tenancyId);

      setStep("done");
      toast.success("Agreement signed with passkey!");
      setTimeout(() => {
        onOpenChange(false);
        onSigned();
      }, 1500);
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.message?.includes("cancelled")) {
        toast.info("Passkey cancelled. You can use OTP instead.");
        setStep("choose");
      } else {
        toast.error("Passkey failed. Try OTP instead.");
        setStep("choose");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStep("choose"); setOtpCode(""); } onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Digital Signature
          </DialogTitle>
        </DialogHeader>

        {step === "choose" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verify your identity to digitally sign this agreement. Choose your preferred method:
            </p>
            <Button onClick={handlePasskeySign} className="w-full justify-start gap-3 h-14" variant="outline">
              <Fingerprint className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-foreground">Passkey (Biometric)</div>
                <div className="text-xs text-muted-foreground">Fingerprint, Face ID, or device PIN</div>
              </div>
            </Button>
            <Button onClick={() => setStep("otp_send")} className="w-full justify-start gap-3 h-14" variant="outline">
              <MessageSquare className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-foreground">OTP Verification</div>
                <div className="text-xs text-muted-foreground">Receive a code via SMS</div>
              </div>
            </Button>
          </div>
        )}

        {step === "otp_send" && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">We'll send a 6-digit code to your registered phone number.</p>
            <Button onClick={handleSendOtp} disabled={sending} className="w-full">
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              {sending ? "Sending..." : "Send OTP"}
            </Button>
          </div>
        )}

        {step === "otp_verify" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">Enter the 6-digit code sent to your phone.</p>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleVerifyAndSign} disabled={verifying || otpCode.length < 6} className="w-full">
              {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
              {verifying ? "Verifying & Signing..." : "Verify & Sign Agreement"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSendOtp} disabled={sending} className="w-full text-xs">
              Resend OTP
            </Button>
          </div>
        )}

        {step === "signing" && (
          <div className="py-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Recording your digital signature...</p>
          </div>
        )}

        {step === "done" && (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <h3 className="font-bold text-foreground">Agreement Signed!</h3>
            <p className="text-sm text-muted-foreground">Your digital signature has been recorded securely.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DigitalSignatureDialog;

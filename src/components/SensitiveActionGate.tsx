import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, KeyRound, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
  /** Called once the user has passed password + OTP verification. */
  onVerified: () => Promise<void> | void;
}

/**
 * Two-step gate for sensitive account/payment mutations:
 *   1. Re-enter account password (verified via supabase.auth signInWithPassword).
 *   2. OTP delivered to the verified phone on the user's profile.
 */
const SensitiveActionGate = ({
  open,
  onOpenChange,
  title = "Confirm sensitive change",
  description = "For your security, confirm your password and a one-time code sent to your verified phone.",
  actionLabel = "Confirm",
  onVerified,
}: Props) => {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("password");
    setPassword("");
    setOtp("");
    setError("");
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      setEmail(auth.user.email ?? null);
      const { data: prof } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      setPhone((prof as any)?.phone ?? null);
    })();
  }, [open]);

  const verifyPassword = async () => {
    if (!password.trim()) return setError("Enter your password");
    if (!email) return setError("Session expired. Please sign in again.");
    setError("");
    setLoading(true);
    const { error: signErr } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signErr) {
      setError("Incorrect password");
      return;
    }
    if (!phone) {
      setError("No verified phone on file. Add a phone number to your profile first.");
      return;
    }
    await sendCode();
    setStep("otp");
  };

  const sendCode = async () => {
    if (!phone) return;
    setSending(true);
    try {
      const { error: sendErr } = await supabase.functions.invoke("send-otp", { body: { phone } });
      if (sendErr) throw sendErr;
      toast.success("Code sent to your phone");
    } catch (e: any) {
      toast.error(e.message || "Failed to send code");
    } finally {
      setSending(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || !phone) return setError("Enter the code");
    setError("");
    setLoading(true);
    try {
      const { data, error: verErr } = await supabase.functions.invoke("verify-otp", {
        body: { phone, code: otp.trim() },
      });
      if (verErr) throw verErr;
      if (!(data as any)?.verified) throw new Error((data as any)?.error || "Invalid code");
      await onVerified();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone ? phone.replace(/(\d{3})(\d{3})(\d+)/, "$1***$3") : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "password" ? (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Account password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> One-time code</Label>
              <Input
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-digit code"
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
              />
              <p className="text-xs text-muted-foreground">
                Sent to {maskedPhone || "your verified phone"}.{" "}
                <button type="button" onClick={sendCode} disabled={sending} className="text-primary underline disabled:opacity-50">
                  {sending ? "Sending..." : "Resend"}
                </button>
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          {step === "password" ? (
            <Button onClick={verifyPassword} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
            </Button>
          ) : (
            <Button onClick={verifyOtp} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : actionLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SensitiveActionGate;

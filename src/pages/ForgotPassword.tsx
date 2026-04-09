import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Lock, KeyRound, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/formatters";

const COOLDOWN_SECONDS = 60;

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your phone number or Tenant/Landlord ID");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("lookup-phone", {
        body: { identifier: identifier.trim() },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Could not find an account with that identifier");
        setLoading(false);
        return;
      }

      setMaskedPhone(data.phone_masked);
      setNormalizedPhone(data.phone_normalized);

      // Send OTP and verify it was actually delivered
      const { data: otpData, error: otpError } = await supabase.functions.invoke("send-otp", {
        body: { phone: data.phone_normalized },
      });

      if (otpError || otpData?.error) {
        toast.error(otpData?.error || "Failed to send OTP. Please try again.");
        setLoading(false);
        return;
      }

      if (otpData?.smsSent === false) {
        console.warn("send-otp returned smsSent=false", otpData);
        toast.error("OTP could not be sent to your phone. Please try again later.");
        setLoading(false);
        return;
      }

      setCooldown(COOLDOWN_SECONDS);
      setStep(2);
      toast.success(`OTP sent to ${data.phone_masked}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      toast.error("Please enter the full 6-digit code");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone: normalizedPhone, code: otp },
      });

      if (error || data?.error || !data?.verified) {
        const reason = data?.error || error?.message || "Invalid or expired OTP. Please try again.";
        console.warn("verify-otp failed:", { error, data });
        toast.error(reason);
        setLoading(false);
        return;
      }

      setStep(3);
      toast.success("Phone verified! Set your new password.");
    } catch {
      toast.error("Verification failed. Please try again.");
    }
    setLoading(false);
  };

  const handleResendOtp = useCallback(async () => {
    if (cooldown > 0) return;
    setCooldown(COOLDOWN_SECONDS);
    await supabase.functions.invoke("send-otp", {
      body: { phone: normalizedPhone },
    });
    toast.success(`OTP resent to ${maskedPhone}`);
  }, [cooldown, normalizedPhone, maskedPhone]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password-otp", {
        body: { phone: normalizedPhone, new_password: password },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Failed to reset password. Please try again.");
        setLoading(false);
        return;
      }

      toast.success("Password reset successfully! You can now sign in.");
      navigate("/login");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <button onClick={() => (step === 1 ? navigate("/login") : setStep((s) => (s - 1) as 1 | 2 | 3))} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{step === 1 ? "Back to Login" : "Back"}</span>
        </button>

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <KeyRound className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Reset Password</h1>
          </div>

          {/* Step indicator */}
          <div className="flex gap-2 mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
        </div>

        {/* Step 1: Identify */}
        {step === 1 && (
          <motion.form key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleLookup} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your registered phone number or your Tenant/Landlord ID to find your account.
            </p>
            <div className="space-y-2">
              <Label>Phone Number or ID</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <Input
                   placeholder="024 555 1234 or TN-2026-XXXX"
                  className="pl-10"
                  value={identifier}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Auto-format if it looks like a phone number
                    if (/^[0-9\s]+$/.test(val) && !val.startsWith("T") && !val.startsWith("L")) {
                      setIdentifier(formatPhone(val));
                    } else {
                      setIdentifier(val);
                    }
                  }}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">e.g. 024 555 1234, TN-2026-AB1234, or LL-2026-CD5678</p>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? "Looking up..." : "Find My Account"}
            </Button>
          </motion.form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="bg-muted rounded-xl p-4 border border-border">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">OTP Sent</span>
              </div>
              <p className="text-xs text-muted-foreground">
                A 6-digit verification code has been sent to <strong>{maskedPhone}</strong>
              </p>
            </div>

            <div className="space-y-2">
              <Label>Enter Verification Code</Label>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading || otp.length !== 6}>
              {loading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={cooldown > 0}
                className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </button>
            </div>

            <button type="button" onClick={() => setShowFallback(!showFallback)} className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
              Can't access this phone number?
            </button>

            {showFallback && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="bg-muted rounded-xl p-4 border border-border">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Manual Verification Required</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      If you no longer have access to your registered phone number, please visit your nearest Rent Control Department office with a valid ID to reset your password.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.form>
        )}

        {/* Step 3: New Password */}
        {step === 3 && (
          <motion.form key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleResetPassword} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Phone verified! Create a new password for your account.
            </p>

            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="Minimum 8 characters" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="Re-enter your password" className="pl-10" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </motion.form>
        )}
      </motion.div>
    </div>
  );
};

export default ForgotPassword;

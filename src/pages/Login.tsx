import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type LoginMode = "password" | "otp";
type OtpStep = "email" | "verify";

const Login = () => {
  const [searchParams] = useSearchParams();
  const role = searchParams.get("role") || "tenant";
  const navigate = useNavigate();

  const [mode, setMode] = useState<LoginMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  // OTP state
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  const navigateByRole = async (userId: string) => {
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    const userRole = roleData?.role;
    if (userRole === "tenant") navigate("/tenant/dashboard");
    else if (userRole === "landlord") navigate("/landlord/dashboard");
    else if (userRole === "regulator") navigate("/regulator/dashboard");
    else navigate("/");

    toast.success("Welcome back!");
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    await navigateByRole(data.user.id);
    setLoading(false);
  };

  const handleSendOtp = async () => {
    if (!otpEmail.trim()) { toast.error("Please enter your email"); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: otpEmail });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification code sent to your email!");
      setOtpStep("verify");
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) { toast.error("Please enter the full 6-digit code"); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email: otpEmail,
      token: otpCode,
      type: "email",
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      await navigateByRole(data.user.id);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12 relative">
        <div className="text-primary-foreground max-w-md">
          <Shield className="h-12 w-12 text-secondary mb-6" />
          <h2 className="text-3xl font-bold mb-4">
            {role === "tenant" ? "Know Your Rights" : "Stay Compliant"}
          </h2>
          <p className="text-primary-foreground/80 text-lg">
            {role === "tenant"
              ? "Access fair rent prices, file complaints, and get legal guidance — all in one place."
              : "Register properties, manage tenants, and ensure all agreements meet legal requirements."}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="mb-6">
            <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-3 capitalize">
              {role}
            </div>
            <h1 className="text-3xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-muted-foreground mt-1">Sign in to your account</p>
          </div>

          {/* Mode toggle */}
          <div className="flex bg-muted rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode("password"); setOtpStep("email"); setOtpCode(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${mode === "password" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Lock className="h-3.5 w-3.5" /> Password
            </button>
            <button
              onClick={() => { setMode("otp"); setShowForgot(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${mode === "otp" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <KeyRound className="h-3.5 w-3.5" /> Email OTP
            </button>
          </div>

          {/* PASSWORD MODE */}
          {mode === "password" && (
            <>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="kwame@example.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Password</Label>
                    <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                </div>
                <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </form>

              {showForgot && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 bg-muted rounded-xl p-4 border border-border space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Reset Password</h3>
                  <p className="text-xs text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" placeholder="kwame@example.com" className="pl-10" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowForgot(false)}>Cancel</Button>
                    <Button size="sm" disabled={resetLoading} onClick={async () => {
                      if (!resetEmail.trim()) { toast.error("Enter your email"); return; }
                      setResetLoading(true);
                      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                        redirectTo: `${window.location.origin}/reset-password`,
                      });
                      setResetLoading(false);
                      if (error) { toast.error(error.message); }
                      else { toast.success("Reset link sent! Check your email."); setShowForgot(false); }
                    }}>{resetLoading ? "Sending..." : "Send Reset Link"}</Button>
                  </div>
                </motion.div>
              )}
            </>
          )}

          {/* OTP MODE */}
          {mode === "otp" && otpStep === "email" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">We'll send a 6-digit verification code to your email.</p>
              <div className="space-y-2">
                <Label>Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="kwame@example.com"
                    className="pl-10"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSendOtp(); }}
                  />
                </div>
              </div>
              <Button onClick={handleSendOtp} className="w-full h-12 text-base font-semibold" disabled={loading}>
                {loading ? "Sending code..." : "Send Verification Code"}
              </Button>
            </div>
          )}

          {mode === "otp" && otpStep === "verify" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="text-center space-y-1">
                <KeyRound className="h-8 w-8 text-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to</p>
                <p className="text-sm font-semibold text-foreground">{otpEmail}</p>
              </div>

              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
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

              <Button onClick={handleVerifyOtp} className="w-full h-12 text-base font-semibold" disabled={loading || otpCode.length < 6}>
                {loading ? "Verifying..." : "Verify & Sign In"}
              </Button>

              <div className="flex items-center justify-between text-xs">
                <button onClick={() => { setOtpStep("email"); setOtpCode(""); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  ← Change email
                </button>
                <button onClick={handleSendOtp} disabled={loading} className="text-primary hover:underline">
                  Resend code
                </button>
              </div>
            </motion.div>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <button onClick={() => navigate(`/register/${role}`)} className="text-primary font-semibold hover:underline">
              Register
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;

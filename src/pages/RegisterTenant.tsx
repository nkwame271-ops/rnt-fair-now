import { useState } from "react";
import { useFeeConfig, useFeatureFlag } from "@/hooks/useFeatureFlag";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Shield, User, Phone, Mail, MapPin, CheckCircle2, ArrowLeft, ArrowRight, IdCard, Briefcase, UserPlus, Lock, Globe, Eye, EyeOff, Loader2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/lib/notificationService";
import FormField from "@/components/FormField";
import { formatPhone, isValidPhone } from "@/lib/formatters";
import { regions } from "@/data/staticData";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Switch } from "@/components/ui/switch";
import InstitutionCombobox from "@/components/InstitutionCombobox";
import { normalizeInstitutionName } from "@/data/ghanaInstitutions";

const steps = ["Account", "Contact", "Your ID"];

const RegisterTenant = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const studentMode = searchParams.get("student") === "1";
  const { amount: regFee, enabled: regFeeEnabled } = useFeeConfig("tenant_registration_fee");
  const { enabled: otpEnabled } = useFeatureFlag("phone_otp_verification");
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [region, setRegion] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [occupation, setOccupation] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [generatedId, setGeneratedId] = useState("");

  // Student fields — auto-enabled when arriving via student card
  const [isStudent, setIsStudent] = useState(studentMode);
  const [school, setSchool] = useState("");
  const [hostelOrHall, setHostelOrHall] = useState("");
  const [roomOrBedSpace, setRoomOrBedSpace] = useState("");
  const [payingRegistration, setPayingRegistration] = useState(false);

  // Citizenship
  const [isCitizen, setIsCitizen] = useState(true);
  const [nationality, setNationality] = useState("");
  const [residencePermitNo, setResidencePermitNo] = useState("");

  // OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const handleSendOtp = async () => {
    setSendingOtp(true);
    try {
      const phoneDigits = phone.replace(/\s/g, "");
      const { data, error } = await supabase.functions.invoke("send-otp", { body: { phone: phoneDigits } });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      toast.success("Verification code sent to your phone!");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setVerifyingOtp(true);
    try {
      const phoneDigits = phone.replace(/\s/g, "");
      const { data, error } = await supabase.functions.invoke("verify-otp", { body: { phone: phoneDigits, code } });
      if (error) throw new Error(error.message);
      if (data?.verified) {
        setPhoneVerified(true);
        toast.success("Phone number verified!");
      } else {
        toast.error(data?.error || "Invalid code");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handlePayRegistration = async () => {
    if (!regFeeEnabled) {
      navigate("/login?role=tenant");
      return;
    }
    setPayingRegistration(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "tenant_registration" },
      });
      if (error) throw new Error(error.message || "Payment initiation failed");
      if (data?.error) throw new Error(data.error);
      if (data?.skipped) {
        toast.success("Registration fee waived! Please log in.");
        navigate("/login?role=tenant");
        return;
      }
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
      setPayingRegistration(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0: {
        const baseValid = fullName.length > 2 && isValidPhone(phone) && !!region && password.length >= 8 && password === confirmPassword;
        const citizenValid = isCitizen || (nationality.length > 1 && residencePermitNo.length > 2);
        const otpValid = !otpEnabled || phoneVerified;
        return baseValid && citizenValid && otpValid;
      }
      case 1: return true;
      default: return true;
    }
  };

  const handleNext = async () => {
    if (step < 1) { setStep(step + 1); return; }
    if (step === 1) { await handleCreateAccount(); return; }
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\s/g, "");
      const syntheticEmail = `${phoneDigits}@rentcontrolghana.local`;

      // Pre-check: deactivated account
      const { data: existingProfile } = await supabase.from("profiles").select("user_id").eq("phone", phoneDigits).maybeSingle();
      if (existingProfile) {
        const { data: tenantRecord } = await supabase.from("tenants").select("account_status").eq("user_id", existingProfile.user_id).maybeSingle();
        if (tenantRecord && tenantRecord.account_status === "deactivated") {
          toast.error("This phone number is linked to a deactivated account. Please contact Rent Control for assistance.");
          setLoading(false);
          return;
        }
      }

      // Pre-check: email uniqueness
      if (email && email.trim()) {
        const { data: emailMatch } = await supabase.from("profiles").select("id").eq("email", email.trim()).maybeSingle();
        if (emailMatch) {
          toast.error("This email is already in use by another account. Please use a different email or log in.");
          setLoading(false);
          return;
        }
      }

      let userId: string;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: syntheticEmail,
        password: password,
        options: {
          data: { full_name: fullName, phone: phoneDigits, role: "tenant" },
        },
      });

      if (authError) {
        if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
          toast.error("This phone number is already registered. Please log in or recover your account.", {
            action: { label: "Go to Login", onClick: () => navigate("/login?role=tenant") },
          });
          setLoading(false);
          return;
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error("Registration failed");
        userId = authData.user.id;
      }

      const tenantId = "TN-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

      const { error: profileError } = await supabase.from("profiles").update({
        email: email || null,
        delivery_region: region || null,
        occupation, work_address: workAddress,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone.replace(/\s/g, ""),
        is_citizen: isCitizen,
        nationality: isCitizen ? "Ghanaian" : nationality,
        residence_permit_no: isCitizen ? null : residencePermitNo,
        user_type: isStudent ? "student" : "tenant",
      } as any).eq("user_id", userId);

      if (profileError) {
        console.error("Profile update failed:", profileError);
        toast.error("Account created but profile update failed. Please update your profile after logging in.");
      }

      const now = new Date();
      const expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);

      const { error: tenantError } = await supabase.from("tenants").insert({
        user_id: userId,
        tenant_id: tenantId,
        registration_fee_paid: !regFeeEnabled,
        is_student: isStudent,
        school: isStudent ? (normalizeInstitutionName(school) || null) : null,
        hostel_or_hall: isStudent ? (hostelOrHall.trim() || null) : null,
        room_or_bed_space: isStudent ? (roomOrBedSpace.trim() || null) : null,
        ...(!regFeeEnabled ? {
          registration_date: now.toISOString(),
          expiry_date: expiryDate.toISOString(),
        } : {}),
      } as any);

      if (tenantError) {
        await supabase.auth.signOut();
        throw new Error("Failed to create tenant record. Please try registering again.");
      }

      setGeneratedId(tenantId);

      // Claim any pending tenancies linked to this phone number
      try {
        await supabase.functions.invoke("admin-action", {
          body: { action: "claim_pending_tenancy", phone: phoneDigits, new_user_id: userId },
        });
      } catch (claimErr) {
        console.warn("Pending tenancy claim attempt:", claimErr);
      }

      sendNotification("account_created", {
        phone: phoneDigits,
        email: email || undefined,
        user_id: userId,
        data: { name: fullName, role: "Tenant", id: tenantId, phone: phoneDigits },
      });

      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.round((Math.min(step, 2) / 2) * 100);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero items-center justify-center p-12 relative">
        <div className="text-primary-foreground max-w-sm">
          {studentMode ? <GraduationCap className="h-12 w-12 text-secondary mb-6" /> : <Shield className="h-12 w-12 text-secondary mb-6" />}
          <h2 className="text-3xl font-bold mb-4">{studentMode ? "Register as a Student" : "Register as a Tenant"}</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            {studentMode
              ? "Get your unique Student ID to access NUGS-supported hostel listings, file complaints, and manage your accommodation."
              : "Get your unique Tenant ID to access rent control services, file complaints, and manage your tenancy agreements."}
          </p>
          {regFeeEnabled && (
            <div className="bg-primary-foreground/10 rounded-xl p-5 backdrop-blur-sm border border-primary-foreground/20">
              <div className="flex items-center gap-3 mb-3">
                <IdCard className="h-5 w-5 text-secondary" />
                <span className="font-semibold">Annual Registration</span>
              </div>
              <div className="text-3xl font-extrabold text-secondary mb-1">GH₵ {regFee.toFixed(2)}</div>
              <p className="text-primary-foreground/70 text-sm mb-3">Per year</p>
              <div className="border-t border-primary-foreground/20 pt-3">
                <p className="text-sm font-semibold mb-2">Registration Fee Covers:</p>
                <ul className="space-y-1.5 text-sm text-primary-foreground/80">
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />{studentMode ? "Student ID card" : "Tenant ID card"}</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />12-month platform access</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col p-6 sm:p-10">
        <button
          onClick={() => step === 0 ? navigate("/") : setStep(step - 1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors self-start"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{step === 0 ? "Back to Home" : "Previous Step"}</span>
        </button>

        {/* Progress bar */}
        <div className="mb-2 max-w-lg">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Step {Math.min(step + 1, 2)} of 2</span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progressPercent}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
          </div>
        </div>

        {/* Step labels */}
        <div className="flex items-center gap-1 mb-6 max-w-lg overflow-x-auto">
          {steps.slice(0, 2).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < 1 && <div className={`h-px w-4 ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="max-w-lg flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>

              {/* Step 0: Account */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{studentMode ? "Create Your Student Account" : "Create Your Account"}</h1>
                    <p className="text-muted-foreground mt-1">Your name and phone number to get started</p>
                  </div>
                  <div className="space-y-4">
                    <FormField label="Full Name" valid={fullName.length > 2}>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kwame Mensah" className="pl-10" />
                      </div>
                    </FormField>

                    {/* Student section — toggle hidden when arriving via Student card */}
                    {studentMode ? (
                      <div className="border border-border rounded-lg p-4 space-y-3 bg-primary/5">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <p className="text-sm font-medium text-foreground">Student Details</p>
                        </div>
                        <div className="space-y-3">
                          <FormField label="School / Institution" valid={school.length > 1} hint="Pick from the list, or type your school's name if not listed.">
                            <InstitutionCombobox value={school} onChange={setSchool} placeholder="Select your university or college" />
                          </FormField>
                          <FormField label="Hostel or Hall" optional>
                            <Input value={hostelOrHall} onChange={(e) => setHostelOrHall(e.target.value)} placeholder="e.g. Commonwealth Hall" />
                          </FormField>
                          <FormField label="Room or Bed Space" optional>
                            <Input value={roomOrBedSpace} onChange={(e) => setRoomOrBedSpace(e.target.value)} placeholder="e.g. Room 12B" />
                          </FormField>
                        </div>
                      </div>
                    ) : (
                      <div className="border border-border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">I am a student</p>
                            <p className="text-xs text-muted-foreground">Enable to see hostel listings instead of regular rentals</p>
                          </div>
                          <Switch checked={isStudent} onCheckedChange={setIsStudent} />
                        </div>
                        {isStudent && (
                          <div className="space-y-3 pt-2 border-t border-border">
                            <FormField label="School / Institution" valid={school.length > 1} hint="Pick from the list, or type your school's name if not listed.">
                              <InstitutionCombobox value={school} onChange={setSchool} placeholder="Select your university or college" />
                            </FormField>
                            <FormField label="Hostel or Hall" optional>
                              <Input value={hostelOrHall} onChange={(e) => setHostelOrHall(e.target.value)} placeholder="e.g. Commonwealth Hall" />
                            </FormField>
                            <FormField label="Room or Bed Space" optional>
                              <Input value={roomOrBedSpace} onChange={(e) => setRoomOrBedSpace(e.target.value)} placeholder="e.g. Room 12B" />
                            </FormField>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Citizenship toggle */}
                    <div className="space-y-3 border border-border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Ghanaian Citizen</span>
                        </div>
                        <Switch checked={isCitizen} onCheckedChange={(v) => { setIsCitizen(v); if (v) { setNationality(""); setResidencePermitNo(""); } }} />
                      </div>
                      {!isCitizen && (
                        <div className="space-y-3 pt-2 border-t border-border">
                          <FormField label="Nationality" valid={nationality.length > 1}>
                            <Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Nigerian, British" />
                          </FormField>
                          <FormField label="Residence Permit Number" valid={residencePermitNo.length > 2}>
                            <Input value={residencePermitNo} onChange={(e) => setResidencePermitNo(e.target.value)} placeholder="e.g. RP-2026-XXXXX" />
                          </FormField>
                        </div>
                      )}
                    </div>

                    <FormField label="Phone Number" valid={isValidPhone(phone)} hint="10 digits, e.g. 024 555 1234">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={phone} onChange={(e) => { setPhone(formatPhone(e.target.value)); setPhoneVerified(false); setOtpSent(false); setOtpCode(""); }} placeholder="024 555 1234" className="pl-10" maxLength={12} />
                      </div>
                    </FormField>

                    {/* OTP Verification */}
                    {otpEnabled && isValidPhone(phone) && (
                      <div className="space-y-3 border border-border rounded-lg p-4">
                        {!phoneVerified ? (
                          <>
                            {!otpSent ? (
                              <Button variant="outline" size="sm" onClick={handleSendOtp} disabled={sendingOtp} className="w-full">
                                {sendingOtp ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Sending...</> : "Verify Phone Number"}
                              </Button>
                            ) : (
                              <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to <strong>{phone}</strong></p>
                                <div className="flex justify-center">
                                  <InputOTP maxLength={6} value={otpCode} onChange={(v) => { setOtpCode(v); if (v.length === 6) handleVerifyOtp(v); }}>
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
                                {verifyingOtp && <p className="text-xs text-muted-foreground text-center"><Loader2 className="h-3 w-3 animate-spin inline mr-1" />Verifying...</p>}
                                <Button variant="ghost" size="sm" onClick={handleSendOtp} disabled={sendingOtp} className="w-full text-xs">
                                  Resend Code
                                </Button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center gap-2 text-success text-sm">
                            <CheckCircle2 className="h-4 w-4" /> Phone number verified
                          </div>
                        )}
                      </div>
                    )}

                    <FormField label="Email (Optional)" optional error={email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Enter a valid email" : undefined}>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kwame@example.com" className="pl-10" type="email" />
                      </div>
                    </FormField>

                    {/* Password */}
                    <FormField label="Password" valid={password.length >= 8} hint="Minimum 8 characters">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password" className="pl-10 pr-10" type={showPassword ? "text" : "password"} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormField>
                    <FormField label="Confirm Password" valid={confirmPassword.length >= 8 && confirmPassword === password} error={confirmPassword && confirmPassword !== password ? "Passwords don't match" : undefined}>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="pl-10" type={showPassword ? "text" : "password"} />
                      </div>
                    </FormField>

                    <FormField label="Region of Stay" valid={!!region}>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue placeholder="Select your region" /></SelectTrigger>
                        <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>

                  </div>
                </div>
              )}

              {/* Step 1: Contact & Work */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Contact Details</h1>
                    <p className="text-muted-foreground mt-1">Optional work and emergency info</p>
                  </div>
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <FormField label="Occupation" optional>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g. Teacher" className="pl-10" />
                        </div>
                      </FormField>
                      <FormField label="Work Address" optional>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={workAddress} onChange={(e) => setWorkAddress(e.target.value)} placeholder="e.g. Accra Mall" className="pl-10" />
                        </div>
                      </FormField>
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                        <UserPlus className="h-3.5 w-3.5" /> Emergency contact (optional but recommended)
                      </p>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <FormField label="Emergency Contact Name" optional>
                          <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} placeholder="Ama Mensah" />
                        </FormField>
                        <FormField label="Emergency Phone" optional>
                          <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(formatPhone(e.target.value))} placeholder="020 555 5678" maxLength={12} />
                        </FormField>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Success */}
              {step === 2 && (
                <div className="space-y-6 text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Registration Complete!</h1>
                    <p className="text-muted-foreground mt-2">Your Tenant ID has been generated</p>
                  </div>
                  <div className="bg-card rounded-xl border-2 border-primary/30 p-6 inline-block mx-auto">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Tenant ID</p>
                    <p className="text-3xl font-extrabold text-primary tracking-wider">{generatedId}</p>
                    <p className="text-xs text-muted-foreground mt-2">Keep this ID safe — you'll need it for all official requests</p>
                  </div>

                  {/* Login Details */}
                  <div className="bg-card rounded-xl border border-border p-5 text-left space-y-3 max-w-sm mx-auto">
                    <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                      <Lock className="h-4 w-4 text-primary" /> Your Login Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Phone Number:</span>
                        <span className="font-medium text-foreground">{phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Password:</span>
                        <span className="font-medium text-foreground">The password you created</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-muted rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
                    <h3 className="font-semibold text-foreground text-sm">What's next?</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {regFeeEnabled && (
                        <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Pay GH₵ {regFee.toFixed(0)} registration fee to activate your account</li>
                      )}
                      {!regFeeEnabled && (
                        <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Your account is active — proceed to login</li>
                      )}
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Complete your Ghana Card verification after logging in</li>
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8">
            {step < 2 ? (
              <Button onClick={handleNext} disabled={!canProceed() || loading} className="w-full h-12 text-base font-semibold">
                {loading ? "Creating account..." : step === 1 ? "Create Account" : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handlePayRegistration} disabled={payingRegistration} className="w-full h-12 text-base font-semibold bg-success hover:bg-success/90">
                {payingRegistration ? "Redirecting to payment..." : regFeeEnabled ? `Pay GH₵ ${regFee.toFixed(0)} Registration Fee` : "Proceed to Login"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterTenant;

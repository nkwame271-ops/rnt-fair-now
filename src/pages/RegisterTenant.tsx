import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, User, Phone, Mail, MapPin, CheckCircle2, ArrowLeft, ArrowRight, IdCard, Globe, Lock, Briefcase, UserPlus, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { regions } from "@/data/dummyData";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { sendSms } from "@/lib/smsService";
import FormField from "@/components/FormField";
import { formatPhone, formatGhanaCard, isValidEmail, isValidPhone, isValidGhanaCard, isValidPassword } from "@/lib/formatters";

const steps = ["Account", "Identity", "Contact", "Your ID"];

const RegisterTenant = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCitizen, setIsCitizen] = useState(true);
  const [ghanaCardNo, setGhanaCardNo] = useState("");
  const [residencePermitNo, setResidencePermitNo] = useState("");
  const [phone, setPhone] = useState("");
  const [region, setRegion] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [generatedId, setGeneratedId] = useState("");
  const [payingRegistration, setPayingRegistration] = useState(false);

  const handlePayRegistration = async () => {
    setPayingRegistration(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "tenant_registration" },
      });
      if (error) throw new Error(error.message || "Payment initiation failed");
      if (data?.error) throw new Error(data.error);
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
      case 0: return fullName && isValidEmail(email) && isValidPassword(password);
      case 1: return (isCitizen ? isValidGhanaCard(ghanaCardNo) : true) && region;
      case 2: return isValidPhone(phone);
      default: return true;
    }
  };

  const handleNext = async () => {
    if (step < 2) { setStep(step + 1); return; }
    if (step === 2) { await handleCreateAccount(); return; }
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      let userId: string;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email, password,
        options: {
          data: { full_name: fullName, phone: phone.replace(/\s/g, ""), role: "tenant" },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            toast.error("This email is already registered. Please sign in instead.", {
              action: { label: "Go to Login", onClick: () => navigate("/login?role=tenant") },
            });
            setLoading(false);
            return;
          }
          userId = signInData.user.id;
          const { data: existingTenant } = await supabase.from("tenants").select("tenant_id, registration_fee_paid").eq("user_id", userId).maybeSingle();
          if (existingTenant) {
            toast.success("Welcome back! Redirecting to dashboard...");
            navigate("/tenant/dashboard");
            return;
          }
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error("Registration failed");
        userId = authData.user.id;
      }

      const tenantId = "TN-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

      await supabase.from("profiles").update({
        nationality: isCitizen ? "Ghanaian" : "Non-Ghanaian",
        is_citizen: isCitizen,
        ghana_card_no: isCitizen ? ghanaCardNo : null,
        residence_permit_no: !isCitizen ? residencePermitNo : null,
        occupation, work_address: workAddress,
        emergency_contact_name: emergencyName,
        emergency_contact_phone: emergencyPhone.replace(/\s/g, ""),
      }).eq("user_id", userId);

      await supabase.from("tenants").insert({
        user_id: userId,
        tenant_id: tenantId,
        registration_fee_paid: false,
      });

      setGeneratedId(tenantId);
      
      // Send registration success SMS (non-blocking)
      sendSms(phone, "registration_success", {
        name: fullName,
        role: "Tenant",
        id: tenantId,
      });
      
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const progressPercent = Math.round((Math.min(step, 3) / 3) * 100);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero items-center justify-center p-12 relative">
        <div className="text-primary-foreground max-w-sm">
          <Shield className="h-12 w-12 text-secondary mb-6" />
          <h2 className="text-3xl font-bold mb-4">Register as a Tenant</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Get your unique Tenant ID to access rent control services, file complaints, and manage your tenancy agreements.
          </p>
          <div className="bg-primary-foreground/10 rounded-xl p-5 backdrop-blur-sm border border-primary-foreground/20">
            <div className="flex items-center gap-3 mb-3">
              <IdCard className="h-5 w-5 text-secondary" />
              <span className="font-semibold">Annual Registration</span>
            </div>
            <div className="text-3xl font-extrabold text-secondary mb-1">GH₵ 2.00</div>
            <p className="text-primary-foreground/70 text-sm mb-3">Per year · Includes physical ID card delivery</p>
            <div className="border-t border-primary-foreground/20 pt-3">
              <p className="text-sm font-semibold mb-2">Registration Fee Covers:</p>
              <ul className="space-y-1.5 text-sm text-primary-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Marketplace access</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Tenant ID card</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Rent card</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Complaint system</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Tenancy agreement management</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />12-month platform access</li>
              </ul>
            </div>
          </div>
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
            <span>Step {Math.min(step + 1, 3)} of 3</span>
            <span>{progressPercent}% complete</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Step labels */}
        <div className="flex items-center gap-1 mb-6 max-w-lg overflow-x-auto">
          {steps.slice(0, 3).map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < 2 && <div className={`h-px w-4 ${i < step ? "bg-primary" : "bg-border"}`} />}
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
                    <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
                    <p className="text-muted-foreground mt-1">Just 3 fields to get started</p>
                  </div>
                  <div className="space-y-4">
                    <FormField label="Full Name" valid={fullName.length > 2}>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kwame Mensah" className="pl-10" />
                      </div>
                    </FormField>
                    <FormField label="Email" valid={isValidEmail(email)} error={email && !isValidEmail(email) ? "Enter a valid email" : undefined}>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kwame@example.com" className="pl-10" type="email" />
                      </div>
                    </FormField>
                    <FormField label="Password" valid={isValidPassword(password)} hint="Minimum 6 characters">
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className="pl-10" type="password" />
                      </div>
                    </FormField>
                  </div>
                </div>
              )}

              {/* Step 1: Identity */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Identity Verification</h1>
                    <p className="text-muted-foreground mt-1">Your citizenship and ID details</p>
                  </div>
                  <div className="space-y-4">
                    <FormField label="Citizenship Status">
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setIsCitizen(true); setResidencePermitNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}>
                          <IdCard className="h-4 w-4" /> Ghanaian
                        </button>
                        <button type="button" onClick={() => { setIsCitizen(false); setGhanaCardNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            !isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}>
                          <Globe className="h-4 w-4" /> Non-Citizen
                        </button>
                      </div>
                    </FormField>
                    {isCitizen ? (
                      <FormField label="Ghana Card Number" valid={isValidGhanaCard(ghanaCardNo)} hint="Format: GHA-XXXXXXXXX-X">
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={ghanaCardNo} onChange={(e) => setGhanaCardNo(formatGhanaCard(e.target.value))} placeholder="GHA-123456789-0" className="pl-10" maxLength={15} />
                        </div>
                      </FormField>
                    ) : (
                      <FormField label="Residence Permit Number (Optional)" optional>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={residencePermitNo} onChange={(e) => setResidencePermitNo(e.target.value)} placeholder="RP-XXXXXXXXX" className="pl-10" />
                        </div>
                      </FormField>
                    )}
                    <FormField label="Region of Residence" valid={!!region}>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue placeholder="Select your region" /></SelectTrigger>
                        <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                  </div>
                </div>
              )}

              {/* Step 2: Contact & Work */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Contact Details</h1>
                    <p className="text-muted-foreground mt-1">Phone and optional work/emergency info</p>
                  </div>
                  <div className="space-y-4">
                    <FormField label="Phone Number" valid={isValidPhone(phone)} hint="10 digits, e.g. 024 555 1234">
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="024 555 1234" className="pl-10" maxLength={12} />
                      </div>
                    </FormField>
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

              {/* Step 3: Success */}
              {step === 3 && (
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
                    <p className="text-xs text-muted-foreground mt-2">Pay registration fee on your dashboard to activate</p>
                  </div>
                  <div className="bg-muted rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
                    <h3 className="font-semibold text-foreground text-sm">What's next?</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Check your email to verify your account</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Pay GH₵ 2 registration fee from your dashboard</li>
                      <li className="flex items-start gap-2">
                        <Building className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        Your Rent Card will be available at the Rent Control Department within 5 days. You can opt for delivery later within the app.
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8">
            {step < 3 ? (
              <Button onClick={handleNext} disabled={!canProceed() || loading} className="w-full h-12 text-base font-semibold">
                {loading ? "Creating account..." : step === 2 ? "Create Account" : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handlePayRegistration} disabled={payingRegistration} className="w-full h-12 text-base font-semibold bg-success hover:bg-success/90">
                {payingRegistration ? "Redirecting to payment..." : "Pay GH₵ 2 Registration Fee"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterTenant;

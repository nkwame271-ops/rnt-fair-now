import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, User, Phone, Mail, MapPin, CheckCircle2, ArrowLeft, ArrowRight, IdCard, Truck, Building2, Lock, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { regions } from "@/data/dummyData";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const steps = ["Personal Info", "Delivery Address", "Your Landlord ID"];

const RegisterLandlord = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isCitizen, setIsCitizen] = useState(true);
  const [ghanaCardNo, setGhanaCardNo] = useState("");
  const [residencePermitNo, setResidencePermitNo] = useState("");
  const [region, setRegion] = useState("");
  const [businessName, setBusinessName] = useState("");

  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [deliveryLandmark, setDeliveryLandmark] = useState("");

  const [generatedId, setGeneratedId] = useState("");

  const canProceed = () => {
    if (step === 0) return fullName && phone && email && password && (isCitizen ? ghanaCardNo : residencePermitNo) && region;
    if (step === 1) return deliveryAddress && deliveryCity && deliveryRegion;
    return true;
  };

  const handleNext = async () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      await handleCreateAccount();
      return;
    }
  };

  const handleCreateAccount = async () => {
    setLoading(true);
    try {
      let userId: string;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, role: "landlord" },
          emailRedirectTo: window.location.origin,
        },
      });

      if (authError) {
        if (authError.message?.includes("already registered") || authError.message?.includes("already exists")) {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            toast.error("This email is already registered. Please sign in instead.", {
              action: { label: "Go to Login", onClick: () => navigate("/login?role=landlord") },
            });
            setLoading(false);
            return;
          }
          userId = signInData.user.id;

          const { data: existingLandlord } = await supabase.from("landlords").select("landlord_id, registration_fee_paid").eq("user_id", userId).maybeSingle();
          if (existingLandlord) {
            toast.success("Welcome back! Redirecting to dashboard...");
            navigate("/landlord/dashboard");
            return;
          }
        } else {
          throw authError;
        }
      } else {
        if (!authData.user) throw new Error("Registration failed");
        userId = authData.user.id;
      }

      const landlordId = "LL-" + new Date().getFullYear() + "-" + String(Math.floor(1000 + Math.random() * 9000));

      await supabase.from("profiles").update({
        nationality: isCitizen ? "Ghanaian" : "Non-Ghanaian",
        is_citizen: isCitizen,
        ghana_card_no: isCitizen ? ghanaCardNo : null,
        residence_permit_no: !isCitizen ? residencePermitNo : null,
        delivery_address: deliveryAddress,
        delivery_landmark: deliveryLandmark,
        delivery_region: deliveryRegion,
        delivery_area: deliveryCity,
      }).eq("user_id", userId);

      await supabase.from("landlords").insert({
        user_id: userId,
        landlord_id: landlordId,
        registration_fee_paid: false,
      });

      setGeneratedId(landlordId);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    navigate("/landlord/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-2/5 gradient-hero items-center justify-center p-12 relative">
        <div className="text-primary-foreground max-w-sm">
          <Shield className="h-12 w-12 text-secondary mb-6" />
          <h2 className="text-3xl font-bold mb-4">Register as a Landlord</h2>
          <p className="text-primary-foreground/80 text-lg mb-8">
            Get your unique Landlord ID to register properties, manage tenants, and stay compliant with Act 220.
          </p>
          <div className="bg-primary-foreground/10 rounded-xl p-5 backdrop-blur-sm border border-primary-foreground/20">
            <div className="flex items-center gap-3 mb-3">
              <Building2 className="h-5 w-5 text-secondary" />
              <span className="font-semibold">Annual Registration</span>
            </div>
            <div className="text-3xl font-extrabold text-secondary mb-1">GH₵ 2.00</div>
            <p className="text-primary-foreground/70 text-sm mb-3">Per year · Includes physical ID card delivery</p>
            <div className="border-t border-primary-foreground/20 pt-3">
              <p className="text-sm font-semibold mb-2">Registration Fee Covers:</p>
              <ul className="space-y-1.5 text-sm text-primary-foreground/80">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Marketplace access</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Landlord ID card</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Rent card</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Complaint system</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />Tenancy agreement management</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />12-month platform access</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 sm:p-10">
        <button onClick={() => step === 0 ? navigate("/") : setStep(step - 1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors self-start">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">{step === 0 ? "Back to Home" : "Previous Step"}</span>
        </button>

        <div className="flex items-center gap-2 mb-8 max-w-lg">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        <div className="max-w-lg flex-1">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Personal Information</h1>
                    <p className="text-muted-foreground mt-1">We need your details to create your Landlord ID</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kwame Asante" className="pl-10" /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Business / Company Name (optional)</Label>
                      <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Asante Properties Ltd" className="pl-10" /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Citizenship Status</Label>
                      <div className="flex gap-3">
                        <button type="button" onClick={() => { setIsCitizen(true); setResidencePermitNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}>
                          <IdCard className="h-4 w-4" /> Ghanaian Citizen
                        </button>
                        <button type="button" onClick={() => { setIsCitizen(false); setGhanaCardNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            !isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}>
                          <Globe className="h-4 w-4" /> Non-Citizen
                        </button>
                      </div>
                    </div>
                    {isCitizen ? (
                      <div className="space-y-2">
                        <Label>Ghana Card Number</Label>
                        <div className="relative"><IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={ghanaCardNo} onChange={(e) => setGhanaCardNo(e.target.value)} placeholder="GHA-XXXXXXXXX-X" className="pl-10" /></div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Residence Permit Number</Label>
                        <div className="relative"><Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={residencePermitNo} onChange={(e) => setResidencePermitNo(e.target.value)} placeholder="RP-XXXXXXXXX" className="pl-10" /></div>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <div className="relative"><Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 555 1234" className="pl-10" /></div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kwame@example.com" className="pl-10" type="email" /></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Password</Label>
                      <div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="pl-10" type="password" /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Region</Label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue placeholder="Select your region" /></SelectTrigger>
                        <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Card Delivery Address</h1>
                    <p className="text-muted-foreground mt-1">Where should we deliver your physical Landlord ID card?</p>
                  </div>
                  <div className="bg-accent/10 rounded-lg p-4 flex items-start gap-3 border border-accent/30">
                    <Truck className="h-5 w-5 text-accent-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">Your Landlord ID card will be delivered within 5–7 business days after payment.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Street Address</Label>
                      <div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="e.g. 14 Palm Street" className="pl-10" /></div>
                    </div>
                    <div className="space-y-2">
                      <Label>Nearest Landmark</Label>
                      <Input value={deliveryLandmark} onChange={(e) => setDeliveryLandmark(e.target.value)} placeholder="e.g. Near Total filling station" />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City / Town</Label>
                        <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="e.g. Kumasi" />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={deliveryRegion} onValueChange={setDeliveryRegion}>
                          <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                          <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 text-center py-8">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Registration Complete!</h1>
                    <p className="text-muted-foreground mt-2">Your Landlord ID has been generated successfully</p>
                  </div>
                  <div className="bg-card rounded-xl border-2 border-primary/30 p-6 inline-block mx-auto">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Landlord ID</p>
                    <p className="text-3xl font-extrabold text-primary tracking-wider">{generatedId}</p>
                    <p className="text-xs text-muted-foreground mt-2">Pay registration fee on your dashboard to activate</p>
                  </div>
                  <div className="bg-muted rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
                    <h3 className="font-semibold text-foreground text-sm">What's next?</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Check your email to verify your account</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Pay GH₵ 2 registration fee from your dashboard</li>
                      <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Register properties and add tenants</li>
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-8">
            {step < 2 ? (
              <Button onClick={handleNext} disabled={!canProceed() || loading} className="w-full h-12 text-base font-semibold">
                {loading ? "Creating account..." : "Continue"} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="w-full h-12 text-base font-semibold">
                Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterLandlord;

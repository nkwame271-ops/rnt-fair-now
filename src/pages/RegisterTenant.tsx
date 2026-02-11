import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, User, Phone, Mail, MapPin, CreditCard, CheckCircle2, ArrowLeft, ArrowRight, IdCard, Truck, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { regions } from "@/data/dummyData";
import { toast } from "sonner";

const steps = ["Personal Info", "Delivery Address", "Payment", "Your Tenant ID"];

const RegisterTenant = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Personal info
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isCitizen, setIsCitizen] = useState(true);
  const [ghanaCardNo, setGhanaCardNo] = useState("");
  const [residencePermitNo, setResidencePermitNo] = useState("");
  const [region, setRegion] = useState("");

  // Delivery
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [deliveryPhone, setDeliveryPhone] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState("");
  const [momoNumber, setMomoNumber] = useState("");

  // Generated ID
  const generatedId = "TN-2026-" + String(Math.floor(1000 + Math.random() * 9000));

  const canProceed = () => {
    if (step === 0) return fullName && phone && email && (isCitizen ? ghanaCardNo : residencePermitNo) && region;
    if (step === 1) return deliveryAddress && deliveryCity && deliveryRegion;
    if (step === 2) return paymentMethod && (paymentMethod !== "momo" || momoNumber);
    return true;
  };

  const handleNext = () => {
    if (step === 2) {
      toast.success("Payment of GH₵ 50.00 processed successfully!");
    }
    setStep(step + 1);
  };

  const handleFinish = () => {
    toast.success("Welcome! Redirecting to your dashboard...");
    navigate("/tenant/dashboard");
  };

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
            <div className="text-3xl font-extrabold text-secondary mb-1">GH₵ 50.00</div>
            <p className="text-primary-foreground/70 text-sm">Per year · Includes physical ID card delivery</p>
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

        {/* Step Indicator */}
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
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Step 0: Personal Info */}
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Personal Information</h1>
                    <p className="text-muted-foreground mt-1">We need your details to create your Tenant ID</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Kwame Mensah" className="pl-10" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Citizenship Status</Label>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => { setIsCitizen(true); setResidencePermitNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <IdCard className="h-4 w-4" />
                          Ghanaian Citizen
                        </button>
                        <button
                          type="button"
                          onClick={() => { setIsCitizen(false); setGhanaCardNo(""); }}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                            !isCitizen ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <Globe className="h-4 w-4" />
                          Non-Citizen
                        </button>
                      </div>
                    </div>
                    {isCitizen ? (
                      <div className="space-y-2">
                        <Label>Ghana Card Number</Label>
                        <div className="relative">
                          <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={ghanaCardNo} onChange={(e) => setGhanaCardNo(e.target.value)} placeholder="GHA-XXXXXXXXX-X" className="pl-10" />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Residence Permit Number</Label>
                        <div className="relative">
                          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={residencePermitNo} onChange={(e) => setResidencePermitNo(e.target.value)} placeholder="RP-XXXXXXXXX" className="pl-10" />
                        </div>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Phone Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="024 555 1234" className="pl-10" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kwame@example.com" className="pl-10" type="email" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Region of Residence</Label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue placeholder="Select your region" /></SelectTrigger>
                        <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Delivery Address */}
              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Card Delivery Address</h1>
                    <p className="text-muted-foreground mt-1">Where should we deliver your physical Tenant ID card?</p>
                  </div>
                  <div className="bg-accent/10 rounded-lg p-4 flex items-start gap-3 border border-accent/30">
                    <Truck className="h-5 w-5 text-accent-foreground mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">Your Tenant ID card will be printed and delivered to this address within 5–7 business days after payment.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Street Address / Landmark</Label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="e.g. 14 Palm Street, near Total station" className="pl-10" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City / Town</Label>
                        <Input value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} placeholder="e.g. Accra" />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Select value={deliveryRegion} onValueChange={setDeliveryRegion}>
                          <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                          <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Delivery Contact Phone (optional)</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input value={deliveryPhone} onChange={(e) => setDeliveryPhone(e.target.value)} placeholder="024 555 1234" className="pl-10" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Payment */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Pay Registration Fee</h1>
                    <p className="text-muted-foreground mt-1">Annual Tenant ID registration — GH₵ 50.00</p>
                  </div>
                  <div className="bg-card rounded-xl border border-border p-5 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tenant ID Registration</span>
                      <span className="font-semibold text-foreground">GH₵ 50.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">ID Card Printing & Delivery</span>
                      <span className="font-semibold text-foreground">Included</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="text-xl font-extrabold text-primary">GH₵ 50.00</span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="momo">MTN Mobile Money</SelectItem>
                          <SelectItem value="vodafone">Vodafone Cash</SelectItem>
                          <SelectItem value="airteltigo">AirtelTigo Money</SelectItem>
                          <SelectItem value="bank">Bank Card</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(paymentMethod === "momo" || paymentMethod === "vodafone" || paymentMethod === "airteltigo") && (
                      <div className="space-y-2">
                        <Label>Mobile Money Number</Label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="024 555 1234" className="pl-10" />
                        </div>
                      </div>
                    )}
                    {paymentMethod === "bank" && (
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Card Number</Label>
                          <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="•••• •••• •••• ••••" className="pl-10" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Expiry</Label>
                            <Input placeholder="MM/YY" />
                          </div>
                          <div className="space-y-2">
                            <Label>CVV</Label>
                            <Input placeholder="•••" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Success */}
              {step === 3 && (
                <div className="space-y-6 text-center py-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto"
                  >
                    <CheckCircle2 className="h-10 w-10 text-primary" />
                  </motion.div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">Registration Complete!</h1>
                    <p className="text-muted-foreground mt-2">Your Tenant ID has been generated successfully</p>
                  </div>
                  <div className="bg-card rounded-xl border-2 border-primary/30 p-6 inline-block mx-auto">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Tenant ID</p>
                    <p className="text-3xl font-extrabold text-primary tracking-wider">{generatedId}</p>
                    <p className="text-xs text-muted-foreground mt-2">Valid until February 2027</p>
                  </div>
                  <div className="bg-muted rounded-xl p-5 text-left space-y-3 max-w-sm mx-auto">
                    <h3 className="font-semibold text-foreground text-sm">What's next?</h3>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        Share your Tenant ID with your landlord
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        Your physical ID card will arrive in 5–7 days
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        Your landlord will send you a tenancy agreement to accept
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="mt-8">
            {step < 3 ? (
              <Button onClick={handleNext} disabled={!canProceed()} className="w-full h-12 text-base font-semibold">
                {step === 2 ? "Pay GH₵ 50.00" : "Continue"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} className="w-full h-12 text-base font-semibold">
                Go to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterTenant;

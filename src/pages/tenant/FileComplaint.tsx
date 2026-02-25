import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, FileText, MapPin, Info, ArrowRight, ArrowLeft } from "lucide-react";
import { complaintTypes, regions, areasByRegion } from "@/data/dummyData";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const steps = ["Complaint Type", "Property Details", "Description", "Review & Submit"];

const FileComplaint = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: "",
    landlordName: "",
    landlordPhone: "",
    address: "",
    region: "",
    area: "",
    description: "",
    amount: "",
    date: "",
  });

  const update = (key: string, value: string) => setForm({ ...form, [key]: value });
  const areas = form.region ? areasByRegion[form.region] || [] : [];

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const complaintCode = `RC-${new Date().getFullYear()}-${String(Math.floor(10000 + Math.random() * 90000))}`;

      const { data: complaint, error } = await supabase.from("complaints").insert({
        tenant_user_id: user.id,
        complaint_code: complaintCode,
        complaint_type: form.type,
        landlord_name: form.landlordName,
        property_address: form.address,
        region: form.region,
        description: form.description,
        status: "pending_payment",
      }).select("id").single();

      if (error) throw error;

      // Initiate Paystack checkout for complaint fee
      const { data, error: payErr } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "complaint_fee", complaintId: complaint.id },
      });

      if (payErr) throw new Error(payErr.message || "Payment initiation failed");
      if (data?.error) throw new Error(data.error);

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">File a Complaint</h1>
        <p className="text-muted-foreground mt-1">Report a tenancy violation to Rent Control</p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && <div className={`h-0.5 flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>
      <div className="text-sm font-semibold text-foreground">{steps[step]}</div>

      <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
        {step === 0 && (
          <div className="space-y-4">
            <Label>What type of violation are you reporting?</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {complaintTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => update("type", t)}
                  className={`text-left p-3 rounded-lg border text-sm font-medium transition-all ${
                    form.type === t
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-card-foreground hover:border-primary/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Landlord / Agent Name</Label>
                <Input value={form.landlordName} onChange={(e) => update("landlordName", e.target.value)} placeholder="e.g. Mr. Kofi Boateng" />
              </div>
              <div className="space-y-2">
                <Label>Landlord Phone (optional)</Label>
                <Input value={form.landlordPhone} onChange={(e) => update("landlordPhone", e.target.value)} placeholder="024 555 1234" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Property Address</Label>
              <Input value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="e.g. 12 Ring Road, Osu" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={form.region} onValueChange={(v) => { update("region", v); update("area", ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District / Area</Label>
                <Select value={form.area} onValueChange={(v) => update("area", v)} disabled={!form.region}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Describe the incident in detail</Label>
              <Textarea rows={5} value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What happened? Include dates, amounts, and any relevant context..." />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount involved (GH₵)</Label>
                <Input type="number" value={form.amount} onChange={(e) => update("amount", e.target.value)} placeholder="e.g. 5000" />
              </div>
              <div className="space-y-2">
                <Label>Date of incident</Label>
                <Input type="date" value={form.date} onChange={(e) => update("date", e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-sm">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold text-card-foreground">{form.type}</span></div>
              <div><span className="text-muted-foreground">Landlord:</span> <span className="font-semibold text-card-foreground">{form.landlordName || "—"}</span></div>
              <div><span className="text-muted-foreground">Property:</span> <span className="font-semibold text-card-foreground">{form.address || "—"}</span></div>
              <div><span className="text-muted-foreground">Location:</span> <span className="font-semibold text-card-foreground">{form.area}, {form.region}</span></div>
              <div><span className="text-muted-foreground">Description:</span> <span className="font-semibold text-card-foreground">{form.description || "—"}</span></div>
              <div><span className="text-muted-foreground">Amount:</span> <span className="font-semibold text-card-foreground">GH₵ {form.amount || "—"}</span></div>
            </div>
            <div className="bg-card rounded-lg border border-border p-4 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Complaint Filing Fee</span><span className="font-semibold text-primary">GH₵ 20.00</span></div>
              <p className="text-xs text-muted-foreground">You'll be redirected to make an online payment for the filing fee. Your complaint will be submitted once payment is confirmed.</p>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
              <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
              <span>By submitting, you confirm the information provided is accurate. False complaints may result in penalties under Act 220.</span>
            </div>
          </div>
        )}
      </motion.div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)}>
            Next <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Processing..." : "Pay GH₵ 20 & Submit"} <FileText className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default FileComplaint;

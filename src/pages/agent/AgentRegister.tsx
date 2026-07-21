import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Camera, ShieldCheck, Upload, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Seo from "@/components/Seo";
import { GHANA_REGIONS } from "@/hooks/useAdminProfile";

const ID_TYPES = [
  { value: "ghana_card", label: "Ghana Card" },
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "voters_id", label: "Voter's ID" },
];

const schema = z.object({
  full_name: z.string().trim().min(3, "Full name is required").max(120),
  phone: z.string().trim().min(9, "Valid phone required").max(20),
  email: z.string().trim().email("Valid email required").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72).optional().or(z.literal("")),
  date_of_birth: z.string().optional(),
  id_type: z.string().min(1, "Select an ID type"),
  id_number: z.string().trim().min(3, "ID number required").max(40),
  region: z.string().min(1, "Select a region"),
  operating_area: z.string().trim().max(120).optional(),
  residential_address: z.string().trim().max(240).optional(),
  emergency_contact_name: z.string().trim().max(120).optional(),
  emergency_contact_phone: z.string().trim().max(20).optional(),
});

const AgentRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [supportingDocs, setSupportingDocs] = useState<{ name: string; url: string }[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [existing, setExisting] = useState<any | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: user?.email || "",
    password: "",
    date_of_birth: "",
    id_type: "",
    id_number: "",
    region: "",
    operating_area: "",
    residential_address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
  });

  useEffect(() => {
    if (user?.email) setForm((f) => ({ ...f, email: user.email! }));
    if (!user) return;
    (supabase as any)
      .from("agent_applications")
      .select("*")
      .eq("applicant_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setExisting(data);
      });
  }, [user]);

  const uploadFile = async (file: File, kind: "photo" | "doc") => {
    const folder = user ? user.id : "public";
    const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const { error } = await supabase.storage.from("agent-documents").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = await supabase.storage.from("agent-documents").createSignedUrl(path, 60 * 60 * 24 * 365);
    return { path, signedUrl: data?.signedUrl || path };
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    setUploadingPhoto(true);
    try {
      const { signedUrl } = await uploadFile(file, "photo");
      setPhotoUrl(signedUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      toast.error(err.message || "Photo upload failed");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      for (const file of files) {
        if (file.size > 8 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 8 MB`);
          continue;
        }
        const { signedUrl } = await uploadFile(file, "doc");
        setSupportingDocs((prev) => [...prev, { name: file.name, url: signedUrl }]);
      }
      toast.success("Documents added");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (!user && !form.password) {
      toast.error("Password is required to create your agent account");
      return;
    }
    setSubmitting(true);
    try {
      // If not signed in, create an account first so approval can promote it later.
      let applicantUserId = user?.id || null;
      if (!user) {
        const { data: signUp, error: suErr } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: form.password,
          options: {
            emailRedirectTo: `${window.location.origin}/agent/register`,
            data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
          },
        });
        if (suErr) throw suErr;
        applicantUserId = signUp.user?.id || null;
      }

      const { password: _pw, ...cleanData } = parsed.data;
      const payload = {
        ...cleanData,
        date_of_birth: form.date_of_birth || null,
        professional_photo_url: photoUrl,
        supporting_documents: supportingDocs,
        applicant_user_id: applicantUserId,
      };
      const { error } = await (supabase as any).from("agent_applications").insert(payload);
      if (error) throw error;

      // Best-effort notify admins
      supabase.functions.invoke("send-notification", {
        body: {
          event: "agent_application_submitted",
          email: "info@rentcontrolghana.com",
          data: { full_name: parsed.data.full_name, phone: parsed.data.phone, email: parsed.data.email },
        },
      }).catch(() => {});

      setSubmitted(true);
      toast.success("Application submitted. Admin will review and get back to you.");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
    }
  };

  if (existing && !submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <Seo title="Agent Application Status | Rent Control" description="Your Premium Service Agent application status." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Application {existing.status}</h1>
          <p className="text-muted-foreground text-sm">
            You submitted an application on {new Date(existing.created_at).toLocaleDateString()}.
            {existing.status === "pending" && " Our team is reviewing your details."}
            {existing.status === "approved" && " You now have access to the Agent Portal."}
            {existing.status === "rejected" && (existing.reviewer_notes ? ` Reason: ${existing.reviewer_notes}` : "")}
          </p>
          {existing.status === "approved" ? (
            <Button className="w-full" onClick={() => navigate("/agent/dashboard")}>Go to Agent Portal</Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Return home</Button>
          )}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold">Application Received</h1>
          <p className="text-muted-foreground text-sm">
            Thanks {form.full_name.split(" ")[0]}. Our team will verify your identity and get back to you via {form.email} within 3–5 business days.
          </p>
          <Button className="w-full" onClick={() => navigate("/")}>Back to home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Seo
        title="Become a Premium Service Agent | Rent Control"
        description="Apply to manage hostels and tenants under Rent Control's Premium Service programme. Verified agents get their own portal to work on behalf of assigned landlords and tenants."
        canonicalPath="/agent/register"
      />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Agent Registration</h1>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            Apply to manage hostels and tenants under Premium Service. An admin will review and approve your account.
          </p>
        </motion.div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-6">
          {/* Photo + intro */}
          <div className="flex gap-4 items-start">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                {photoUrl ? (
                  <img src={photoUrl} alt="Agent" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <p className="font-semibold text-sm">Professional Photo</p>
              <p className="text-xs text-muted-foreground">
                This photo is shown to hostels/landlords in the Premium Service feature.
              </p>
              <label className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border border-border cursor-pointer hover:bg-accent">
                <Camera className="h-4 w-4" />
                {uploadingPhoto ? "Uploading..." : "Upload Photo"}
                <input type="file" accept="image/*" hidden onChange={handlePhoto} disabled={uploadingPhoto} />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0XX XXX XXXX" maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} disabled={!!user} />
            </div>
            {!user && (
              <div className="space-y-1.5">
                <Label>Password *</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} maxLength={72} placeholder="At least 6 characters" autoComplete="new-password" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Date of Birth</Label>
              <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>ID Type *</Label>
              <Select value={form.id_type} onValueChange={(v) => setForm({ ...form, id_type: v })}>
                <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                <SelectContent>
                  {ID_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ID Number *</Label>
              <Input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>Region *</Label>
              <Select value={form.region} onValueChange={(v) => setForm({ ...form, region: v })}>
                <SelectTrigger><SelectValue placeholder="Select region" /></SelectTrigger>
                <SelectContent>
                  {GHANA_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Operating Area</Label>
              <Input value={form.operating_area} onChange={(e) => setForm({ ...form, operating_area: e.target.value })} placeholder="e.g. East Legon, Madina" maxLength={120} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Residential Address</Label>
            <Textarea rows={2} value={form.residential_address} onChange={(e) => setForm({ ...form, residential_address: e.target.value })} maxLength={240} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Emergency Contact Name</Label>
              <Input value={form.emergency_contact_name} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} maxLength={120} />
            </div>
            <div className="space-y-1.5">
              <Label>Emergency Contact Phone</Label>
              <Input value={form.emergency_contact_phone} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} maxLength={20} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Supporting Documents</Label>
            <label className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-dashed border-border cursor-pointer hover:bg-accent">
              <Upload className="h-4 w-4" />
              Upload ID scan, references, certificates (PDF or image)
              <input type="file" accept=".pdf,image/*" multiple hidden onChange={handleDocs} />
            </label>
            {supportingDocs.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1 pl-1">
                {supportingDocs.map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3 w-3 text-success" /> {d.name}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!user && (
            <p className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg p-3">
              Tip: <button type="button" className="underline" onClick={() => navigate("/login?redirect=/agent/register")}>Sign in</button> before submitting so we can link the application to your account.
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full h-12 text-base font-semibold">
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</> : "Submit Application"}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By submitting you agree that Rent Control may verify your identity and contact your emergency contact if needed.
          </p>
        </form>
      </div>
    </div>
  );
};

export default AgentRegister;

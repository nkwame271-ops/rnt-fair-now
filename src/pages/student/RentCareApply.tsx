import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { RENTCARE_PROGRAMME_NAME } from "@/lib/rentcare/legalNotice";

const schema = z.object({
  full_name: z.string().min(2).max(150),
  phone: z.string().min(7).max(20),
  email: z.string().email().max(255),
  ghana_card_no: z.string().min(5).max(50),
  gender: z.string().max(20).optional(),
  region: z.string().max(80).optional(),
  address: z.string().max(300).optional(),
  institution: z.string().min(2).max(150),
  campus: z.string().max(150).optional(),
  student_id_code: z.string().min(2).max(50),
  programme: z.string().max(150).optional(),
  level: z.string().max(20).optional(),
  accommodation_type: z.string().max(80).optional(),
  provider_name: z.string().max(150).optional(),
  provider_contact: z.string().max(50).optional(),
  accommodation_location: z.string().max(300).optional(),
  total_fee: z.coerce.number().nonnegative().optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  outstanding_amount: z.coerce.number().nonnegative().optional(),
  amount_requested: z.coerce.number().positive(),
  deadline: z.string().optional(),
  reason: z.string().min(10).max(2000),
  urgency: z.string().max(20).optional(),
  previous_support_history: z.string().max(1000).optional(),
});

interface FieldProps {
  id: string;
  label: string;
  type?: string;
  textarea?: boolean;
  value: string;
  onChange: (v: string) => void;
}

const Field = ({ id, label, type = "text", textarea = false, value, onChange }: FieldProps) => (
  <div className="space-y-1">
    <Label htmlFor={id}>{label}</Label>
    {textarea ? (
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    )}
  </div>
);

export default function RentCareApply() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const onSubmit = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Please complete required fields");
      return;
    }
    if (!user?.id) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("rentcare_applications")
        .insert({ applicant_user_id: user.id, ...parsed.data, status: "draft", payment_status: "unpaid" })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("rentcare_audit_log").insert({
        application_id: data.id, event_type: "application_started",
        actor_user_id: user.id, actor_role: "student",
      });
      toast.success("Application saved. Proceed to payment.");
      navigate(`/nugs/rentcare/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Failed to save application");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New RentCare Application</h1>
        <p className="text-sm text-muted-foreground">{RENTCARE_PROGRAMME_NAME}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field id="rc-full_name" label="Full Name *" value={form.full_name || ""} onChange={(v) => set("full_name", v)} />
          <Field id="rc-phone" label="Phone *" value={form.phone || ""} onChange={(v) => set("phone", v)} />
          <Field id="rc-email" label="Email *" value={form.email || ""} onChange={(v) => set("email", v)} />
          <Field id="rc-ghana_card_no" label="Ghana Card No *" value={form.ghana_card_no || ""} onChange={(v) => set("ghana_card_no", v)} />
          <Field id="rc-gender" label="Gender" value={form.gender || ""} onChange={(v) => set("gender", v)} />
          <Field id="rc-region" label="Region" value={form.region || ""} onChange={(v) => set("region", v)} />
          <div className="sm:col-span-2">
            <Field id="rc-address" label="Address" value={form.address || ""} onChange={(v) => set("address", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Student Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field id="rc-institution" label="Institution *" value={form.institution || ""} onChange={(v) => set("institution", v)} />
          <Field id="rc-campus" label="Campus" value={form.campus || ""} onChange={(v) => set("campus", v)} />
          <Field id="rc-student_id_code" label="Student ID *" value={form.student_id_code || ""} onChange={(v) => set("student_id_code", v)} />
          <Field id="rc-programme" label="Programme" value={form.programme || ""} onChange={(v) => set("programme", v)} />
          <Field id="rc-level" label="Level" value={form.level || ""} onChange={(v) => set("level", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accommodation Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field id="rc-accommodation_type" label="Type (hostel / hall / private)" value={form.accommodation_type || ""} onChange={(v) => set("accommodation_type", v)} />
          <Field id="rc-provider_name" label="Provider Name" value={form.provider_name || ""} onChange={(v) => set("provider_name", v)} />
          <Field id="rc-provider_contact" label="Provider Contact" value={form.provider_contact || ""} onChange={(v) => set("provider_contact", v)} />
          <Field id="rc-accommodation_location" label="Location" value={form.accommodation_location || ""} onChange={(v) => set("accommodation_location", v)} />
          <Field id="rc-total_fee" label="Total Fee (GHS)" type="number" value={form.total_fee || ""} onChange={(v) => set("total_fee", v)} />
          <Field id="rc-amount_paid" label="Amount Paid (GHS)" type="number" value={form.amount_paid || ""} onChange={(v) => set("amount_paid", v)} />
          <Field id="rc-outstanding_amount" label="Outstanding (GHS)" type="number" value={form.outstanding_amount || ""} onChange={(v) => set("outstanding_amount", v)} />
          <Field id="rc-amount_requested" label="Amount Requested (GHS) *" type="number" value={form.amount_requested || ""} onChange={(v) => set("amount_requested", v)} />
          <Field id="rc-deadline" label="Deadline" type="date" value={form.deadline || ""} onChange={(v) => set("deadline", v)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Need Statement</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Field id="rc-reason" label="Reason for support *" textarea value={form.reason || ""} onChange={(v) => set("reason", v)} />
          <Field id="rc-urgency" label="Urgency (low / medium / high)" value={form.urgency || ""} onChange={(v) => set("urgency", v)} />
          <Field id="rc-previous_support_history" label="Previous support history" textarea value={form.previous_support_history || ""} onChange={(v) => set("previous_support_history", v)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("/nugs/rentcare")}>Cancel</Button>
        <Button onClick={onSubmit} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Draft
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        After saving, you will review the legal notice and pay the application fee. Your application is not submitted until payment succeeds.
      </p>
    </div>
  );
}

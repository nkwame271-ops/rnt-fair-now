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

  const T = ({ k, label, type = "text", textarea = false }: any) => (
    <Field
      id={`rc-${k}`}
      label={label}
      type={type}
      textarea={textarea}
      value={form[k] || ""}
      onChange={(v: string) => set(k, v)}
    />
  );

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New RentCare Application</h1>
        <p className="text-sm text-muted-foreground">{RENTCARE_PROGRAMME_NAME}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <T k="full_name" label="Full Name *" />
          <T k="phone" label="Phone *" />
          <T k="email" label="Email *" />
          <T k="ghana_card_no" label="Ghana Card No *" />
          <T k="gender" label="Gender" />
          <T k="region" label="Region" />
          <div className="sm:col-span-2"><T k="address" label="Address" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Student Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <T k="institution" label="Institution *" />
          <T k="campus" label="Campus" />
          <T k="student_id_code" label="Student ID *" />
          <T k="programme" label="Programme" />
          <T k="level" label="Level" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Accommodation Details</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <T k="accommodation_type" label="Type (hostel / hall / private)" />
          <T k="provider_name" label="Provider Name" />
          <T k="provider_contact" label="Provider Contact" />
          <T k="accommodation_location" label="Location" />
          <T k="total_fee" label="Total Fee (GHS)" type="number" />
          <T k="amount_paid" label="Amount Paid (GHS)" type="number" />
          <T k="outstanding_amount" label="Outstanding (GHS)" type="number" />
          <T k="amount_requested" label="Amount Requested (GHS) *" type="number" />
          <T k="deadline" label="Deadline" type="date" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Need Statement</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <T k="reason" label="Reason for support *" textarea />
          <T k="urgency" label="Urgency (low / medium / high)" />
          <T k="previous_support_history" label="Previous support history" textarea />
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

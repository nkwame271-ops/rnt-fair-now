import { useEffect, useState } from "react";
import { useDeveloperOrg } from "@/hooks/useDeveloperOrg";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function DeveloperSettings() {
  const qc = useQueryClient();
  const { data: org } = useDeveloperOrg();
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", website_url: "", agency_type: "", intended_use_case: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name ?? "",
        contact_email: org.contact_email ?? "",
        contact_phone: org.contact_phone ?? "",
        website_url: org.website_url ?? "",
        agency_type: org.agency_type ?? "",
        intended_use_case: org.intended_use_case ?? "",
      });
    }
  }, [org]);

  const save = async () => {
    if (!org) return;
    setBusy(true);
    const { error } = await supabase.from("developer_organizations" as any)
      .update(form).eq("id", org.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["developer-org"] });
  };

  if (!org) return null;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Organization details.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Organization</CardTitle><CardDescription>Keep your contact info up to date — regulators may reach out about your API access.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Contact email</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
            <div><Label>Contact phone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Website</Label><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://" /></div>
            <div><Label>Agency type</Label><Input value={form.agency_type} onChange={(e) => setForm({ ...form, agency_type: e.target.value })} /></div>
          </div>
          <div><Label>Use case</Label><Textarea rows={3} value={form.intended_use_case} onChange={(e) => setForm({ ...form, intended_use_case: e.target.value })} /></div>
          <Button onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}

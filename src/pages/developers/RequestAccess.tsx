import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { useDeveloperOrg } from "@/hooks/useDeveloperOrg";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function RequestAccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: org } = useDeveloperOrg();
  const [form, setForm] = useState({
    intended_volume_monthly: "",
    agency_type: "",
    justification: "",
    contact_email: "",
    contact_phone: "",
    accept_dsa: false,
  });
  const [scopes, setScopes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { data: scopeList = [] } = useQuery({
    queryKey: ["scopes-public"],
    queryFn: async () => {
      const { data } = await supabase.from("api_scopes" as any)
        .select("*").eq("is_active", true).order("category");
      return (data as any[]) || [];
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["access-requests", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data } = await supabase.from("api_access_requests" as any)
        .select("*").eq("org_id", org!.id).order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const toggle = (s: string) =>
    setScopes((cur) => cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !user) return;
    if (scopes.length === 0) return toast.error("Select at least one scope");
    if (!form.accept_dsa) return toast.error("You must accept the Data Sharing Agreement");
    setBusy(true);
    const { error } = await supabase.from("api_access_requests" as any).insert({
      org_id: org.id,
      created_by: user.id,
      requested_environment: "live",
      requested_scopes: scopes,
      intended_volume_monthly: form.intended_volume_monthly ? Number(form.intended_volume_monthly) : null,
      agency_type: form.agency_type || org.agency_type,
      justification: form.justification,
      contact_email: form.contact_email || org.contact_email,
      contact_phone: form.contact_phone || org.contact_phone,
      status: "pending",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Request submitted — an admin will review it.");
    navigate("/developers/dashboard/request-status");
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Request live API access</title></Helmet>
      <div className="mx-auto max-w-3xl px-4 py-8">
        <Link to="/developers/dashboard" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:underline mb-4">
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>

        {existing.some((r) => r.status === "pending") && (
          <Card className="mb-4 border-amber-300 bg-amber-50/50">
            <CardContent className="p-4 text-sm">
              You already have a pending request from {new Date(existing.find((r) => r.status === "pending")!.created_at).toLocaleDateString()}.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Request live API access</CardTitle>
            <CardDescription>A regulator reviews each request. We'll email you when there's a decision.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <Label>Requested scopes</Label>
                <div className="grid sm:grid-cols-2 gap-2 mt-2">
                  {scopeList.map((s: any) => (
                    <label key={s.scope_key} className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-accent">
                      <Checkbox checked={scopes.includes(s.scope_key)} onCheckedChange={() => toggle(s.scope_key)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                        <code className="text-[10px]">{s.scope_key}</code>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Expected monthly call volume</Label>
                  <Input type="number" min={0} value={form.intended_volume_monthly} onChange={(e) => setForm({ ...form, intended_volume_monthly: e.target.value })} placeholder="e.g. 50000" />
                </div>
                <div>
                  <Label>Agency type</Label>
                  <Input value={form.agency_type} onChange={(e) => setForm({ ...form, agency_type: e.target.value })} placeholder={org?.agency_type ?? "Government / Bank / Insurer"} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Primary contact email</Label>
                  <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder={org?.contact_email} />
                </div>
                <div>
                  <Label>Primary contact phone</Label>
                  <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder={org?.contact_phone ?? ""} />
                </div>
              </div>

              <div>
                <Label>Justification</Label>
                <Textarea rows={4} value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} required minLength={20} placeholder="What will you do with this data? Who is the end user?" />
              </div>

              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={form.accept_dsa} onCheckedChange={(c) => setForm({ ...form, accept_dsa: !!c })} />
                <span>I have read and accept the Data Sharing Agreement on behalf of <strong>{org?.name}</strong>.</span>
              </label>

              <Button type="submit" disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Submit request</Button>
            </form>
          </CardContent>
        </Card>

        {existing.length > 0 && (
          <Card className="mt-6">
            <CardHeader><CardTitle>Past requests</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {existing.map((r) => (
                <div key={r.id} className="border rounded-md p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm">{new Date(r.created_at).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{(r.requested_scopes ?? []).join(", ")}</p>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "denied" ? "destructive" : "secondary"}>{r.status}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

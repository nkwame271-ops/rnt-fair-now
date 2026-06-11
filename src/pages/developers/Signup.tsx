import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Loader2, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  org_name: z.string().trim().min(2).max(200),
  contact_phone: z.string().trim().max(20).optional(),
  agency_type: z.string().max(120).optional(),
  intended_use_case: z.string().trim().min(10).max(1000),
});

export default function DeveloperSignup() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: paused } = useQuery({
    queryKey: ["developer-signups-paused"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config")
        .select("config_value").eq("config_key", "developer_signups_paused").maybeSingle();
      return !!(data?.config_value as any)?.paused;
    },
  });
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    org_name: "",
    contact_phone: "",
    agency_type: "",
    intended_use_case: "",
  });

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)[0]?.[0];
      toast.error(first || "Please check the form");
      return;
    }
    setSubmitting(true);
    try {
      const { data: signUp, error: signErr } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/developers/dashboard`,
          data: { full_name: parsed.data.full_name, intended_role: "developer" },
        },
      });
      if (signErr) throw signErr;
      const userId = signUp.user?.id;
      if (!userId) {
        toast.success("Check your email to confirm your account.");
        navigate("/developers/login");
        return;
      }

      // Assign developer role
      await supabase.from("user_roles").insert({ user_id: userId, role: "developer" as any });

      // Create organization
      const { data: org, error: orgErr } = await supabase
        .from("developer_organizations" as any)
        .insert({
          name: parsed.data.org_name,
          contact_email: parsed.data.email,
          contact_phone: parsed.data.contact_phone || null,
          agency_type: parsed.data.agency_type || null,
          intended_use_case: parsed.data.intended_use_case,
          owner_user_id: userId,
        })
        .select()
        .single();
      if (orgErr) throw orgErr;

      // Add owner as member
      await supabase.from("developer_org_members" as any).insert({
        org_id: (org as any).id,
        user_id: userId,
        member_role: "owner",
      });

      toast.success("Account created. Your sandbox key will be ready once you verify your email and log in.");
      navigate("/developers/login?signup=ok");
    } catch (e: any) {
      toast.error(e.message ?? "Signup failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Create developer account — Rent Control Ghana</title></Helmet>
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link to="/developers" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Rent Control Ghana — Developers</span>
          </Link>
          <Link to="/developers/login" className="text-sm text-primary hover:underline">Log in instead</Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        {paused ? (
          <Alert>
            <PauseCircle className="h-4 w-4" />
            <AlertTitle>Signups temporarily closed</AlertTitle>
            <AlertDescription>
              New developer signups are paused while we onboard our first wave of partners.
              Existing developers can still log in. Email <a className="underline" href="mailto:api@rentcontrolghana.com">api@rentcontrolghana.com</a> if you need access urgently.
            </AlertDescription>
          </Alert>
        ) : (
        <Card>
          <CardHeader>
            <CardTitle>Create your developer account</CardTitle>
            <CardDescription>
              You'll get a sandbox API key automatically. Live access requires admin approval (1–3 business days).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="full_name">Your name</Label>
                  <Input id="full_name" value={form.full_name} onChange={onChange("full_name")} required />
                </div>
                <div>
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" value={form.email} onChange={onChange("email")} required />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Password (min 8 chars)</Label>
                <Input id="password" type="password" value={form.password} onChange={onChange("password")} required minLength={8} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="org_name">Organization name</Label>
                  <Input id="org_name" value={form.org_name} onChange={onChange("org_name")} required />
                </div>
                <div>
                  <Label htmlFor="contact_phone">Contact phone (optional)</Label>
                  <Input id="contact_phone" value={form.contact_phone} onChange={onChange("contact_phone")} />
                </div>
              </div>
              <div>
                <Label htmlFor="agency_type">Agency type (optional)</Label>
                <Input id="agency_type" placeholder="e.g. Government agency, Bank, Insurer" value={form.agency_type} onChange={onChange("agency_type")} />
              </div>
              <div>
                <Label htmlFor="intended_use_case">What will you build?</Label>
                <Textarea id="intended_use_case" rows={4} value={form.intended_use_case} onChange={onChange("intended_use_case")} required minLength={10} />
              </div>
              <p className="text-xs text-muted-foreground">
                By creating an account you agree to our terms of service. Live API access also requires
                a signed Data Sharing Agreement.
              </p>
              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create account
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function DeveloperLogin() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/developers/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate(redirect, { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet><title>Developer login — Rent Control Ghana</title></Helmet>
      <header className="border-b bg-card">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between">
          <Link to="/developers" className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Rent Control Ghana — Developers</span>
          </Link>
          <Link to="/developers/signup" className="text-sm text-primary hover:underline">Create account</Link>
        </div>
      </header>
      <main className="mx-auto max-w-md px-4 py-12 space-y-4">
        {params.get("signup") === "ok" && (
          <Alert className="border-emerald-300 bg-emerald-50/50">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            <AlertTitle>Account created — verify your email</AlertTitle>
            <AlertDescription>
              We sent you a verification link. After you verify and log in, your sandbox API key is issued automatically.
              To call production data, you'll then request live access — an admin reviews each request within 1–3 business days.
            </AlertDescription>
          </Alert>
        )}
        <Card>
          <CardHeader><CardTitle>Log in</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" disabled={busy} className="w-full">
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Log in
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

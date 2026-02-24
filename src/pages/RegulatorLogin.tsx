import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, Mail, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const RegulatorLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Check if user has regulator role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "regulator")
      .maybeSingle();

    if (!roleData) {
      await supabase.auth.signOut();
      toast.error("Access denied. This login is for Rent Control Office staff only.");
      setLoading(false);
      return;
    }

    toast.success("Welcome, Regulator!");
    navigate("/regulator/dashboard");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12">
        <div className="text-primary-foreground max-w-md">
          <Shield className="h-12 w-12 text-secondary mb-6" />
          <h2 className="text-3xl font-bold mb-4">Rent Control Office</h2>
          <p className="text-primary-foreground/80 text-lg">
            Administrative access to the national rent regulation platform. Monitor compliance, review complaints, and generate reports.
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Back</span>
          </button>

          <div className="mb-8">
            <div className="inline-block px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold mb-3">
              REGULATOR ACCESS
            </div>
            <h1 className="text-3xl font-bold text-foreground">Staff Login</h1>
            <p className="text-muted-foreground mt-1">Sign in with your Rent Control Office credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" placeholder="admin@rentcontrol.gov.gh" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default RegulatorLogin;

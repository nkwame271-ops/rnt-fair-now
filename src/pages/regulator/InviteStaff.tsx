import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const InviteStaff = () => {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setCreated(null);

    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: { email, fullName, password },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Staff account created for ${email}`);
      setCreated(email);
      setEmail("");
      setFullName("");
      setPassword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create staff account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <UserPlus className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Invite Staff</h1>
        </div>
        <p className="text-muted-foreground">
          Create new Rent Control Office staff accounts with regulator access.
        </p>
      </motion.div>

      {created && (
        <div className="flex items-start gap-3 bg-success/10 border border-success/20 rounded-xl p-4">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground text-sm">Account Created</p>
            <p className="text-muted-foreground text-sm">
              <strong>{created}</strong> can now log in at the Staff Login page.
            </p>
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl p-6 shadow-elevated border border-border"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Kofi Mensah"
                className="pl-10"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="staff@rentcontrol.gov.gh"
                className="pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Temporary Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Min 6 characters"
                className="pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The new staff member should change this password after first login.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> Create Staff Account</>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default InviteStaff;

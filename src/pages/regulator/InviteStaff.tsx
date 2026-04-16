import { useState } from "react";
import { motion } from "framer-motion";
import { UserPlus, Mail, Lock, User, Loader2, CheckCircle2, Shield, Building2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile, GHANA_REGIONS, getOfficesForRegion, FEATURE_ROUTE_MAP } from "@/hooks/useAdminProfile";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import LogoLoader from "@/components/LogoLoader";

const InviteStaff = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const { flags, loading: flagsLoading } = useAllFeatureFlags();
  const [adminType, setAdminType] = useState<"main_admin" | "sub_admin">("sub_admin");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  if (profileLoading || flagsLoading) return <LogoLoader message="Loading..." />;
  if (!profile?.isMainAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">Access Restricted</h1>
        <p className="text-muted-foreground">Only Main Admins can invite staff.</p>
      </div>
    );
  }

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const office = regionOffices.find(o => o.id === officeId);
  const allFeatureKeys = Object.keys(FEATURE_ROUTE_MAP);

  const toggleFeature = (key: string) => {
    setSelectedFeatures(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (adminType === "sub_admin" && !officeId) {
      toast.error("Please select an office for the Sub Admin");
      return;
    }
    setLoading(true);
    setCreated(null);

    try {
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: {
          email,
          fullName,
          password,
          adminType,
          officeId: adminType === "sub_admin" ? officeId : null,
          officeName: adminType === "sub_admin" ? office?.name : null,
          allowedFeatures: selectedFeatures,
        },
      });

      // data?.error holds the real message even on non-2xx responses
      if (data?.error) throw new Error(data.error);
      if (error) throw new Error(error.message);

      toast.success(data?.message || `Staff account created for ${email}`);
      setCreated(email);
      setEmail("");
      setFullName("");
      setPassword("");
      setSelectedRegion("");
      setOfficeId("");
      setSelectedFeatures([]);
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
          Create new Rent Control Office staff accounts.
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

      {/* Admin Type Tabs */}
      <div className="flex gap-2">
        <Button
          variant={adminType === "main_admin" ? "default" : "outline"}
          onClick={() => setAdminType("main_admin")}
          className="flex-1"
        >
          <Shield className="h-4 w-4 mr-2" />
          Invite Main Admin
        </Button>
        <Button
          variant={adminType === "sub_admin" ? "default" : "outline"}
          onClick={() => setAdminType("sub_admin")}
          className="flex-1"
        >
          <Building2 className="h-4 w-4 mr-2" />
          Invite Sub Admin
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl p-6 shadow-elevated border border-border"
      >
        <div className="mb-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          {adminType === "main_admin" ? (
            <>
              <strong className="text-foreground">Main Admin</strong> — Select which features this Main Admin can access. Leave all unchecked for full access.
            </>
          ) : (
            <>
              <strong className="text-foreground">Sub Admin</strong> — Limited to assigned office and selected features. Cannot access Engine Room or invite staff unless granted.
            </>
          )}
        </div>

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

          {adminType === "sub_admin" && (
            <>
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setOfficeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRegion && (
                <div className="space-y-2">
                  <Label>Assigned Office</Label>
                  <Select value={officeId} onValueChange={setOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                    <SelectContent>
                      {regionOffices.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {/* Feature selection — shown for BOTH admin types */}
          <div className="space-y-2">
            <Label>Allowed Features</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {adminType === "main_admin"
                ? "Select features this Main Admin can access. Leave all unchecked for full access (backward compatible)."
                : "Select which features this Sub Admin can access."}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto border border-border rounded-lg p-3">
              {allFeatureKeys.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 rounded px-2 py-1.5">
                  <Checkbox
                    checked={selectedFeatures.includes(key)}
                    onCheckedChange={() => toggleFeature(key)}
                  />
                  <span className="capitalize text-card-foreground">{key.replace(/_/g, " ")}</span>
                </label>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...</>
            ) : (
              <><UserPlus className="h-4 w-4 mr-2" /> Create {adminType === "main_admin" ? "Main Admin" : "Sub Admin"} Account</>
            )}
          </Button>
        </form>
      </motion.div>
    </div>
  );
};

export default InviteStaff;

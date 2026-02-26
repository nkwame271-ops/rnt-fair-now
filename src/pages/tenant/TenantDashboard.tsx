import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Calculator, Store, CreditCard, AlertTriangle, CheckCircle2, Clock, ArrowRight, Shield, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const quickActions = [
  { to: "/tenant/file-complaint", label: "File Complaint", icon: FileText, color: "bg-destructive/10 text-destructive" },
  { to: "/tenant/rent-checker", label: "Check Rent", icon: Calculator, color: "bg-primary/10 text-primary" },
  { to: "/tenant/marketplace", label: "Marketplace", icon: Store, color: "bg-secondary/20 text-secondary-foreground" },
  { to: "/tenant/payments", label: "Pay Rent", icon: CreditCard, color: "bg-info/10 text-info" },
];

const TenantDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [activeCases, setActiveCases] = useState(0);
  const [registrationFeePaid, setRegistrationFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [tenancy, setTenancy] = useState<{ propertyAddress: string; monthlyRent: number; landlordName: string; paidMonths: number; totalMonths: number; nextTax: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
      setProfileName(profile?.full_name || "Tenant");

      // Check registration fee
      const { data: tenantRecord } = await supabase.from("tenants").select("registration_fee_paid").eq("user_id", user.id).maybeSingle();
      setRegistrationFeePaid(tenantRecord?.registration_fee_paid ?? true);

      const { count } = await supabase.from("complaints").select("id", { count: "exact", head: true }).eq("tenant_user_id", user.id).not("status", "in", '("resolved","closed")');
      setActiveCases(count || 0);

      const { data: ts } = await supabase
        .from("tenancies")
        .select("*, unit:units(unit_name, unit_type, property_id)")
        .eq("tenant_user_id", user.id)
        .in("status", ["active", "pending"])
        .limit(1);

      if (ts && ts.length > 0) {
        const t = ts[0] as any;
        const { data: prop } = await supabase.from("properties").select("address").eq("id", t.unit.property_id).single();
        const { data: landlord } = await supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).single();
        const { data: payments } = await supabase.from("rent_payments").select("status, tenant_marked_paid, landlord_confirmed, tax_amount").eq("tenancy_id", t.id).order("due_date");

        const paid = (payments || []).filter((p: any) => p.tenant_marked_paid || p.landlord_confirmed || p.status === "confirmed").length;
        const nextP = (payments || []).find((p: any) => !p.tenant_marked_paid && !p.landlord_confirmed && p.status !== "confirmed");

        setTenancy({
          propertyAddress: prop?.address || "",
          monthlyRent: t.agreed_rent,
          landlordName: landlord?.full_name || "Unknown",
          paidMonths: paid,
          totalMonths: (payments || []).length,
          nextTax: nextP ? nextP.tax_amount : 0,
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handlePayRegistrationFee = async () => {
    setPayingFee(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "tenant_registration" },
      });
      if (error) throw new Error(error.message || "Payment initiation failed");
      if (data?.error) throw new Error(data.error);
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate payment");
      setPayingFee(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Registration Fee Banner */}
      {!registrationFeePaid && (
        <Alert className="border-warning bg-warning/10 border-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <AlertTitle className="text-warning font-semibold">Registration Fee Unpaid</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
            <span className="text-muted-foreground">Your registration fee (GH₵ 2) is unpaid. Pay now to activate your Tenant ID and access all platform features.</span>
            <Button onClick={handlePayRegistrationFee} disabled={payingFee} size="sm" className="shrink-0">
              <CreditCard className="mr-2 h-4 w-4" />
              {payingFee ? "Redirecting..." : "Pay GH₵ 2 Now"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Welcome, {profileName.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your rental overview</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Cases", value: activeCases, icon: AlertTriangle, color: "text-destructive" },
          { label: "Months Valid", value: tenancy ? `${tenancy.paidMonths}/${tenancy.totalMonths}` : "—", icon: Shield, color: "text-success" },
          { label: "Months Pending", value: tenancy ? tenancy.totalMonths - tenancy.paidMonths : "—", icon: Clock, color: "text-warning" },
          { label: "Next Tax Due", value: tenancy?.nextTax ? `GH₵${tenancy.nextTax}` : "—", icon: CreditCard, color: "text-info" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link key={action.to} to={action.to} className="group bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-all">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color} mb-3`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">{action.label}</div>
            </Link>
          ))}
        </div>
      </div>

      {tenancy && (
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Your Tenancy Agreement</h2>
            <Link to="/tenant/payments" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">Pay rent <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm mb-4">
            <div><div className="text-muted-foreground">Property</div><div className="font-semibold text-card-foreground">{tenancy.propertyAddress}</div></div>
            <div><div className="text-muted-foreground">Monthly Rent</div><div className="font-semibold text-card-foreground">GH₵ {tenancy.monthlyRent.toLocaleString()}</div></div>
            <div><div className="text-muted-foreground">Landlord</div><div className="font-semibold text-card-foreground">{tenancy.landlordName}</div></div>
            <div><div className="text-muted-foreground">Status</div><div className="inline-flex items-center gap-1 text-success font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Active</div></div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{tenancy.paidMonths} of {tenancy.totalMonths} months validated</span><span>{tenancy.totalMonths > 0 ? Math.round((tenancy.paidMonths / tenancy.totalMonths) * 100) : 0}%</span></div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${tenancy.totalMonths > 0 ? (tenancy.paidMonths / tenancy.totalMonths) * 100 : 0}%` }} />
            </div>
          </div>
          {tenancy.totalMonths - tenancy.paidMonths > 0 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-warning">
              <Clock className="h-3.5 w-3.5" />
              <span>{tenancy.totalMonths - tenancy.paidMonths} month(s) pending — pay the 8% tax to validate</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TenantDashboard;

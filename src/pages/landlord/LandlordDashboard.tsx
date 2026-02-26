import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Users, AlertTriangle, PlusCircle, ArrowRight, Shield, XCircle, Loader2, CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const LandlordDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [registrationFeePaid, setRegistrationFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [stats, setStats] = useState({ properties: 0, totalUnits: 0, occupiedUnits: 0, pendingTenancies: 0, validMonths: 0, pendingMonths: 0 });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Check registration fee
      const { data: landlordRecord } = await supabase.from("landlords").select("registration_fee_paid").eq("user_id", user.id).maybeSingle();
      setRegistrationFeePaid(landlordRecord?.registration_fee_paid ?? true);

      const { data: props } = await supabase.from("properties").select("id").eq("landlord_user_id", user.id);
      const propIds = (props || []).map(p => p.id);

      let totalUnits = 0, occupiedUnits = 0;
      if (propIds.length > 0) {
        const { data: units } = await supabase.from("units").select("status").in("property_id", propIds);
        totalUnits = (units || []).length;
        occupiedUnits = (units || []).filter(u => u.status === "occupied").length;
      }

      const { data: tenancies } = await supabase.from("tenancies").select("id, status").eq("landlord_user_id", user.id);
      const pendingTenancies = (tenancies || []).filter(t => t.status === "pending").length;
      const tenancyIds = (tenancies || []).map(t => t.id);

      let validMonths = 0, pendingMonths = 0;
      if (tenancyIds.length > 0) {
        const { data: payments } = await supabase.from("rent_payments").select("status, tenant_marked_paid, landlord_confirmed").in("tenancy_id", tenancyIds);
        validMonths = (payments || []).filter(p => p.landlord_confirmed || p.status === "confirmed").length;
        pendingMonths = (payments || []).filter(p => !p.landlord_confirmed && p.status !== "confirmed").length;
      }

      setStats({ properties: (props || []).length, totalUnits, occupiedUnits, pendingTenancies, validMonths, pendingMonths });
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handlePayRegistrationFee = async () => {
    setPayingFee(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "landlord_registration" },
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
            <span className="text-muted-foreground">Your registration fee (GH₵ 2) is unpaid. Pay now to activate your Landlord ID and access all platform features.</span>
            <Button onClick={handlePayRegistrationFee} disabled={payingFee} size="sm" className="shrink-0">
              <CreditCard className="mr-2 h-4 w-4" />
              {payingFee ? "Redirecting..." : "Pay GH₵ 2 Now"}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Landlord Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your properties and stay compliant</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Properties", value: stats.properties, icon: Building2, color: "text-primary" },
          { label: "Total Units", value: stats.totalUnits, icon: Building2, color: "text-info" },
          { label: "Tenants", value: stats.occupiedUnits, icon: Users, color: "text-success" },
          { label: "Pending Agreements", value: stats.pendingTenancies, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/landlord/register-property" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated transition-all">
          <PlusCircle className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">Register New Property</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a new property with units and pricing</p>
        </Link>
        <Link to="/landlord/my-properties" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated transition-all">
          <Building2 className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">View Properties</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage existing properties and tenants</p>
        </Link>
      </div>

      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Payment Validity Overview</h2>
          <Link to="/landlord/agreements" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center">
            <Shield className="h-5 w-5 text-success mx-auto mb-1" />
            <div className="text-2xl font-bold text-success">{stats.validMonths}</div>
            <div className="text-xs text-muted-foreground">Confirmed Payments</div>
          </div>
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-center">
            <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
            <div className="text-2xl font-bold text-destructive">{stats.pendingMonths}</div>
            <div className="text-xs text-muted-foreground">Pending Payments</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandlordDashboard;

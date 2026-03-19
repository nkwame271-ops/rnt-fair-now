import { useEffect, useState } from "react";
import { useFeeConfig, useFeatureFlag } from "@/hooks/useFeatureFlag";
import LogoLoader from "@/components/LogoLoader";
import { Building2, Users, AlertTriangle, PlusCircle, ArrowRight, Shield, XCircle, CreditCard, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import AnimatedCounter from "@/components/AnimatedCounter";
import { getTimeGreeting } from "@/lib/greeting";
import { Badge } from "@/components/ui/badge";

const LandlordDashboard = () => {
  const { user } = useAuth();
  const { amount: regFee } = useFeeConfig("landlord_registration_fee");
  const { enabled: registerPropertyEnabled } = useFeatureFlag("register_property");
  const { enabled: declareExistingEnabled } = useFeatureFlag("declare_existing_tenancy");
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [registrationFeePaid, setRegistrationFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [complianceScore, setComplianceScore] = useState(100);
  const [tenancyBreakdown, setTenancyBreakdown] = useState({ active: 0, pending: 0, expired: 0, existing: 0 });
  const [stats, setStats] = useState({ properties: 0, totalUnits: 0, occupiedUnits: 0, pendingTenancies: 0, validMonths: 0, pendingMonths: 0 });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Parallel fetch for independent queries
      const [profileRes, landlordRes, propsRes, tenanciesRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("landlords").select("registration_fee_paid, compliance_score").eq("user_id", user.id).maybeSingle(),
        supabase.from("properties").select("id").eq("landlord_user_id", user.id),
        supabase.from("tenancies").select("id, status").eq("landlord_user_id", user.id),
      ]);

      setProfileName(profileRes.data?.full_name || "Landlord");
      setRegistrationFeePaid(landlordRes.data?.registration_fee_paid ?? true);
      setComplianceScore((landlordRes.data as any)?.compliance_score ?? 100);

      const props = propsRes.data || [];
      const propIds = props.map(p => p.id);
      const tenancies = tenanciesRes.data || [];
      const tenancyIds = tenancies.map(t => t.id);

      // Parallel fetch for dependent queries
      const [unitsRes, paymentsRes] = await Promise.all([
        propIds.length > 0
          ? supabase.from("units").select("status").in("property_id", propIds)
          : Promise.resolve({ data: [] }),
        tenancyIds.length > 0
          ? supabase.from("rent_payments").select("status, tenant_marked_paid, landlord_confirmed").in("tenancy_id", tenancyIds)
          : Promise.resolve({ data: [] }),
      ]);

      const units = unitsRes.data || [];
      const totalUnits = units.length;
      const occupiedUnits = units.filter((u: any) => u.status === "occupied").length;

      const pendingTenancies = tenancies.filter(t => t.status === "pending").length;
      const active = tenancies.filter(t => t.status === "active").length;
      const expired = tenancies.filter(t => t.status === "expired" || t.status === "terminated").length;
      const existing = tenancies.filter(t => ["existing_declared", "awaiting_verification", "verified_existing"].includes(t.status)).length;
      setTenancyBreakdown({ active, pending: pendingTenancies, expired, existing });

      const payments = paymentsRes.data || [];
      const validMonths = payments.filter((p: any) => p.landlord_confirmed || p.status === "confirmed").length;
      const pendingMonths = payments.filter((p: any) => !p.landlord_confirmed && p.status !== "confirmed").length;

      setStats({ properties: props.length, totalUnits, occupiedUnits, pendingTenancies, validMonths, pendingMonths });
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

  if (loading) return <LogoLoader message="Loading dashboard..." />;

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-8">
        {!registrationFeePaid && (
          <Alert className="border-warning bg-warning/10 border-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <AlertTitle className="text-warning font-semibold">Registration Fee Unpaid</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
              <span className="text-muted-foreground">Your registration fee (GH₵ {regFee.toFixed(0)}) is unpaid. Pay now to activate your Landlord ID and access all platform features.</span>
              <Button onClick={handlePayRegistrationFee} disabled={payingFee} size="sm" className="shrink-0">
                <CreditCard className="mr-2 h-4 w-4" />
                {payingFee ? "Redirecting..." : `Pay GH₵ ${regFee.toFixed(0)} Now`}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{getTimeGreeting(profileName)}</h1>
            <p className="text-muted-foreground mt-1">Manage your properties and stay compliant</p>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-card border border-border text-center">
            <Award className={`h-6 w-6 mx-auto mb-1 ${complianceScore >= 80 ? "text-success" : complianceScore >= 50 ? "text-warning" : "text-destructive"}`} />
            <div className={`text-2xl font-bold ${complianceScore >= 80 ? "text-success" : complianceScore >= 50 ? "text-warning" : "text-destructive"}`}>{complianceScore}%</div>
            <div className="text-xs text-muted-foreground">Compliance Score</div>
          </div>
        </div>

        <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Properties", value: stats.properties, icon: Building2, color: "text-primary" },
            { label: "Total Units", value: stats.totalUnits, icon: Building2, color: "text-info" },
            { label: "Tenants", value: stats.occupiedUnits, icon: Users, color: "text-success" },
            { label: "Pending Agreements", value: stats.pendingTenancies, icon: AlertTriangle, color: "text-destructive" },
          ].map((stat) => (
            <StaggeredItem key={stat.label}>
              <div className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <div className="text-2xl font-bold text-card-foreground">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </StaggeredItem>
          ))}
        </StaggeredGrid>

        {/* Tenancy Status Breakdown */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Tenancy Status Breakdown</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-success">{tenancyBreakdown.active}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
            <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-warning">{tenancyBreakdown.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-destructive">{tenancyBreakdown.expired}</div>
              <div className="text-xs text-muted-foreground">Expired/Terminated</div>
            </div>
            <div className="bg-info/5 border border-info/20 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-info">{tenancyBreakdown.existing}</div>
              <div className="text-xs text-muted-foreground">Existing Migration</div>
            </div>
          </div>
        </div>

        <StaggeredGrid className="grid sm:grid-cols-2 gap-4">
          <StaggeredItem>
            <Link to="/landlord/register-property" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated hover:-translate-y-0.5 transition-all block">
              <PlusCircle className="h-6 w-6 text-primary mb-3" />
              <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">Register New Property</h3>
              <p className="text-sm text-muted-foreground mt-1">Add a new property with units and pricing</p>
            </Link>
          </StaggeredItem>
          <StaggeredItem>
            <Link to="/landlord/declare-existing-tenancy" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated hover:-translate-y-0.5 transition-all block">
              <Building2 className="h-6 w-6 text-info mb-3" />
              <h3 className="font-semibold text-card-foreground group-hover:text-info transition-colors">Declare Existing Tenancy</h3>
              <p className="text-sm text-muted-foreground mt-1">Migrate a tenancy that started before the platform</p>
            </Link>
          </StaggeredItem>
        </StaggeredGrid>

        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Payment Validity Overview</h2>
            <Link to="/landlord/agreements" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">View all <ArrowRight className="h-3 w-3" /></Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center">
              <Shield className="h-5 w-5 text-success mx-auto mb-1" />
              <div className="text-2xl font-bold text-success"><AnimatedCounter value={stats.validMonths} /></div>
              <div className="text-xs text-muted-foreground">Confirmed Payments</div>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-center">
              <XCircle className="h-5 w-5 text-destructive mx-auto mb-1" />
              <div className="text-2xl font-bold text-destructive"><AnimatedCounter value={stats.pendingMonths} /></div>
              <div className="text-xs text-muted-foreground">Pending Payments</div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default LandlordDashboard;

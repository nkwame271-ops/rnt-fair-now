import { useEffect, useState } from "react";
import { useFeeConfig } from "@/hooks/useFeatureFlag";
import { AlertTriangle, CheckCircle2, Clock, ArrowRight, Shield, Loader2, RefreshCw, CreditCard } from "lucide-react";
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
import TenancyCard, { TenancyCardData } from "@/components/TenancyCard";
import { differenceInDays } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";


const TenantDashboard = () => {
  const { user } = useAuth();
  const { amount: regFee, enabled: regFeeEnabled } = useFeeConfig("tenant_registration_fee");
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState("");
  const [activeCases, setActiveCases] = useState(0);
  const [registrationFeePaid, setRegistrationFeePaid] = useState(true);
  const [payingFee, setPayingFee] = useState(false);
  const [tenancyCards, setTenancyCards] = useState<TenancyCardData[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      // Parallel fetch for independent queries
      const [profileRes, tenantRes, complaintsRes, tenanciesRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("user_id", user.id).single(),
        supabase.from("tenants").select("registration_fee_paid").eq("user_id", user.id).maybeSingle(),
        supabase.from("complaints").select("id", { count: "exact", head: true }).eq("tenant_user_id", user.id).not("status", "in", '("resolved","closed")'),
        supabase.from("tenancies").select("*, unit:units(unit_name, unit_type, property_id)").eq("tenant_user_id", user.id).in("status", ["active", "pending", "renewal_window", "existing_declared", "awaiting_verification", "verified_existing"]).order("created_at", { ascending: false }),
      ]);

      const profile = profileRes.data;
      setProfileName(profile?.full_name || "Tenant");
      setRegistrationFeePaid(tenantRes.data?.registration_fee_paid ?? true);
      setActiveCases(complaintsRes.count || 0);

      const ts = tenanciesRes.data;
      if (ts && ts.length > 0) {
        const allCards: TenancyCardData[] = [];
        for (const t of ts as any[]) {
          const [propRes, landlordRes, cardRes] = await Promise.all([
            supabase.from("properties").select("address, id, ghana_post_gps").eq("id", t.unit.property_id).single(),
            supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).single(),
            (() => {
              const ids = [t.rent_card_id, t.rent_card_id_2].filter(Boolean);
              return ids.length > 0
                ? supabase.from("rent_cards").select("id, serial_number, card_role").in("id", ids)
                : Promise.resolve({ data: [] });
            })(),
          ]);
          const prop = propRes.data;
          const landlord = landlordRes.data;
          const cards = (cardRes as any).data || [];
          const card1 = cards.find((c: any) => c.id === t.rent_card_id);
          const card2 = cards.find((c: any) => c.id === t.rent_card_id_2);

          allCards.push({
            tenancyId: t.id,
            registrationCode: t.registration_code,
            propertyId: prop?.id || "",
            digitalAddress: prop?.ghana_post_gps || "",
            landlordName: landlord?.full_name || "Unknown",
            tenantName: profile?.full_name || "Tenant",
            monthlyRent: t.agreed_rent,
            maxLawfulAdvance: t.agreed_rent * 6,
            advancePaid: t.advance_months,
            startDate: t.start_date,
            expiryDate: t.end_date,
            complianceStatus: t.compliance_status || "compliant",
            status: t.status,
            rentCardSerial: card1?.serial_number || undefined,
            rentCardSerial2: card2?.serial_number || undefined,
            rentCardRole: card1?.card_role || undefined,
            rentCardRole2: card2?.card_role || undefined,
          });
        }
        setTenancyCards(allCards);
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

  const primaryCard = tenancyCards.length > 0 ? tenancyCards[0] : null;
  const daysRemaining = primaryCard ? differenceInDays(new Date(primaryCard.expiryDate), new Date()) : 0;
  const tenancyStatus = primaryCard?.status || "pending";

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-8">
        {!registrationFeePaid && regFeeEnabled && (
          <Alert className="border-warning bg-warning/10 border-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <AlertTitle className="text-warning font-semibold">Registration Fee Unpaid</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-3 mt-1">
              <span className="text-muted-foreground">Your registration fee (GH₵ {regFee.toFixed(0)}) is unpaid. Pay now to activate your Tenant ID and access all platform features.</span>
              <Button onClick={handlePayRegistrationFee} disabled={payingFee} size="sm" className="shrink-0">
                <CreditCard className="mr-2 h-4 w-4" />
                {payingFee ? "Redirecting..." : `Pay GH₵ ${regFee.toFixed(0)} Now`}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <h1 className="text-3xl font-bold text-foreground">{getTimeGreeting(profileName)}</h1>
          <p className="text-muted-foreground mt-1">Here's your rental overview</p>
        </div>

        <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Cases", value: activeCases, icon: AlertTriangle, color: "text-destructive" },
            { label: "Tenancy Status", value: 0, icon: Shield, color: daysRemaining > 90 ? "text-success" : daysRemaining > 0 ? "text-warning" : "text-destructive", displayText: primaryCard ? (tenancyStatus === "active" ? "Active" : tenancyStatus === "renewal_window" ? "Renewal" : tenancyStatus === "expired" ? "Expired" : tenancyStatus.replace(/_/g, " ")) : "—" },
            { label: "Days Remaining", value: daysRemaining > 0 ? daysRemaining : 0, icon: Clock, color: daysRemaining > 90 ? "text-success" : daysRemaining > 0 ? "text-warning" : "text-destructive", displayText: primaryCard ? (daysRemaining > 0 ? `${daysRemaining} days` : "Expired") : "—" },
            { label: "Active Tenancies", value: tenancyCards.length, icon: CreditCard, color: "text-info", displayText: tenancyCards.length > 0 ? `${tenancyCards.length}` : "—" },
          ].map((stat) => (
            <StaggeredItem key={stat.label}>
              <div className="bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-shadow">
                <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
                <div className="text-2xl font-bold text-card-foreground">
                  {"displayText" in stat ? stat.displayText : <AnimatedCounter value={stat.value} />}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </StaggeredItem>
          ))}
        </StaggeredGrid>


        {/* Tenancy Cards */}
        {tenancyCards.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-foreground">Your Tenancy Cards ({tenancyCards.length})</h2>
               <div className="flex gap-2">
                 <Link to="/tenant/renewal">
                   <Button size="sm" variant="outline">
                     <RefreshCw className="h-3.5 w-3.5 mr-1" /> Request Renewal
                   </Button>
                 </Link>
               </div>
            </div>
            <div className="space-y-4">
              {tenancyCards.map((card) => (
                <TenancyCard key={card.tenancyId} data={card} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default TenantDashboard;

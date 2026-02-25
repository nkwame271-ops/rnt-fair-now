import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Clock, Info, Wallet, FileText, Shield, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Payment {
  id: string;
  month_label: string;
  due_date: string;
  monthly_rent: number;
  tax_amount: number;
  amount_to_landlord: number;
  status: string;
  tenant_marked_paid: boolean | null;
  landlord_confirmed: boolean | null;
}

interface Tenancy {
  id: string;
  registration_code: string;
  agreed_rent: number;
  advance_months: number;
  start_date: string;
  end_date: string;
  unit: { unit_name: string; unit_type: string };
  property: { property_name: string | null; address: string };
  landlordName: string;
  payments: Payment[];
}

const Payments = () => {
  const { user } = useAuth();
  const [tenancy, setTenancy] = useState<Tenancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("*, unit:units(unit_name, unit_type, property_id)")
        .eq("tenant_user_id", user.id)
        .in("status", ["active", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (!tenancies || tenancies.length === 0) { setLoading(false); return; }
      const t = tenancies[0] as any;

      // Get property info
      const { data: prop } = await supabase.from("properties").select("property_name, address").eq("id", t.unit.property_id).single();

      // Get landlord name
      const { data: landlordProfile } = await supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).single();

      // Get payments
      const { data: payments } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("tenancy_id", t.id)
        .order("due_date", { ascending: true });

      setTenancy({
        ...t,
        property: prop || { property_name: null, address: "" },
        landlordName: landlordProfile?.full_name || "Unknown",
        payments: (payments || []) as Payment[],
      });
      setLoading(false);
    };
    fetch();
  }, [user]);

  // Check for payment success from redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      toast.success("Payment processing! It may take a moment to confirm.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (params.get("status") === "cancelled") {
      toast.error("Payment was cancelled.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handlePayTax = async (paymentId: string) => {
    setPaying(paymentId);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "rent_tax", paymentId },
      });

      if (error) throw new Error(error.message || "Payment initiation failed");
      if (data?.error) throw new Error(data.error);

      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
      setPaying(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!tenancy) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
      <h2 className="text-xl font-bold text-foreground">No active tenancy</h2>
      <p className="text-muted-foreground mt-1">You don't have an active tenancy agreement yet.</p>
    </div>
  );

  const isPaid = (p: Payment) => p.tenant_marked_paid || p.landlord_confirmed || p.status === "confirmed";
  const nextUnpaid = tenancy.payments.find(p => !isPaid(p));
  const paidCount = tenancy.payments.filter(p => isPaid(p)).length;
  const totalMonths = tenancy.payments.length;

  // Arrears calculation
  const today = new Date();
  const overduePayments = tenancy.payments.filter(p => !isPaid(p) && new Date(p.due_date) < today);
  const totalArrears = overduePayments.reduce((sum, p) => sum + p.tax_amount, 0);
  const isOverdue = (p: Payment) => !isPaid(p) && new Date(p.due_date) < today;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pay Rent</h1>
        <p className="text-muted-foreground mt-1">Validate your tenancy by paying the 8% rent tax through Rent Control</p>
      </div>

      {/* Agreement Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-elevated border border-border">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Your Tenancy Agreement</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><div className="text-muted-foreground">Property</div><div className="font-semibold text-card-foreground">{tenancy.property.property_name || "Property"}</div><div className="text-xs text-muted-foreground">{tenancy.unit.unit_name} • {tenancy.unit.unit_type}</div></div>
          <div><div className="text-muted-foreground">Monthly Rent</div><div className="font-semibold text-card-foreground">GH₵ {tenancy.agreed_rent.toLocaleString()}</div></div>
          <div><div className="text-muted-foreground">Landlord</div><div className="font-semibold text-card-foreground">{tenancy.landlordName}</div></div>
          <div><div className="text-muted-foreground">Validity</div><div className="font-semibold text-card-foreground">{paidCount}/{totalMonths} months valid</div></div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Agreement validity</span><span>{totalMonths > 0 ? Math.round((paidCount / totalMonths) * 100) : 0}%</span></div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${totalMonths > 0 ? (paidCount / totalMonths) * 100 : 0}%` }} />
          </div>
        </div>
      </motion.div>

      {/* Arrears Warning */}
      {totalArrears > 0 && (
        <div className="flex items-start gap-2 text-xs bg-destructive/5 p-4 rounded-lg border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-destructive text-sm">Outstanding Arrears: GH₵ {totalArrears.toLocaleString()}</p>
            <p className="text-muted-foreground">You have {overduePayments.length} overdue month(s). Please settle to maintain your tenancy validity.</p>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-4 rounded-lg border border-info/20">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-sm">How rent payment works</p>
          <p>Your monthly rent of <strong>GH₵ {tenancy.agreed_rent.toLocaleString()}</strong> includes an 8% government tax of <strong>GH₵ {(tenancy.agreed_rent * 0.08).toLocaleString()}</strong>.</p>
          <p>You pay the tax through this app via Paystack. This validates your tenancy. The remaining <strong>GH₵ {(tenancy.agreed_rent * 0.92).toLocaleString()}</strong> goes directly to your landlord.</p>
        </div>
      </div>

      {/* Next Payment */}
      {nextUnpaid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-elevated border-2 border-primary/30">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Next Payment — {nextUnpaid.month_label}</h2>
          </div>
          <div className="bg-muted rounded-lg p-4 space-y-3 mb-5">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Monthly Rent</span><span className="font-semibold text-card-foreground">GH₵ {nextUnpaid.monthly_rent.toLocaleString()}</span></div>
            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-primary font-medium">→ 8% Tax (pay via Rent Control)</span><span className="text-xl font-bold text-primary">GH₵ {nextUnpaid.tax_amount.toLocaleString()}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">→ Remaining (pay landlord directly)</span><span className="font-semibold text-card-foreground">GH₵ {nextUnpaid.amount_to_landlord.toLocaleString()}</span></div>
            </div>
          </div>
          <Button className="w-full" size="lg" onClick={() => handlePayTax(nextUnpaid.id)} disabled={paying === nextUnpaid.id}>
            <CreditCard className="h-4 w-4 mr-2" />
            {paying === nextUnpaid.id ? "Redirecting..." : `Pay GH₵ ${nextUnpaid.tax_amount.toLocaleString()} via Paystack`}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">After tax payment, pay GH₵ {nextUnpaid.amount_to_landlord.toLocaleString()} directly to {tenancy.landlordName}</p>
        </motion.div>
      )}

      {/* Payment Schedule */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Payment Schedule</h2>
        <div className="space-y-2">
          {tenancy.payments.map((p) => {
            const paid = isPaid(p);
            const awaitingConfirm = p.tenant_marked_paid && !p.landlord_confirmed && p.status !== "confirmed";
            return (
              <div key={p.id} className={`bg-card rounded-xl p-4 shadow-card border flex items-center justify-between ${paid ? "border-border" : awaitingConfirm ? "border-info/30" : isOverdue(p) ? "border-destructive/30" : "border-warning/30"}`}>
                <div className="flex items-center gap-3">
                  {paid ? (
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center"><Shield className="h-4 w-4 text-success" /></div>
                  ) : awaitingConfirm ? (
                    <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center"><Clock className="h-4 w-4 text-info" /></div>
                  ) : isOverdue(p) ? (
                    <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Clock className="h-4 w-4 text-muted-foreground" /></div>
                  )}
                  <div>
                    <div className="font-semibold text-sm text-card-foreground">{p.month_label}</div>
                    <div className="text-xs text-muted-foreground">Tax: GH₵ {p.tax_amount} • Landlord: GH₵ {p.amount_to_landlord.toLocaleString()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.landlord_confirmed || p.status === "confirmed" ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full"><CheckCircle2 className="h-3 w-3" /> Confirmed</span>
                  ) : awaitingConfirm ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-info bg-info/10 px-2.5 py-1 rounded-full">Awaiting Confirmation</span>
                  ) : isOverdue(p) ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full"><AlertTriangle className="h-3 w-3" /> Overdue</span>
                  ) : nextUnpaid?.id === p.id ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">Due Now</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Upcoming</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Payments;

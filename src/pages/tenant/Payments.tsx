import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Clock, Info, Wallet, FileText, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantAgreements } from "@/data/dummyData";
import { toast } from "sonner";

const Payments = () => {
  const [paying, setPaying] = useState<string | null>(null);
  const [paidIds, setPaidIds] = useState<Set<string>>(new Set());
  const agreement = tenantAgreements[0];

  const handlePayTax = (paymentId: string, taxAmount: number) => {
    setPaying(paymentId);
    setTimeout(() => {
      setPaying(null);
      setPaidIds((prev) => new Set(prev).add(paymentId));
      toast.success("8% rent tax paid! Your tenancy is now valid for this month.");
    }, 2000);
  };

  const isPaid = (p: typeof agreement.payments[0]) => p.taxPaid || paidIds.has(p.id);
  const nextUnpaid = agreement.payments.find((p) => !isPaid(p));
  const paidCount = agreement.payments.filter((p) => isPaid(p)).length;
  const totalMonths = agreement.payments.length;

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
          <div>
            <div className="text-muted-foreground">Property</div>
            <div className="font-semibold text-card-foreground">{agreement.propertyName}</div>
            <div className="text-xs text-muted-foreground">{agreement.unitName} • {agreement.unitType}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Monthly Rent</div>
            <div className="font-semibold text-card-foreground">GH₵ {agreement.monthlyRent.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Landlord</div>
            <div className="font-semibold text-card-foreground">{agreement.landlordName}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Validity</div>
            <div className="font-semibold text-card-foreground">{paidCount}/{totalMonths} months valid</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Agreement validity</span>
            <span>{Math.round((paidCount / totalMonths) * 100)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(paidCount / totalMonths) * 100}%` }}
            />
          </div>
        </div>
      </motion.div>

      {/* How it works */}
      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-4 rounded-lg border border-info/20">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-foreground text-sm">How rent payment works</p>
          <p>Your monthly rent of <strong>GH₵ {agreement.monthlyRent.toLocaleString()}</strong> includes an 8% government tax of <strong>GH₵ {(agreement.monthlyRent * 0.08).toLocaleString()}</strong>.</p>
          <p>You pay the <strong>GH₵ {(agreement.monthlyRent * 0.08).toLocaleString()}</strong> through this app to Rent Control. This validates your tenancy for that month.</p>
          <p>The remaining <strong>GH₵ {(agreement.monthlyRent * 0.92).toLocaleString()}</strong> is paid directly to your landlord.</p>
        </div>
      </div>

      {/* Next Payment Due */}
      {nextUnpaid && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-6 shadow-elevated border-2 border-primary/30">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Next Payment — {nextUnpaid.month}</h2>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-3 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span className="font-semibold text-card-foreground">GH₵ {nextUnpaid.monthlyRent.toLocaleString()}</span>
            </div>
            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-primary font-medium">→ 8% Tax (pay via Rent Control)</span>
                <span className="text-xl font-bold text-primary">GH₵ {nextUnpaid.taxAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">→ Remaining (pay landlord directly)</span>
                <span className="font-semibold text-card-foreground">GH₵ {nextUnpaid.amountToLandlord.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <Button className="w-full" size="lg" onClick={() => handlePayTax(nextUnpaid.id, nextUnpaid.taxAmount)} disabled={paying === nextUnpaid.id}>
            <CreditCard className="h-4 w-4 mr-2" />
            {paying === nextUnpaid.id ? "Processing..." : `Pay GH₵ ${nextUnpaid.taxAmount.toLocaleString()} Tax to Rent Control`}
          </Button>

          <p className="text-xs text-muted-foreground text-center mt-3">
            After payment, pay GH₵ {nextUnpaid.amountToLandlord.toLocaleString()} directly to {agreement.landlordName}
          </p>
        </motion.div>
      )}

      {/* Payment Schedule */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Payment Schedule</h2>
        <div className="space-y-2">
          {agreement.payments.map((p) => {
            const paid = isPaid(p);
            return (
              <div key={p.id} className={`bg-card rounded-xl p-4 shadow-card border flex items-center justify-between ${paid ? "border-border" : "border-warning/30"}`}>
                <div className="flex items-center gap-3">
                  {paid ? (
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Shield className="h-4 w-4 text-success" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-sm text-card-foreground">{p.month}</div>
                    <div className="text-xs text-muted-foreground">
                      Tax: GH₵ {p.taxAmount} • Landlord: GH₵ {p.amountToLandlord.toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {paid ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="h-3 w-3" /> Valid
                    </span>
                  ) : nextUnpaid?.id === p.id ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                      Due Now
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                      Upcoming
                    </span>
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

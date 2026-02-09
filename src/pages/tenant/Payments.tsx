import { useState } from "react";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Clock, Info, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantPayments } from "@/data/dummyData";
import { toast } from "sonner";

const Payments = () => {
  const [paying, setPaying] = useState(false);
  const monthlyRent = 2500;
  const taxRate = 0.08;
  const taxAmount = monthlyRent * taxRate;
  const total = monthlyRent + taxAmount;
  const nextPayment = tenantPayments.find((p) => p.status === "Pending");

  const handlePay = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      toast.success("Payment processed successfully!");
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Payments</h1>
        <p className="text-muted-foreground mt-1">Pay rent and government tax from one place</p>
      </div>

      {/* Payment Card */}
      {nextPayment && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-elevated border border-border">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-card-foreground">Next Payment Due</h2>
            <span className="ml-auto text-sm text-muted-foreground">{nextPayment.date}</span>
          </div>

          <div className="bg-muted rounded-lg p-4 space-y-3 mb-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly Rent</span>
              <span className="font-semibold text-card-foreground">GH₵ {monthlyRent.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Government Tax (8%)</span>
              <span className="font-semibold text-card-foreground">GH₵ {taxAmount.toLocaleString()}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="font-semibold text-card-foreground">Total</span>
              <span className="text-xl font-bold text-primary">GH₵ {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20 mb-5">
            <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
            <span>8% of your rent (GH₵ {taxAmount}) goes to the government as statutory tax. The remaining GH₵ {monthlyRent.toLocaleString()} goes to your landlord. Both are processed in one payment.</span>
          </div>

          <div className="flex gap-3">
            <Button className="flex-1" onClick={handlePay} disabled={paying}>
              <CreditCard className="h-4 w-4 mr-2" />
              {paying ? "Processing..." : `Pay GH₵ ${total.toLocaleString()}`}
            </Button>
          </div>
        </motion.div>
      )}

      {/* History */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Payment History</h2>
        <div className="space-y-3">
          {tenantPayments.map((p) => (
            <div key={p.id} className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-card-foreground">GH₵ {p.total.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">{p.date} • {p.method || "Pending"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rent: {p.rent} | Tax: {p.tax}</span>
                {p.status === "Paid" ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="h-3 w-3" /> Paid
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-warning bg-warning/10 px-2.5 py-1 rounded-full">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Payments;

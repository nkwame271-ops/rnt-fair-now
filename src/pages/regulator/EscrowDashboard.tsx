import { useState, useEffect } from "react";
import { Loader2, Wallet, TrendingUp, Receipt, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import AnimatedCounter from "@/components/AnimatedCounter";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import PaymentReceipt from "@/components/PaymentReceipt";
import { Input } from "@/components/ui/input";

const EscrowDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEscrow: 0, completed: 0, pending: 0, rentControl: 0, admin: 0, platform: 0, landlord: 0 });
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      // Escrow transactions stats
      const { data: transactions } = await supabase.from("escrow_transactions").select("status, total_amount");
      const completed = (transactions || []).filter(t => t.status === "completed");
      const pending = (transactions || []).filter(t => t.status === "pending");

      // Splits by recipient
      const { data: splits } = await supabase.from("escrow_splits").select("recipient, amount");
      const byRecipient = (splits || []).reduce((acc: Record<string, number>, s) => {
        acc[s.recipient] = (acc[s.recipient] || 0) + Number(s.amount);
        return acc;
      }, {});

      setStats({
        totalEscrow: completed.reduce((s, t) => s + Number(t.total_amount), 0),
        completed: completed.length,
        pending: pending.length,
        rentControl: byRecipient.rent_control || 0,
        admin: byRecipient.admin || 0,
        platform: byRecipient.platform || 0,
        landlord: byRecipient.landlord || 0,
      });

      // Recent receipts
      const { data: recentReceipts } = await supabase
        .from("payment_receipts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setReceipts(recentReceipts || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const filteredReceipts = search
    ? receipts.filter(r =>
        r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.payer_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.payment_type?.toLowerCase().includes(search.toLowerCase())
      )
    : receipts;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Escrow & Revenue Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Platform-wide payment overview, IGF reports, and receipt register</p>
        </div>

        <StaggeredGrid className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: stats.totalEscrow, icon: DollarSign, color: "text-success", prefix: "GH₵ " },
            { label: "Completed", value: stats.completed, icon: TrendingUp, color: "text-primary" },
            { label: "Pending", value: stats.pending, icon: Wallet, color: "text-warning" },
            { label: "Total Receipts", value: receipts.length, icon: Receipt, color: "text-info" },
          ].map(s => (
            <StaggeredItem key={s.label}>
              <div className="bg-card rounded-xl p-5 shadow-card border border-border">
                <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
                <div className="text-2xl font-bold text-card-foreground">
                  {s.prefix && <span className="text-lg">{s.prefix}</span>}
                  <AnimatedCounter value={s.value} />
                </div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </StaggeredItem>
          ))}
        </StaggeredGrid>

        {/* Revenue Breakdown (IGF) */}
        <div className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="text-lg font-semibold text-foreground mb-4">Revenue Breakdown (IGF Report)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Rent Control", amount: stats.rentControl, color: "bg-primary/10 border-primary/20 text-primary" },
              { label: "Admin", amount: stats.admin, color: "bg-info/10 border-info/20 text-info" },
              { label: "Platform", amount: stats.platform, color: "bg-success/10 border-success/20 text-success" },
              { label: "Landlord (Held)", amount: stats.landlord, color: "bg-warning/10 border-warning/20 text-warning" },
            ].map(r => (
              <div key={r.label} className={`border rounded-lg p-4 text-center ${r.color}`}>
                <div className="text-2xl font-bold">GH₵ {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                <div className="text-xs mt-1">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Receipt Register */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Receipt Register</h2>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search receipts..."
              className="w-64"
            />
          </div>

          {filteredReceipts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No receipts found.</p>
          ) : (
            <div className="space-y-4">
              {filteredReceipts.map(r => (
                <PaymentReceipt
                  key={r.id}
                  receiptNumber={r.receipt_number}
                  date={r.created_at}
                  payerName={r.payer_name || ""}
                  totalAmount={Number(r.total_amount)}
                  paymentType={r.payment_type}
                  description={r.description || ""}
                  splits={(r.split_breakdown as any[]) || []}
                  status={r.status}
                  qrCodeData={r.qr_code_data || r.receipt_number}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default EscrowDashboard;

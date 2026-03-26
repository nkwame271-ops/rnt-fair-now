import { useState, useEffect } from "react";
import { Loader2, Wallet, TrendingUp, Receipt, DollarSign, Building, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import AnimatedCounter from "@/components/AnimatedCounter";
import StaggeredGrid, { StaggeredItem } from "@/components/StaggeredGrid";
import PaymentReceipt from "@/components/PaymentReceipt";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAdminProfile } from "@/hooks/useAdminProfile";

interface OfficeRevenue {
  officeId: string;
  officeName: string;
  total: number;
  igf: number;
  admin: number;
  platform: number;
  landlord: number;
  gra: number;
}

interface RevenueByType {
  label: string;
  types: string[];
  total: number;
  count: number;
  color: string;
}

const REVENUE_TYPE_CONFIG: { label: string; types: string[]; color: string }[] = [
  { label: "Rent Card Sales", types: ["rent_card"], color: "bg-primary/10 border-primary/20 text-primary" },
  { label: "Registrations", types: ["tenant_registration", "landlord_registration", "tenant_registration_fee", "landlord_registration_fee"], color: "bg-info/10 border-info/20 text-info" },
  { label: "Quit Notices / Ejection", types: ["termination_fee"], color: "bg-destructive/10 border-destructive/20 text-destructive" },
  { label: "Tenancy Agreement Fee", types: ["agreement_sale", "add_tenant_fee"], color: "bg-success/10 border-success/20 text-success" },
  { label: "Other", types: ["complaint_fee", "listing_fee", "viewing_fee", "archive_search_fee"], color: "bg-muted border-border text-muted-foreground" },
];

const EscrowDashboard = () => {
  const { profile } = useAdminProfile();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEscrow: 0, completed: 0, pending: 0, rentControl: 0, admin: 0, platform: 0, landlord: 0, gra: 0 });
  const [receipts, setReceipts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string>("all");
  const [officeRevenue, setOfficeRevenue] = useState<OfficeRevenue[]>([]);
  const [revenueByType, setRevenueByType] = useState<RevenueByType[]>([]);

  const effectiveOffice = profile && !profile.isMainAdmin && profile.officeId
    ? profile.officeId
    : selectedOffice;

  const isMainAdmin = profile?.isMainAdmin ?? false;

  useEffect(() => {
    const fetchOffices = async () => {
      const { data } = await supabase.from("offices").select("id, name").order("name");
      setOffices(data || []);
    };
    fetchOffices();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const officeFilter = effectiveOffice !== "all" ? effectiveOffice : null;

      // Escrow transactions
      let txQuery = supabase.from("escrow_transactions").select("status, total_amount, office_id, payment_type");
      if (officeFilter) txQuery = txQuery.eq("office_id", officeFilter);
      const { data: transactions } = await txQuery;

      const completed = (transactions || []).filter(t => t.status === "completed");
      const pending = (transactions || []).filter(t => t.status === "pending");

      // Revenue by payment type
      const typeAgg = REVENUE_TYPE_CONFIG.map(cfg => {
        const matching = completed.filter(t => cfg.types.includes(t.payment_type));
        return {
          label: cfg.label,
          types: cfg.types,
          total: matching.reduce((s, t) => s + Number(t.total_amount), 0),
          count: matching.length,
          color: cfg.color,
        };
      });
      setRevenueByType(typeAgg);

      // Splits by recipient
      let splitsQuery = supabase.from("escrow_splits").select("recipient, amount, office_id");
      if (officeFilter) splitsQuery = splitsQuery.eq("office_id", officeFilter);
      const { data: splits } = await splitsQuery;

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
        gra: byRecipient.gra || 0,
      });

      // Office revenue breakdown (only for national view)
      if (!officeFilter) {
        const { data: allSplits } = await supabase.from("escrow_splits").select("recipient, amount, office_id");
        const officeMap = new Map<string, OfficeRevenue>();
        const officeNames = new Map((await supabase.from("offices").select("id, name")).data?.map(o => [o.id, o.name]) || []);

        for (const s of (allSplits || [])) {
          const oid = s.office_id || "unassigned";
          if (!officeMap.has(oid)) {
            officeMap.set(oid, { officeId: oid, officeName: officeNames.get(oid) || "Unassigned", total: 0, igf: 0, admin: 0, platform: 0, landlord: 0, gra: 0 });
          }
          const entry = officeMap.get(oid)!;
          entry.total += Number(s.amount);
          if (s.recipient === "rent_control") entry.igf += Number(s.amount);
          else if (s.recipient === "admin") entry.admin += Number(s.amount);
          else if (s.recipient === "platform") entry.platform += Number(s.amount);
          else if (s.recipient === "landlord") entry.landlord += Number(s.amount);
          else if (s.recipient === "gra") entry.gra += Number(s.amount);
        }
        setOfficeRevenue(Array.from(officeMap.values()).sort((a, b) => b.total - a.total));
      } else {
        setOfficeRevenue([]);
      }

      // Recent receipts
      let receiptsQuery = supabase.from("payment_receipts").select("*").order("created_at", { ascending: false }).limit(20);
      if (officeFilter) receiptsQuery = receiptsQuery.eq("office_id", officeFilter);
      const { data: recentReceipts } = await receiptsQuery;
      setReceipts(recentReceipts || []);
      setLoading(false);
    };
    fetchData();
  }, [effectiveOffice]);

  const filteredReceipts = search
    ? receipts.filter(r =>
        r.receipt_number?.toLowerCase().includes(search.toLowerCase()) ||
        r.payer_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.payment_type?.toLowerCase().includes(search.toLowerCase())
      )
    : receipts;

  // Filter allocation cards: hide Platform for non-main admins
  const allocationCards = [
    { label: "IGF (Rent Control)", amount: stats.rentControl, color: "bg-primary/10 border-primary/20 text-primary" },
    { label: "Admin", amount: stats.admin, color: "bg-info/10 border-info/20 text-info" },
    ...(isMainAdmin ? [{ label: "Platform", amount: stats.platform, color: "bg-success/10 border-success/20 text-success" }] : []),
    { label: "GRA", amount: stats.gra, color: "bg-accent/10 border-accent/20 text-accent-foreground" },
    { label: "Landlord (Held)", amount: stats.landlord, color: "bg-warning/10 border-warning/20 text-warning" },
  ];

  if (loading && offices.length === 0) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Wallet className="h-7 w-7 text-primary" />
              Escrow & Revenue Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Platform-wide payment overview, IGF reports, and receipt register</p>
          </div>

          {isMainAdmin && (
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="All Offices (National)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Offices (National)</SelectItem>
                {offices.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {profile && !profile.isMainAdmin && profile.officeName && (
            <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border border-border">
              📍 {profile.officeName}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
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

            {/* Revenue by Type */}
            <div className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                Revenue by Type
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {revenueByType.filter(r => r.total > 0 || r.count > 0).map(r => (
                  <div key={r.label} className={`border rounded-lg p-4 text-center ${r.color}`}>
                    <div className="text-2xl font-bold">GH₵ {r.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs mt-1">{r.label}</div>
                    <div className="text-xs mt-0.5 opacity-70">{r.count} transactions</div>
                  </div>
                ))}
                {revenueByType.every(r => r.total === 0 && r.count === 0) && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-4">No transactions yet</div>
                )}
              </div>
            </div>

            {/* Revenue Breakdown (IGF) */}
            <div className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="text-lg font-semibold text-foreground mb-4">Allocation Summary (Internal Ledger)</h2>
              <div className={`grid grid-cols-2 ${isMainAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4"} gap-4`}>
                {allocationCards.map(r => (
                  <div key={r.label} className={`border rounded-lg p-4 text-center ${r.color}`}>
                    <div className="text-2xl font-bold">GH₵ {r.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="text-xs mt-1">{r.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 border border-border">
                <span>Total Collected (Paystack)</span>
                <span className="font-semibold text-foreground">GH₵ {stats.totalEscrow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Office Revenue Table (national view only) */}
            {effectiveOffice === "all" && officeRevenue.length > 0 && (
              <div className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Office Revenue Breakdown
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="text-left py-2 pr-4">Office</th>
                        <th className="text-right py-2 px-2">Total</th>
                        <th className="text-right py-2 px-2">IGF</th>
                        <th className="text-right py-2 px-2">Admin</th>
                        {isMainAdmin && <th className="text-right py-2 px-2">Platform</th>}
                        <th className="text-right py-2 px-2">GRA</th>
                        <th className="text-right py-2 pl-2">Landlord</th>
                      </tr>
                    </thead>
                    <tbody>
                      {officeRevenue.slice(0, 20).map(o => (
                        <tr key={o.officeId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="py-2 pr-4 font-medium text-card-foreground">{o.officeName}</td>
                          <td className="text-right py-2 px-2 font-semibold">₵{o.total.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-primary">₵{o.igf.toFixed(2)}</td>
                          <td className="text-right py-2 px-2 text-info">₵{o.admin.toFixed(2)}</td>
                          {isMainAdmin && <td className="text-right py-2 px-2 text-success">₵{o.platform.toFixed(2)}</td>}
                          <td className="text-right py-2 px-2">₵{o.gra.toFixed(2)}</td>
                          <td className="text-right py-2 pl-2 text-warning">₵{o.landlord.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
          </>
        )}
      </div>
    </PageTransition>
  );
};

export default EscrowDashboard;

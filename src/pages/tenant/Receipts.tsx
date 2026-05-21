import { useState, useEffect } from "react";
import { Loader2, Receipt, Filter } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PaymentReceipt from "@/components/PaymentReceipt";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UnifiedReceipt {
  id: string;
  receipt_number: string;
  created_at: string;
  payer_name: string;
  total_amount: number;
  payment_type: string;
  description: string;
  status: string;
  qr_code_data: string;
  split_breakdown?: any[] | null;
}

const Receipts = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<UnifiedReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchReceipts = async () => {
    if (!user) return;

    // 1) Legacy receipts (still the canonical source for full payer/splits data)
    let legacyQ = supabase
      .from("payment_receipts")
      .select("id, receipt_number, created_at, payer_name, total_amount, payment_type, description, status, qr_code_data, split_breakdown, escrow_transaction_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (filter !== "all") legacyQ = legacyQ.eq("payment_type", filter);
    const { data: legacy } = await legacyQ;

    // 2) Unified case_payments (catches paid transactions that haven't materialized a legacy receipt row yet)
    let cpQ = (supabase.from("case_payments") as any)
      .select("id, receipt_number, paid_at, created_at, payment_type, amount_paid, payment_reference, receipt_url, escrow_transaction_id, metadata")
      .eq("payer_user_id", user.id)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });
    if (filter !== "all") cpQ = cpQ.eq("payment_type", filter);
    const { data: unified } = await cpQ;

    const seenEscrow = new Set<string>();
    const merged: UnifiedReceipt[] = [];

    (legacy || []).forEach((r: any) => {
      if (r.escrow_transaction_id) seenEscrow.add(r.escrow_transaction_id);
      merged.push({
        id: r.id,
        receipt_number: r.receipt_number,
        created_at: r.created_at,
        payer_name: r.payer_name || "",
        total_amount: Number(r.total_amount || 0),
        payment_type: r.payment_type,
        description: r.description || "",
        status: r.status || "active",
        qr_code_data: r.qr_code_data || r.receipt_number,
        split_breakdown: (r.split_breakdown as any[]) || [],
      });
    });

    (unified || []).forEach((cp: any) => {
      // Skip if a legacy receipt already covered this payment
      if (cp.escrow_transaction_id && seenEscrow.has(cp.escrow_transaction_id)) return;
      if (!cp.receipt_number) return;
      merged.push({
        id: cp.id,
        receipt_number: cp.receipt_number,
        created_at: cp.paid_at || cp.created_at,
        payer_name: "",
        total_amount: Number(cp.amount_paid || 0),
        payment_type: cp.payment_type,
        description: `Payment for ${(cp.payment_type || "").replace(/_/g, " ")}`,
        status: "active",
        qr_code_data: cp.receipt_url || cp.payment_reference,
        split_breakdown: [],
      });
    });

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReceipts(merged);
    setLoading(false);
  };

  // Auto-confirm any pending Paystack reference when landing on this page
  useEffect(() => {
    if (!user) return;
    const reference =
      searchParams.get("reference") ||
      searchParams.get("trxref") ||
      sessionStorage.getItem("pendingPaymentReference");
    if (reference) {
      (async () => {
        try {
          const { data } = await supabase.functions.invoke("verify-payment", { body: { reference } });
          if (data?.verified) toast.success("Payment confirmed — receipt available below.");
        } catch (_) { /* ignore */ }
        sessionStorage.removeItem("pendingPaymentReference");
        setSearchParams({}, { replace: true });
        await new Promise((r) => setTimeout(r, 1200));
        await fetchReceipts();
        setTimeout(() => fetchReceipts(), 3000);
      })();
    } else {
      fetchReceipts();
    }
  }, [user, filter]);


  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Receipts</h1>
          <p className="text-muted-foreground mt-1">View and download all your payment receipts</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="tenant_registration">Registration</SelectItem>
            <SelectItem value="rent_tax">Rent Tax</SelectItem>
            <SelectItem value="rent_tax_bulk">Bulk Tax</SelectItem>
            <SelectItem value="rent_payment">Rent Payment</SelectItem>
            <SelectItem value="rent_combined">Combined</SelectItem>
            <SelectItem value="complaint_fee">Complaint Fee</SelectItem>
            <SelectItem value="viewing_fee">Viewing Fee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {receipts.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground">No receipts yet</h2>
          <p className="text-muted-foreground mt-1">Receipts will appear here after you make payments.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.map((r) => (
            <PaymentReceipt
              key={r.id}
              receiptNumber={r.receipt_number}
              date={r.created_at}
              payerName={r.payer_name}
              totalAmount={r.total_amount}
              paymentType={r.payment_type}
              description={r.description}
              splits={(r.split_breakdown as any[]) || []}
              status={r.status}
              qrCodeData={r.qr_code_data}
              showSplits={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Receipts;

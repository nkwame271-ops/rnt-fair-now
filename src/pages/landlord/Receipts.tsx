import { useState, useEffect } from "react";
import { Loader2, Receipt } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PaymentReceipt from "@/components/PaymentReceipt";

const LandlordReceipts = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();

  const fetchReceipts = async () => {
    if (!user) return;

    // Legacy receipts owned by this user
    const { data: ownReceipts } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    // Receipts on tenancies this landlord owns
    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("id")
      .eq("landlord_user_id", user.id);
    const tenancyIds = (tenancies || []).map((t) => t.id);
    let tenancyReceipts: any[] = [];
    if (tenancyIds.length > 0) {
      const { data } = await supabase
        .from("payment_receipts")
        .select("*")
        .in("tenancy_id", tenancyIds)
        .order("created_at", { ascending: false });
      tenancyReceipts = data || [];
    }

    const legacy = [...(ownReceipts || []), ...tenancyReceipts];
    const seen = new Set<string>();
    const seenEscrow = new Set<string>();
    const merged: any[] = [];
    legacy.forEach((r: any) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
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

    // Unified case_payments fallback for payer-owned rows missing a legacy receipt
    const { data: unified } = await (supabase.from("case_payments") as any)
      .select("id, receipt_number, paid_at, created_at, payment_type, amount_paid, payment_reference, receipt_url, escrow_transaction_id")
      .eq("payer_user_id", user.id)
      .eq("payment_status", "paid")
      .order("created_at", { ascending: false });

    let inFlight = 0;
    (unified || []).forEach((cp: any) => {
      if (cp.escrow_transaction_id && seenEscrow.has(cp.escrow_transaction_id)) return;
      const hasNumber = !!cp.receipt_number;
      if (!hasNumber) inFlight += 1;
      merged.push({
        id: cp.id,
        receipt_number: hasNumber ? cp.receipt_number : "Receipt being generated…",
        created_at: cp.paid_at || cp.created_at,
        payer_name: "",
        total_amount: Number(cp.amount_paid || 0),
        payment_type: cp.payment_type,
        description: hasNumber
          ? `Payment for ${(cp.payment_type || "").replace(/_/g, " ")}`
          : `Payment confirmed — receipt is being generated and will appear here automatically.`,
        status: hasNumber ? "active" : "pending",
        qr_code_data: cp.receipt_url || cp.payment_reference,
        split_breakdown: [],
      });
    });

    if (inFlight > 0) {
      supabase.functions.invoke("receipt-drift-monitor").catch(() => {});
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setReceipts(merged);
    setLoading(false);
  };

  // Auto-confirm any pending Paystack reference (e.g. landlord pays complaint fee then lands here)
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
  }, [user]);


  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Receipts</h1>
        <p className="text-muted-foreground mt-1">View receipts for all transactions related to your properties</p>
      </div>

      {receipts.length === 0 ? (
        <div className="text-center py-20">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-xl font-bold text-foreground">No receipts yet</h2>
          <p className="text-muted-foreground mt-1">Receipts will appear here after payments are made.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {receipts.map((r) => (
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
              showSplits={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default LandlordReceipts;

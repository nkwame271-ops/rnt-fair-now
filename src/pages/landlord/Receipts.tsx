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
    const { data: ownReceipts } = await supabase
      .from("payment_receipts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("id")
      .eq("landlord_user_id", user.id);

    const tenancyIds = (tenancies || []).map(t => t.id);
    let tenancyReceipts: any[] = [];
    if (tenancyIds.length > 0) {
      const { data } = await supabase
        .from("payment_receipts")
        .select("*")
        .in("tenancy_id", tenancyIds)
        .order("created_at", { ascending: false });
      tenancyReceipts = data || [];
    }

    const allReceipts = [...(ownReceipts || []), ...tenancyReceipts];
    const seen = new Set<string>();
    const unique = allReceipts.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    setReceipts(unique.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
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

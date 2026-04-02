import { useState, useEffect } from "react";
import { Loader2, Receipt, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PaymentReceipt from "@/components/PaymentReceipt";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Receipts = () => {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!user) return;
    const fetchReceipts = async () => {
      let query = supabase
        .from("payment_receipts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") query = query.eq("payment_type", filter);

      const { data } = await query;
      setReceipts(data || []);
      setLoading(false);
    };
    fetchReceipts();
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

export default Receipts;

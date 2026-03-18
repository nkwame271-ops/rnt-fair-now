import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

interface ReceiptInfo {
  receipt_number: string;
  payer_name: string;
  total_amount: number;
  payment_type: string;
  status: string;
  created_at: string;
  description: string | null;
}

const VerifyReceipt = () => {
  const { receiptNumber } = useParams<{ receiptNumber: string }>();
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<ReceiptInfo | null>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!receiptNumber) { setLoading(false); return; }
      try {
        // receiptNumber could be an actual receipt number or a payment reference
        const { data, error } = await supabase.functions.invoke("verify-receipt", {
          body: receiptNumber?.startsWith("RCT-") ? { receiptNumber } : { reference: receiptNumber },
        });
        if (error || data?.error) { setLoading(false); return; }
        setReceipt(data as ReceiptInfo);
      } catch {
        // not found
      } finally {
        setLoading(false);
      }
    };
    fetchReceipt();
  }, [receiptNumber]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md w-full space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Receipt Not Found</h1>
          <p className="text-muted-foreground text-sm">This receipt number is invalid or does not exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl border border-border shadow-card max-w-md w-full overflow-hidden">
        <div className="bg-primary p-5 text-center space-y-2">
          <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 mx-auto opacity-90" />
          <h1 className="text-lg font-bold text-primary-foreground">Rent Control — Receipt Verification</h1>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Receipt Number</p>
              <p className="font-mono font-bold text-primary">{receipt.receipt_number}</p>
            </div>
            <Badge className={receipt.status === "active" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
              <Shield className="h-3 w-3 mr-1" /> {receipt.status === "active" ? "Valid" : receipt.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Payer</p><p className="font-semibold text-foreground">{receipt.payer_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Amount</p><p className="font-semibold text-foreground">GH₵ {receipt.total_amount.toLocaleString()}</p></div>
            <div><p className="text-muted-foreground text-xs">Type</p><p className="font-semibold text-foreground capitalize">{receipt.payment_type.replace(/_/g, " ")}</p></div>
            <div><p className="text-muted-foreground text-xs">Date</p><p className="font-semibold text-foreground">{format(new Date(receipt.created_at), "dd/MM/yyyy")}</p></div>
            {receipt.description && (
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Description</p><p className="font-semibold text-foreground">{receipt.description}</p></div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
            Verified by RentControlGhana • {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyReceipt;

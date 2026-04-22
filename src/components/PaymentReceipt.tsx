import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatGHSDecimal } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";

interface Split {
  recipient: string;
  amount: number;
}

interface BasketLine {
  label: string;
  kind: string;
  amount: number;
  igf_pct: number;
  admin_pct: number;
  platform_pct: number;
}

interface ReceiptProps {
  receiptNumber: string;
  date: string;
  payerName: string;
  totalAmount: number;
  paymentType: string;
  description: string;
  splits: Split[];
  status: string;
  qrCodeData: string;
  showSplits?: boolean;
  /** When provided for complaint_fee receipts, shows the full charge breakdown */
  complaintId?: string | null;
  complaintTable?: "complaints" | "landlord_complaints" | null;
}

const recipientLabels: Record<string, string> = {
  rent_control: "Rent Control",
  admin: "Admin",
  platform: "Platform",
  landlord: "Landlord",
};

const PaymentReceipt = ({ receiptNumber, date, payerName, totalAmount, paymentType, description, splits, status, qrCodeData, showSplits = true, complaintId, complaintTable }: ReceiptProps) => {
  const [basket, setBasket] = useState<BasketLine[] | null>(null);

  useEffect(() => {
    if (paymentType !== "complaint_fee" || !complaintId || !complaintTable) { setBasket(null); return; }
    (async () => {
      const { data } = await (supabase.from("complaint_basket_items") as any)
        .select("label, kind, amount, igf_pct, admin_pct, platform_pct")
        .eq("complaint_id", complaintId)
        .eq("complaint_table", complaintTable)
        .order("created_at");
      setBasket((data as BasketLine[]) || []);
    })();
  }, [complaintId, complaintTable, paymentType]);

  const handlePrint = () => {
    const el = document.getElementById(`receipt-${receiptNumber}`);
    if (!el) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "800px";
    iframe.style.height = "600px";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(s => s.outerHTML)
      .join("\n");

    doc.open();
    doc.write(`<!DOCTYPE html><html><head>${styles}<style>
      body { margin: 0; padding: 24px; background: white; }
      @media print { body { padding: 0; } }
    </style></head><body>${el.outerHTML}</body></html>`);
    doc.close();

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 300);
    };

    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 1000);
      }
    }, 1500);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-5 print:shadow-none print:border-0" id={`receipt-${receiptNumber}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-card-foreground">{receiptNumber}</h3>
          <p className="text-xs text-muted-foreground">{new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <Badge variant={status === "active" ? "default" : status === "voided" ? "destructive" : "secondary"}>
          {status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-muted-foreground text-xs">Payer</div>
          <div className="font-medium text-card-foreground">{payerName}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">Type</div>
          <div className="font-medium text-card-foreground capitalize">{paymentType.replace(/_/g, " ")}</div>
        </div>
        <div className="col-span-2">
          <div className="text-muted-foreground text-xs">Description</div>
          <div className="font-medium text-card-foreground">{description}</div>
        </div>
      </div>

      {/* Charges billed (complaint receipts) */}
      {basket && basket.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground flex justify-between">
            <span>Charges Billed</span>
            <span>Amount</span>
          </div>
          {basket.map((b, i) => (
            <div key={i} className="px-4 py-2.5 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-card-foreground font-medium">
                  {b.label}
                  {b.kind === "manual_adjustment" && <span className="ml-2 text-[10px] uppercase font-semibold text-warning bg-warning/10 px-1.5 py-0.5 rounded">Manual</span>}
                </span>
                <span className="font-semibold text-card-foreground">{formatGHSDecimal(b.amount)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                IGF {b.igf_pct}% · Admin {b.admin_pct}% · Platform {b.platform_pct}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recipient split breakdown */}
      {showSplits ? (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-muted px-4 py-2 text-xs font-semibold text-muted-foreground flex justify-between">
            <span>Recipient</span>
            <span>Amount</span>
          </div>
          {splits.map((s, i) => (
            <div key={i} className="px-4 py-2.5 flex justify-between text-sm border-t border-border">
              <span className="text-card-foreground">{recipientLabels[s.recipient] || s.recipient}</span>
              <span className="font-semibold text-card-foreground">{formatGHSDecimal(s.amount)}</span>
            </div>
          ))}
          <div className="px-4 py-3 flex justify-between text-sm border-t-2 border-primary bg-primary/5">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-bold text-primary text-base">{formatGHSDecimal(totalAmount)}</span>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3 flex justify-between text-sm border border-border rounded-lg bg-primary/5">
          <span className="font-bold text-foreground">Total Paid</span>
          <span className="font-bold text-primary text-base">{formatGHSDecimal(totalAmount)}</span>
        </div>
      )}

      <div className="text-[10px] text-muted-foreground border-t border-border pt-3 mt-2">
        Note: Payment processor charges (1.95% + GH₵ 1/transfer) are deducted by the payment provider before settlement.
      </div>

      <div className="flex items-center justify-between">
        <div className="bg-background p-2 rounded-lg border border-border">
          <QRCodeSVG value={qrCodeData || receiptNumber} size={80} />
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaymentReceipt;

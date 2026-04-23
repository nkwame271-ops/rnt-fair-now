import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
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

  const buildPrintHtml = async () => {
    const qrDataUrl = await QRCode.toDataURL(qrCodeData || receiptNumber, { width: 160, margin: 1 });
    const dateStr = new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const statusColor = status === "active" ? "#16a34a" : status === "voided" ? "#dc2626" : "#6b7280";

    const basketHtml = (basket && basket.length > 0) ? `
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:16px;">
        <div style="background:#f3f4f6;padding:8px 16px;font-size:11px;font-weight:600;color:#6b7280;display:flex;justify-content:space-between;text-transform:uppercase;">
          <span>Charges Billed</span><span>Amount</span>
        </div>
        ${basket.map(b => `
          <div style="padding:10px 16px;border-top:1px solid #e5e7eb;">
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span style="color:#111827;font-weight:500;">${b.label}${b.kind === "manual_adjustment" ? ' <span style="font-size:9px;text-transform:uppercase;font-weight:600;color:#b45309;background:#fef3c7;padding:1px 6px;border-radius:3px;margin-left:6px;">Manual</span>' : ''}</span>
              <span style="font-weight:600;color:#111827;">${formatGHSDecimal(b.amount)}</span>
            </div>
            <div style="font-size:10px;color:#6b7280;margin-top:2px;">IGF ${b.igf_pct}% · Admin ${b.admin_pct}% · Platform ${b.platform_pct}%</div>
          </div>
        `).join("")}
      </div>` : "";

    const splitsHtml = showSplits ? `
      <div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-top:16px;">
        <div style="background:#f3f4f6;padding:8px 16px;font-size:11px;font-weight:600;color:#6b7280;display:flex;justify-content:space-between;text-transform:uppercase;">
          <span>Recipient</span><span>Amount</span>
        </div>
        ${splits.map(s => `
          <div style="padding:10px 16px;display:flex;justify-content:space-between;font-size:13px;border-top:1px solid #e5e7eb;">
            <span style="color:#111827;">${recipientLabels[s.recipient] || s.recipient}</span>
            <span style="font-weight:600;color:#111827;">${formatGHSDecimal(s.amount)}</span>
          </div>
        `).join("")}
        <div style="padding:12px 16px;display:flex;justify-content:space-between;border-top:2px solid #2563eb;background:#eff6ff;">
          <span style="font-weight:700;color:#111827;">Total</span>
          <span style="font-weight:700;color:#2563eb;font-size:15px;">${formatGHSDecimal(totalAmount)}</span>
        </div>
      </div>` : `
      <div style="padding:12px 16px;display:flex;justify-content:space-between;border:1px solid #e5e7eb;border-radius:8px;background:#eff6ff;margin-top:16px;">
        <span style="font-weight:700;color:#111827;">Total Paid</span>
        <span style="font-weight:700;color:#2563eb;font-size:15px;">${formatGHSDecimal(totalAmount)}</span>
      </div>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt ${receiptNumber}</title>
<style>
  body { margin:0; padding:24px; background:#fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color:#111827; }
  @media print { body { padding:0; } }
  .receipt { max-width:640px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px; background:#fff; }
</style></head><body>
<div class="receipt">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;">
    <div>
      <h3 style="margin:0;font-size:18px;font-weight:700;">${receiptNumber}</h3>
      <p style="margin:2px 0 0;font-size:11px;color:#6b7280;">${dateStr}</p>
    </div>
    <span style="background:${statusColor};color:#fff;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;text-transform:uppercase;">${status}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13px;margin-top:20px;">
    <div><div style="font-size:11px;color:#6b7280;">Payer</div><div style="font-weight:500;">${payerName || "—"}</div></div>
    <div><div style="font-size:11px;color:#6b7280;">Type</div><div style="font-weight:500;text-transform:capitalize;">${paymentType.replace(/_/g, " ")}</div></div>
    <div style="grid-column:span 2;"><div style="font-size:11px;color:#6b7280;">Description</div><div style="font-weight:500;">${description || "—"}</div></div>
  </div>
  ${basketHtml}
  ${splitsHtml}
  <div style="font-size:10px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:12px;margin-top:16px;">
    Note: Payment processor charges (1.95% + GH₵ 1/transfer) are deducted by the payment provider before settlement.
  </div>
  <div style="display:flex;justify-content:flex-start;margin-top:16px;">
    <div style="background:#fff;padding:8px;border:1px solid #e5e7eb;border-radius:8px;">
      <img src="${qrDataUrl}" alt="QR" width="96" height="96" style="display:block;" />
    </div>
  </div>
</div>
</body></html>`;
  };

  const handlePrint = async () => {
    const html = await buildPrintHtml();
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "800px";
    iframe.style.height = "600px";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = () => {
      requestAnimationFrame(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 1000);
      });
    };

    if (iframe.contentDocument?.readyState === "complete") {
      triggerPrint();
    } else {
      iframe.onload = triggerPrint;
    }
  };

  const handleDownloadPdf = async () => {
    const qrDataUrl = await QRCode.toDataURL(qrCodeData || receiptNumber, { width: 200, margin: 1 });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 40;
    let y = margin;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(receiptNumber, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text(new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }), margin, y + 14);

    // Status chip
    const statusColor = status === "active" ? [22, 163, 74] : status === "voided" ? [220, 38, 38] : [107, 114, 128];
    pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.roundedRect(pageW - margin - 70, y - 10, 70, 18, 4, 4, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(status.toUpperCase(), pageW - margin - 35, y + 2, { align: "center" });

    y += 40;
    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text("Payer", margin, y);
    pdf.text("Type", pageW / 2, y);
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(11);
    pdf.text(payerName || "—", margin, y + 14);
    pdf.text(paymentType.replace(/_/g, " "), pageW / 2, y + 14);

    y += 36;
    pdf.setFontSize(9);
    pdf.setTextColor(107, 114, 128);
    pdf.text("Description", margin, y);
    pdf.setTextColor(17, 24, 39);
    pdf.setFontSize(10);
    const descLines = pdf.splitTextToSize(description || "—", pageW - margin * 2);
    pdf.text(descLines, margin, y + 14);
    y += 14 + descLines.length * 12 + 10;

    if (basket && basket.length > 0) {
      pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, y, pageW - margin * 2, 18, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(107, 114, 128);
      pdf.text("CHARGES BILLED", margin + 8, y + 12);
      pdf.text("AMOUNT", pageW - margin - 8, y + 12, { align: "right" });
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(17, 24, 39);
      basket.forEach(b => {
        pdf.setFontSize(10);
        pdf.text(b.label, margin + 8, y + 14);
        pdf.text(formatGHSDecimal(b.amount), pageW - margin - 8, y + 14, { align: "right" });
        pdf.setFontSize(8);
        pdf.setTextColor(107, 114, 128);
        pdf.text(`IGF ${b.igf_pct}% · Admin ${b.admin_pct}% · Platform ${b.platform_pct}%`, margin + 8, y + 26);
        pdf.setTextColor(17, 24, 39);
        y += 32;
      });
      y += 8;
    }

    if (showSplits) {
      pdf.setFillColor(243, 244, 246);
      pdf.rect(margin, y, pageW - margin * 2, 18, "F");
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(107, 114, 128);
      pdf.text("RECIPIENT", margin + 8, y + 12);
      pdf.text("AMOUNT", pageW - margin - 8, y + 12, { align: "right" });
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(17, 24, 39);
      pdf.setFontSize(10);
      splits.forEach(s => {
        pdf.text(recipientLabels[s.recipient] || s.recipient, margin + 8, y + 14);
        pdf.text(formatGHSDecimal(s.amount), pageW - margin - 8, y + 14, { align: "right" });
        y += 22;
      });
    }

    pdf.setFillColor(239, 246, 255);
    pdf.rect(margin, y, pageW - margin * 2, 28, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(17, 24, 39);
    pdf.text(showSplits ? "Total" : "Total Paid", margin + 8, y + 18);
    pdf.setTextColor(37, 99, 235);
    pdf.text(formatGHSDecimal(totalAmount), pageW - margin - 8, y + 18, { align: "right" });
    y += 44;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    const noteLines = pdf.splitTextToSize("Note: Payment processor charges (1.95% + GH₵ 1/transfer) are deducted by the payment provider before settlement.", pageW - margin * 2);
    pdf.text(noteLines, margin, y);
    y += noteLines.length * 10 + 12;

    pdf.addImage(qrDataUrl, "PNG", margin, y, 80, 80);

    pdf.save(`receipt-${receiptNumber}.pdf`);
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

import jsPDF from "jspdf";
import { ROOT_DOMAIN } from "@/lib/projectDomain";

export interface RentCardPdfData {
  serial_number?: string | null;
  status?: string | null;
  card_role?: string | null;
  variant: "tenant" | "landlord";
  property_address?: string | null;
  unit_name?: string | null;
  landlord_name?: string | null;
  tenant_name?: string | null;
  current_rent?: number | null;
  advance_paid?: number | null;
  start_date?: string | null;
  expiry_date?: string | null;
  qr_token?: string | null;
  payments?: Array<{
    created_at: string;
    receipt_number?: string | null;
    payment_type?: string | null;
    total_amount?: number | null;
  }>;
}

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB");
};

export const generateRentCardPdf = (data: RentCardPdfData): jsPDF => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = 210;

  // Header
  doc.setFillColor(178, 34, 34);
  doc.rect(0, 0, pageW, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("REPUBLIC OF GHANA — RENT CONTROL", pageW / 2, 12, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  const copyLabel =
    data.card_role === "landlord_copy" || data.variant === "landlord"
      ? "LANDLORD COPY"
      : "TENANT COPY";
  doc.text(`Digital Rent Card — ${copyLabel}`, pageW / 2, 20, { align: "center" });

  // Serial + status
  let y = 40;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Serial Number", 15, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(data.serial_number || "—", 15, y + 6);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Status", pageW - 15, y, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text((data.status || "—").toUpperCase(), pageW - 15, y + 6, { align: "right" });

  y += 16;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Details grid
  const rows: [string, string][] = [
    ["Landlord", data.landlord_name || "—"],
    ["Tenant", data.tenant_name || "—"],
    ["Property", data.property_address || "—"],
    ["Unit", data.unit_name || "—"],
    ["Monthly Rent", data.current_rent != null ? `GHS ${Number(data.current_rent).toLocaleString()}` : "—"],
    ["Advance Paid", data.advance_paid != null ? `${data.advance_paid} month(s)` : "—"],
    ["Start Date", fmtDate(data.start_date)],
    ["Expiry Date", fmtDate(data.expiry_date)],
  ];

  doc.setFontSize(9);
  for (let i = 0; i < rows.length; i += 2) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text(rows[i][0], 15, y);
    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "bold");
    doc.text(String(rows[i][1]).slice(0, 45), 15, y + 5);

    if (rows[i + 1]) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120, 120, 120);
      doc.text(rows[i + 1][0], 110, y);
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.text(String(rows[i + 1][1]).slice(0, 45), 110, y + 5);
    }
    y += 12;
  }

  y += 4;
  doc.setDrawColor(220, 220, 220);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Payment history table
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Payment History", 15, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120, 120, 120);
  doc.text("Date", 15, y);
  doc.text("Receipt", 45, y);
  doc.text("Type", 100, y);
  doc.text("Amount (GHS)", pageW - 15, y, { align: "right" });
  y += 4;
  doc.setDrawColor(230, 230, 230);
  doc.line(15, y, pageW - 15, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40, 40, 40);
  const pays = (data.payments || []).slice(0, 30);
  if (pays.length === 0) {
    doc.setTextColor(140, 140, 140);
    doc.text("No payments recorded yet for this tenancy.", 15, y);
    y += 6;
  } else {
    for (const p of pays) {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }
      doc.text(fmtDate(p.created_at), 15, y);
      doc.text(String(p.receipt_number || "—").slice(0, 20), 45, y);
      doc.text(String(p.payment_type || "—").replace(/_/g, " ").slice(0, 22), 100, y);
      doc.text(Number(p.total_amount || 0).toLocaleString(), pageW - 15, y, { align: "right" });
      y += 5;
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  const verify = data.qr_token
    ? `https://www.${ROOT_DOMAIN}/verify/rent-card/${data.qr_token}`
    : `https://www.${ROOT_DOMAIN}`;
  doc.text(`Verify: ${verify}`, 15, 288);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, pageW - 15, 288, { align: "right" });

  return doc;
};

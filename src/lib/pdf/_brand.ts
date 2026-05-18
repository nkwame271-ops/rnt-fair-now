import jsPDF from "jspdf";

export const A4 = { W: 595.28, H: 841.89 };
export const MARGIN = 56;

export function drawWatermark(doc: jsPDF, text = "RENT CONTROL") {
  doc.saveGraphicsState();
  // @ts-ignore
  doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(96);
  doc.setTextColor(20, 80, 50);
  doc.text(text, A4.W / 2, A4.H / 2 + 40, { align: "center", angle: 30 });
  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
}

export function drawHeader(doc: jsPDF, opts: { subtitle?: string } = {}) {
  // Top green strip
  doc.setFillColor(20, 80, 50);
  doc.rect(0, 0, A4.W, 6, "F");

  // Coat-of-arms placeholder circle (left)
  doc.setDrawColor(20, 80, 50);
  doc.setLineWidth(1.2);
  doc.circle(MARGIN + 14, 38, 16, "S");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(20, 80, 50);
  doc.text("RCD", MARGIN + 14, 41, { align: "center" });

  // Title block
  doc.setFontSize(11);
  doc.setTextColor(20, 80, 50);
  doc.text("REPUBLIC OF GHANA", A4.W / 2, 30, { align: "center" });
  doc.setFontSize(13);
  doc.text("RENT CONTROL DEPARTMENT", A4.W / 2, 46, { align: "center" });
  if (opts.subtitle) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text(opts.subtitle, A4.W / 2, 60, { align: "center" });
  }
  // Divider
  doc.setDrawColor(20, 80, 50);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, 70, A4.W - MARGIN, 70);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

export function drawFooter(doc: jsPDF, slogan = "We Promote Peace & Reconcile Parties") {
  const y = A4.H - 36;
  doc.setDrawColor(20, 80, 50);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y, A4.W - MARGIN, y);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(20, 80, 50);
  doc.text(slogan, A4.W / 2, y + 14, { align: "center" });
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB")}`,
    A4.W / 2,
    y + 24,
    { align: "center" }
  );
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
}

export function drawSignatureStamp(
  doc: jsPDF,
  y: number,
  opts: { signatureName?: string; signatureRole?: string; stampText?: string; dateText?: string }
) {
  const colW = (A4.W - MARGIN * 2 - 24) / 2;

  // Signature block (right)
  const sx = A4.W - MARGIN - colW;
  doc.setDrawColor(120);
  doc.setLineWidth(0.4);
  doc.line(sx, y + 30, sx + colW, y + 30);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(opts.signatureName || "_______________________", sx + colW / 2, y + 44, { align: "center" });
  doc.setFont("helvetica", "italic");
  doc.setTextColor(80);
  doc.text(opts.signatureRole || "Signature", sx + colW / 2, y + 56, { align: "center" });
  if (opts.dateText) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0);
    doc.text(`Date: ${opts.dateText}`, sx + colW / 2, y + 70, { align: "center" });
  }

  // Stamp block (left)
  doc.setDrawColor(180);
  doc.setLineWidth(0.6);
  doc.roundedRect(MARGIN, y, colW, 70, 4, 4, "S");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(160);
  doc.text(opts.stampText || "Official Stamp", MARGIN + colW / 2, y + 38, { align: "center" });
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
}

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
export function fmtTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

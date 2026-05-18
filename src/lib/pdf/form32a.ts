import jsPDF from "jspdf";
import { A4, MARGIN, drawHeader, drawFooter, drawWatermark, drawSignatureStamp, fmtDate } from "./_brand";

export interface Form32AData {
  case_number?: string;
  parties_line?: string;
  rent_office?: string;
  rent_officer?: string;
  hearing_reference?: string;
  decision_body?: string; // editable order/decision
  issued_office?: string;
  issued_date?: string;
  signature_name?: string;
  stamp_text?: string;
  footer_slogan?: string;
  ticket_number?: string;
}

export function renderForm32A(d: Form32AData): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawWatermark(doc);
  drawHeader(doc, { subtitle: "Rent Regulation, 1964 (LI 369)" });

  let y = 86;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`CA  ${d.case_number || "—"}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(d.parties_line || "Complainant(s) VRS Respondent(s)", A4.W - MARGIN, y, { align: "right" });
  y += 10;
  doc.setDrawColor(20, 80, 50);
  doc.line(MARGIN, y, A4.W - MARGIN, y);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FORM 32A", A4.W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10);
  doc.text("ORDER / DECISION OF RENT OFFICER", A4.W / 2, y, { align: "center" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Rent Officer for ${d.rent_office || "—"}${d.rent_officer ? "  ·  " + d.rent_officer : ""}`, MARGIN, y);
  y += 16;
  if (d.hearing_reference) {
    doc.text(`Hearing reference: ${d.hearing_reference}`, MARGIN, y);
    y += 18;
  }
  y += 4;

  const lines = doc.splitTextToSize(d.decision_body || "—", A4.W - MARGIN * 2);
  for (const line of lines) {
    if (y > A4.H - 200) {
      drawFooter(doc, d.footer_slogan);
      doc.addPage();
      drawWatermark(doc);
      drawHeader(doc, { subtitle: "Rent Regulation, 1964 (LI 369)" });
      y = 100;
    }
    doc.text(line, MARGIN, y);
    y += 14;
  }
  y += 18;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    `Issued at ${d.issued_office || d.rent_office || "—"} on ${fmtDate(d.issued_date || new Date().toISOString())}`,
    MARGIN,
    y
  );
  y += 22;

  if (y > A4.H - 160) {
    drawFooter(doc, d.footer_slogan);
    doc.addPage();
    drawWatermark(doc);
    drawHeader(doc, { subtitle: "Rent Regulation, 1964 (LI 369)" });
    y = 110;
  }

  drawSignatureStamp(doc, y, {
    signatureName: d.signature_name || d.rent_officer,
    signatureRole: "Rent Officer",
    stampText: d.stamp_text || "Rent Control Department",
    dateText: fmtDate(d.issued_date || new Date().toISOString()),
  });

  drawFooter(doc, d.footer_slogan);
  return doc;
}

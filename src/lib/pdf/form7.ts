import jsPDF from "jspdf";
import { A4, MARGIN, drawHeader, drawFooter, drawWatermark, drawSignatureStamp, drawQrFooter, fmtDate } from "./_brand";

export interface Form7Party {
  name: string;
  phone?: string;
  address?: string;
}

export interface Form7Data {
  // Identity
  case_reference?: string;
  case_number?: string;
  ticket_number?: string;
  // Parties
  complainant_name?: string;
  complainant_postal_address?: string;
  complainant_telephone?: string;
  respondent_name_address?: string; // free text, may be multi-line
  // Premises
  premises_address?: string;
  premises_house_no?: string;
  // Complaint
  complaint_category?: string;
  complaint_statement?: string; // editable narrative
  // Office & signature
  rent_office?: string;
  signature_name?: string;
  signature_date?: string; // ISO or display
  stamp_text?: string;
  footer_slogan?: string;
  // For back-compat ingest
  complainants?: Form7Party[];
  respondents?: Form7Party[];
  property_address?: string;
  description?: string;
  filed_at?: string;
  // Verification (QR is rendered in the footer band — does not alter statutory body)
  qr_data_url?: string;
  verification_code?: string;
}

const wrapNumbered = (doc: jsPDF, n: number, label: string, value: string, y: number, width: number): number => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(`${n}.`, MARGIN, y);
  doc.text(label, MARGIN + 26, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(18);
  const v = value && value.trim() ? value : "—";
  const lineH = 24;
  const lines = doc.splitTextToSize(v, width - 26);
  doc.text(lines, MARGIN + 26, y + 24);
  const totalLines = lines.length;
  for (let i = 0; i < totalLines; i++) {
    const ly = y + 24 + i * lineH + 4;
    doc.setDrawColor(200);
    doc.setLineDashPattern([1, 2], 0);
    doc.line(MARGIN + 26, ly, MARGIN + width, ly);
  }
  doc.setLineDashPattern([], 0);
  return y + 24 + totalLines * lineH + 16;
};

export function renderForm7(d: Form7Data): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawWatermark(doc);
  drawHeader(doc, { subtitle: "Rent Regulation 13 · Rent Regulation, 1964 (LI 369)" });

  let y = 92;

  // FORM 7 + heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FORM 7", A4.W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10);
  const heading = doc.splitTextToSize(
    "COMPLAINT AGAINST CONDUCT OF LANDLORD / TENANT / PERSON INTERESTED IN PREMISES",
    A4.W - MARGIN * 2
  );
  doc.text(heading, A4.W / 2, y, { align: "center" });
  y += heading.length * 12 + 6;

  // Case ref / number row
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Case Reference: ${d.case_reference || d.ticket_number || "—"}`, MARGIN, y);
  doc.text(`Case Number: ${d.case_number || "—"}`, A4.W - MARGIN, y, { align: "right" });
  y += 8;
  doc.setDrawColor(20, 80, 50);
  doc.line(MARGIN, y, A4.W - MARGIN, y);
  y += 16;

  // Fallback ingestion from old shape
  const complainantName = d.complainant_name
    || d.complainants?.[0]?.name
    || "—";
  const complainantAddr = d.complainant_postal_address
    || d.complainants?.[0]?.address
    || "—";
  const complainantTel = d.complainant_telephone
    || d.complainants?.[0]?.phone
    || "—";
  const respondents = d.respondent_name_address
    || (d.respondents || []).map((r) => `${r.name}${r.address ? " — " + r.address : ""}${r.phone ? " (" + r.phone + ")" : ""}`).join("\n")
    || "—";
  const premises = d.premises_address || d.property_address || "—";
  const narrative = d.complaint_statement || d.description || "";

  const fieldWidth = A4.W - MARGIN * 2;
  y = wrapNumbered(doc, 1, "Name of complainant", complainantName, y, fieldWidth);
  y = wrapNumbered(doc, 2, "Postal address of complainant", complainantAddr, y, fieldWidth);
  y = wrapNumbered(doc, 3, "Telephone number", complainantTel, y, fieldWidth);
  y = wrapNumbered(doc, 4, "Name and address of person complained against", respondents, y, fieldWidth);
  y = wrapNumbered(
    doc,
    5,
    "Address of premises involved",
    `${premises}${d.premises_house_no ? ` (House No. ${d.premises_house_no})` : ""}`,
    y,
    fieldWidth
  );

  // 6. Complaint narrative as paragraph
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("6.", MARGIN, y);
  doc.text("Complaint, claim, etc.", MARGIN + 20, y);
  y += 20;
  if (d.complaint_category) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(12);
    doc.text(`Category: ${d.complaint_category}`, MARGIN + 20, y);
    y += 16;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  const narrLines = doc.splitTextToSize(narrative || "—", fieldWidth - 20);
  // Allow page break
  for (const line of narrLines) {
    if (y > A4.H - 180) {
      drawFooter(doc, d.footer_slogan);
      doc.addPage();
      drawWatermark(doc);
      drawHeader(doc, { subtitle: "Rent Regulation 13 · Rent Regulation, 1964 (LI 369)" });
      y = 100;
    }
    doc.text(line, MARGIN + 20, y);
    y += 18;
  }
  y += 16;

  // Rent office
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Rent Office: ${d.rent_office || "—"}`, MARGIN, y);
  y += 24;

  if (y > A4.H - 160) {
    drawFooter(doc, d.footer_slogan);
    doc.addPage();
    drawWatermark(doc);
    drawHeader(doc, { subtitle: "Rent Regulation 13 · Rent Regulation, 1964 (LI 369)" });
    y = 110;
  }

  drawSignatureStamp(doc, y, {
    signatureName: d.signature_name,
    signatureRole: "Signature of Complainant",
    stampText: d.stamp_text || "Rent Control Department — Received",
    dateText: fmtDate(d.signature_date || d.filed_at || new Date().toISOString()),
  });

  drawQrFooter(doc, d.qr_data_url, d.verification_code);
  drawFooter(doc, d.footer_slogan);
  return doc;
}

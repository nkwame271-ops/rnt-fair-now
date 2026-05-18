import jsPDF from "jspdf";
import { A4, MARGIN, drawHeader, drawFooter, drawWatermark, drawSignatureStamp, fmtDate, fmtTime } from "./_brand";

export interface Form33Data {
  // Top header
  case_prefix?: string; // "CA"
  case_number?: string;
  parties_line?: string; // "Afua Owusu VRS Eric Atta"
  // Office
  rent_office?: string;
  rent_officer?: string;
  // Summons target
  person_summoned?: string;
  complaint_category?: string;
  // Hearing
  hearing_time?: string; // free text e.g. "09:00 AM" or ISO
  hearing_date?: string; // ISO or display
  hearing_venue?: string;
  // Body
  summons_paragraph?: string; // editable, with placeholders allowed
  // Issue
  issued_office?: string;
  issued_date?: string; // ISO
  signature_name?: string;
  stamp_text?: string;
  footer_slogan?: string;
  ticket_number?: string;
}

const DEFAULT_SUMMONS = (d: Form33Data) =>
  `You are hereby commanded in the name of the Republic to appear in person before me at ${
    d.hearing_time || "[time]"
  } on ${fmtDate(d.hearing_date) || "[date]"} and on every adjournment until this case is disposed off at the Rent Office in ${
    d.hearing_venue || "[venue]"
  }.`;

export function renderForm33(d: Form33Data): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawWatermark(doc);
  drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });

  let y = 86;

  // Top row: CA / Case number (left) — Parties line (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`${d.case_prefix || "CA"}  ${d.case_number || "—"}`, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(d.parties_line || "Complainant(s) VRS Respondent(s)", A4.W - MARGIN, y, { align: "right" });
  y += 10;
  doc.setDrawColor(20, 80, 50);
  doc.line(MARGIN, y, A4.W - MARGIN, y);
  y += 22;

  // FORM 33 + heading
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FORM 33", A4.W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(10);
  const heading = doc.splitTextToSize(
    "SUMMONS TO PERSONS AGAINST WHOM COMPLAINTS HAVE BEEN MADE",
    A4.W - MARGIN * 2
  );
  doc.text(heading, A4.W / 2, y, { align: "center" });
  y += heading.length * 12 + 18;

  // Rent Officer for / To
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Rent Officer for ${d.rent_office || "—"}${d.rent_officer ? "  ·  " + d.rent_officer : ""}`, MARGIN, y);
  y += 18;
  doc.text(`To: ${d.person_summoned || "—"}`, MARGIN, y);
  y += 22;

  // Whereas intro
  doc.text("Whereas your attendance is necessary to answer a complaint of a", MARGIN, y);
  y += 18;

  // Centered bold underlined category
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const cat = (d.complaint_category || "—").toUpperCase();
  doc.text(cat, A4.W / 2, y, { align: "center" });
  const catWidth = doc.getTextWidth(cat);
  doc.setLineWidth(0.6);
  doc.line(A4.W / 2 - catWidth / 2, y + 3, A4.W / 2 + catWidth / 2, y + 3);
  y += 22;

  // Summons paragraph
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const paragraph = d.summons_paragraph && d.summons_paragraph.trim() ? d.summons_paragraph : DEFAULT_SUMMONS(d);
  const lines = doc.splitTextToSize(paragraph, A4.W - MARGIN * 2);
  for (const line of lines) {
    if (y > A4.H - 200) {
      drawFooter(doc, d.footer_slogan);
      doc.addPage();
      drawWatermark(doc);
      drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });
      y = 100;
    }
    doc.text(line, MARGIN, y);
    y += 14;
  }
  y += 14;

  // Hearing summary table
  const rowH = 16;
  const tableY = y;
  doc.setDrawColor(180);
  doc.setLineWidth(0.4);
  doc.rect(MARGIN, tableY, A4.W - MARGIN * 2, rowH * 3);
  doc.line(MARGIN, tableY + rowH, A4.W - MARGIN, tableY + rowH);
  doc.line(MARGIN, tableY + rowH * 2, A4.W - MARGIN, tableY + rowH * 2);
  doc.line(MARGIN + 140, tableY, MARGIN + 140, tableY + rowH * 3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Hearing Date", MARGIN + 6, tableY + 11);
  doc.text("Hearing Time", MARGIN + 6, tableY + 11 + rowH);
  doc.text("Venue", MARGIN + 6, tableY + 11 + rowH * 2);
  doc.setFont("helvetica", "normal");
  doc.text(fmtDate(d.hearing_date), MARGIN + 146, tableY + 11);
  doc.text(d.hearing_time || fmtTime(d.hearing_date), MARGIN + 146, tableY + 11 + rowH);
  doc.text(d.hearing_venue || d.rent_office || "—", MARGIN + 146, tableY + 11 + rowH * 2);
  y = tableY + rowH * 3 + 20;

  // Issued line
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    `Issued at ${d.issued_office || d.rent_office || "—"} on ${fmtDate(d.issued_date || new Date().toISOString())}`,
    MARGIN,
    y
  );
  y += 24;

  if (y > A4.H - 160) {
    drawFooter(doc, d.footer_slogan);
    doc.addPage();
    drawWatermark(doc);
    drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });
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

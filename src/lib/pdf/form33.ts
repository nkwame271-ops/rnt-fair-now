import jsPDF from "jspdf";
import { A4, MARGIN, drawHeader, drawFooter, drawWatermark, drawSignatureStamp, drawQrFooter, fmtDate, fmtTime } from "./_brand";

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
  body_font_size?: number; // default 10
  // Issue
  issued_office?: string;
  issued_date?: string; // ISO
  signature_name?: string;
  stamp_text?: string;
  footer_slogan?: string;
  ticket_number?: string;
  // Complainant basics (display + record)
  complainant_name?: string;
  complainant_phone?: string;
  complainant_address?: string;
  // Verification (QR rendered in footer band — statutory body untouched)
  qr_data_url?: string;
  verification_code?: string;
}

const ordinalSuffix = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Returns e.g. "Wednesday, 16th June 2026". Falls back to the raw string. */
export function fmtDateWithDay(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  return `${weekday}, ${ordinalSuffix(d.getDate())} ${month} ${year}`;
}

/** Returns "Wednesday, 16th June 2026 (16/06/2026)" — year is mandatory. */
export function fmtDayDate(iso?: string): string {
  if (!iso) return "[date]";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const month = d.toLocaleDateString("en-GB", { month: "long" });
  const year = d.getFullYear();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${weekday}, ${ordinalSuffix(d.getDate())} ${month} ${year} (${dd}/${mm}/${year})`;
}

/** Build the summons sentence as runs so we can bold the day/date/time. */
function summonsRuns(d: Form33Data): Array<{ text: string; bold?: boolean }> {
  const timeText = d.hearing_time && d.hearing_time.trim() ? d.hearing_time : fmtTime(d.hearing_date);
  const dateText = fmtDayDate(d.hearing_date);
  const venueText = d.hearing_venue || "[venue]";
  return [
    { text: "You are hereby commanded in the name of the Republic to appear in person before me at " },
    { text: timeText, bold: true },
    { text: " on " },
    { text: dateText, bold: true },
    { text: " and on every adjournment until this case is disposed off at the Rent Office in " },
    { text: venueText },
    { text: "." },
  ];
}

/** Word-wrap a sequence of styled runs into lines that fit within `maxWidth`. */
function wrapRuns(
  doc: jsPDF,
  runs: Array<{ text: string; bold?: boolean }>,
  maxWidth: number
): Array<Array<{ text: string; bold?: boolean }>> {
  const lines: Array<Array<{ text: string; bold?: boolean }>> = [[]];
  const measure = (text: string, bold?: boolean) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    return doc.getTextWidth(text);
  };
  for (const run of runs) {
    const words = run.text.split(/(\s+)/); // keep whitespace tokens
    for (const word of words) {
      if (!word) continue;
      const curLine = lines[lines.length - 1];
      const lineText = curLine.map((p) => p.text).join("");
      const trial = lineText + word;
      if (measure(trial, false) > maxWidth && lineText.trim().length > 0) {
        lines.push([{ text: word.trimStart(), bold: run.bold }]);
      } else {
        // merge with last run if same boldness, else push new run
        const last = curLine[curLine.length - 1];
        if (last && !!last.bold === !!run.bold) last.text += word;
        else curLine.push({ text: word, bold: run.bold });
      }
    }
  }
  return lines;
}

export function renderForm33(d: Form33Data): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  drawWatermark(doc);
  drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });

  const bodySize = Math.max(9, Math.min(18, d.body_font_size || 10));
  const lineHeight = Math.round(bodySize * 1.4);

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
  y += 18;

  // Complainant basics (small line, helps recipient identify the case)
  if (d.complainant_name || d.complainant_phone || d.complainant_address) {
    doc.setFontSize(9);
    doc.setTextColor(80);
    const parts = [
      d.complainant_name ? `Complainant: ${d.complainant_name}` : null,
      d.complainant_phone ? `Tel: ${d.complainant_phone}` : null,
      d.complainant_address ? `Address: ${d.complainant_address}` : null,
    ].filter(Boolean) as string[];
    const lineTxt = parts.join("  ·  ");
    const wrapped = doc.splitTextToSize(lineTxt, A4.W - MARGIN * 2);
    for (const w of wrapped) { doc.text(w, MARGIN, y); y += 12; }
    doc.setTextColor(0);
    doc.setFontSize(10);
    y += 4;
  } else {
    y += 4;
  }

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

  // Summons paragraph — bolded day/date/time runs, configurable font size.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(bodySize);
  const customParagraph = d.summons_paragraph && d.summons_paragraph.trim() ? d.summons_paragraph : "";
  const maxWidth = A4.W - MARGIN * 2;

  if (customParagraph) {
    // Custom paragraph: render as-is (no bold runs).
    const lines = doc.splitTextToSize(customParagraph, maxWidth);
    for (const line of lines) {
      if (y > A4.H - 200) {
        drawFooter(doc, d.footer_slogan);
        doc.addPage();
        drawWatermark(doc);
        drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });
        y = 100;
      }
      doc.text(line, MARGIN, y);
      y += lineHeight;
    }
  } else {
    const wrapped = wrapRuns(doc, summonsRuns(d), maxWidth);
    for (const line of wrapped) {
      if (y > A4.H - 200) {
        drawFooter(doc, d.footer_slogan);
        doc.addPage();
        drawWatermark(doc);
        drawHeader(doc, { subtitle: "Regulation 38(2) · Rent Regulation, 1964 (LI 369)" });
        y = 100;
        doc.setFontSize(bodySize);
      }
      let x = MARGIN;
      for (const part of line) {
        doc.setFont("helvetica", part.bold ? "bold" : "normal");
        doc.text(part.text, x, y);
        x += doc.getTextWidth(part.text);
      }
      y += lineHeight;
    }
  }
  y += 14;

  // Issued line
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(
    `Issued at ${d.issued_office || d.rent_office || "—"} on ${fmtDateWithDay(d.issued_date || new Date().toISOString())}`,
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

  drawQrFooter(doc, d.qr_data_url, d.verification_code);
  drawFooter(doc, d.footer_slogan);
  return doc;
}

import jsPDF from "jspdf";
import type { Form7Party } from "./form7";

export interface Form33Data {
  case_number: string;
  ticket_number?: string;
  office_name: string;
  office_region?: string;
  complainants: Form7Party[];
  respondents: Form7Party[];
  person_summoned: string; // single respondent name (one summons per respondent)
  nature_of_complaint: string;
  appearance_at: string; // ISO datetime
  venue?: string;
  issued_at_location?: string;
  date_issued?: string; // ISO
  hearing_officer_name?: string;
}

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
};
const fmtTime = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
};

export function renderForm33(data: Form33Data): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPUBLIC OF GHANA  •  RENT CONTROL DEPARTMENT", W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(13);
  doc.text("FORM 33", W / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Summons to Persons Against Whom Complaints Have Been Made", W / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "italic");
  doc.text("Under Regulation 38(2) — Rent Regulation, 1964 (L.I. 369)", W / 2, y, { align: "center" });
  y += 18;
  doc.setDrawColor(140);
  doc.line(M, y, W - M, y);
  y += 16;

  // Case number bold
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`Case Number: ${data.case_number}`, M, y);
  y += 20;

  // Parties block
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Parties Involved", M, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  data.complainants.forEach((c) => {
    doc.text(c.name || "—", M + 12, y);
    y += 12;
  });
  doc.setFont("helvetica", "italic");
  doc.text("VS", M, y + 2);
  y += 16;
  doc.setFont("helvetica", "normal");
  data.respondents.forEach((r) => {
    doc.text(r.name || "—", M + 12, y);
    y += 12;
  });
  y += 10;

  const row = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", W - M * 2 - 160);
    doc.text(lines, M + 160, y);
    y += Math.max(14, lines.length * 14);
  };

  row("Rent Officer for:", `${data.office_name}${data.office_region ? " (" + data.office_region + ")" : ""}`);
  row("Person Summoned:", data.person_summoned);
  row("Nature of Complaint:", data.nature_of_complaint);
  row("Appearance Date:", fmtDate(data.appearance_at));
  row("Time:", fmtTime(data.appearance_at));
  row("Venue:", data.venue || data.office_name);
  y += 10;
  row("Issued at:", data.issued_at_location || data.office_name);
  row("Date Issued:", fmtDate(data.date_issued || new Date().toISOString()));

  y += 24;
  // Body paragraph
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const body = doc.splitTextToSize(
    `You are hereby required to appear before the Rent Officer on the date, time and venue shown above to answer the complaint summarised in Case ${data.case_number}. Failure to appear may result in the matter being determined in your absence.`,
    W - M * 2
  );
  doc.text(body, M, y);
  y += body.length * 14 + 30;

  // Signature line
  if (y > 720) { doc.addPage(); y = M; }
  doc.line(M, y, M + 220, y);
  y += 12;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text(`Hearing Officer: ${data.hearing_officer_name || "_____________________"}`, M, y);
  doc.text(`${data.office_name}`, M, y + 12);

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Generated ${new Date().toLocaleString("en-GB")}  •  Ticket ${data.ticket_number || ""}`,
    W / 2,
    820,
    { align: "center" }
  );

  return doc;
}

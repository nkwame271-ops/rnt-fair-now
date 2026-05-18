import jsPDF from "jspdf";

export interface Form7Party {
  name: string;
  phone?: string;
  address?: string;
}

export interface Form7Data {
  ticket_number?: string;
  case_number?: string;
  complainants: Form7Party[];
  respondents: Form7Party[];
  premises_house_no?: string;
  premises_town?: string;
  property_address?: string;
  region?: string;
  rent_amount?: number | string;
  deposit_amount?: number | string;
  agreement_expiry_date?: string; // ISO
  occupied_months?: number;
  tenants_intent?: string;
  description?: string;
  relief_sought?: string;
  filed_at?: string; // ISO
  office_name?: string;
}

const fmtMoney = (n?: number | string) =>
  n == null || n === "" ? "—" : `GHS ${Number(n).toLocaleString("en-GH")}`;

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export function renderForm7(data: Form7Data): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  let y = M;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("REPUBLIC OF GHANA  •  RENT CONTROL DEPARTMENT", W / 2, y, { align: "center" });
  y += 18;
  doc.setFontSize(13);
  doc.text("FORM 7", W / 2, y, { align: "center" });
  y += 14;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Complaint Against Conduct of Landlord / Tenant / Person Interested in Premises", W / 2, y, { align: "center" });
  y += 12;
  doc.setFont("helvetica", "italic");
  doc.text("Under Rent Regulation 19(1)", W / 2, y, { align: "center" });
  y += 18;
  doc.setDrawColor(140);
  doc.line(M, y, W - M, y);
  y += 16;

  // Ticket / Case row
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Ticket No.: ${data.ticket_number || "—"}`, M, y);
  doc.text(`Case No.: ${data.case_number || "—"}`, W - M, y, { align: "right" });
  y += 14;
  doc.text(`Office: ${data.office_name || "—"}`, M, y);
  doc.text(`Date filed: ${fmtDate(data.filed_at || new Date().toISOString())}`, W - M, y, { align: "right" });
  y += 18;

  const section = (title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setFillColor(245, 248, 246);
    doc.rect(M, y - 10, W - M * 2, 16, "F");
    doc.text(title, M + 6, y);
    y += 14;
    doc.setFont("helvetica", "normal");
  };

  const wrap = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, M, y);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value || "—", W - M * 2 - 110);
    doc.text(lines, M + 110, y);
    y += Math.max(12, lines.length * 12);
  };

  // 1. Complainant(s)
  section("1. Complainant(s)");
  data.complainants.forEach((p, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(p.name || "—", M + 16, y);
    if (p.phone) doc.text(p.phone, W - M, y, { align: "right" });
    y += 12;
    if (p.address) {
      const lines = doc.splitTextToSize(`Address: ${p.address}`, W - M * 2 - 16);
      doc.text(lines, M + 16, y);
      y += lines.length * 12;
    }
    y += 4;
  });

  y += 6;

  // 2. Respondent(s)
  section("2. Respondent(s) / Person(s) Complained Against");
  data.respondents.forEach((p, i) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${i + 1}.`, M, y);
    doc.setFont("helvetica", "normal");
    doc.text(p.name || "—", M + 16, y);
    if (p.phone) doc.text(p.phone, W - M, y, { align: "right" });
    y += 14;
  });

  y += 6;

  // 3. Premises
  section("3. Premises Involved");
  wrap("House No.:", data.premises_house_no || "Nil");
  wrap("Town / Area:", data.premises_town || "—");
  wrap("Full Address:", data.property_address || "—");
  wrap("Region:", data.region || "—");

  y += 6;

  // 4. Complaint Summary
  section("4. Complaint Summary");
  const bullets: string[] = [];
  if (data.rent_amount) bullets.push(`Monthly rent: ${fmtMoney(data.rent_amount)}`);
  if (data.deposit_amount) bullets.push(`Deposit paid: ${fmtMoney(data.deposit_amount)}`);
  if (data.agreement_expiry_date) bullets.push(`Agreement expired: ${fmtDate(data.agreement_expiry_date)}`);
  if (data.occupied_months != null) bullets.push(`Occupied for ${data.occupied_months} month${data.occupied_months === 1 ? "" : "s"}`);
  if (data.tenants_intent) bullets.push(`Tenant's stated intent: ${data.tenants_intent}`);
  if (data.description) bullets.push(data.description);
  if (data.relief_sought) bullets.push(`Relief sought: ${data.relief_sought}`);

  doc.setFont("helvetica", "normal");
  bullets.forEach((b) => {
    const lines = doc.splitTextToSize(`•  ${b}`, W - M * 2 - 8);
    if (y + lines.length * 12 > 760) {
      doc.addPage();
      y = M;
    }
    doc.text(lines, M + 4, y);
    y += lines.length * 12 + 2;
  });

  y += 18;

  // Signature / Stamp box
  if (y > 700) { doc.addPage(); y = M; }
  doc.setDrawColor(180);
  doc.rect(M, y, (W - M * 2) / 2 - 8, 70);
  doc.rect(M + (W - M * 2) / 2 + 8, y, (W - M * 2) / 2 - 8, 70);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.text("Signature of Complainant", M + 6, y + 64);
  doc.text("Rent Control Department — Received", M + (W - M * 2) / 2 + 14, y + 64);

  // Footer
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

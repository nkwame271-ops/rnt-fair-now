import jsPDF from "jspdf";
import { formatGHSDecimal } from "@/lib/formatters";

export interface ComplaintPdfData {
  complaintCode: string;
  ticketNumber?: string | null;
  filedAt: string;
  status: string;
  paymentStatus: string;
  type: string;
  description: string;
  region: string;
  propertyAddress: string;
  gpsLocation?: string | null;
  complainant: { name: string; phone?: string | null; email?: string | null; role: "tenant" | "landlord" };
  respondentName: string;
  evidenceUrls?: string[];
  audioUrl?: string | null;
  basket?: Array<{ label: string; kind: string; amount: number; igf_pct: number; admin_pct: number; platform_pct: number }>;
  basketTotal?: number | null;
  assignedStaff?: { name: string; office?: string | null; assignedAt: string } | null;
  assignmentHistory?: Array<{ name: string; assignedAt: string; unassignedAt: string | null; assignedBy?: string | null }>;
  appointment?: { date: string; timeStart: string; timeEnd: string; status: string } | null;
  officeName?: string | null;
}

export const generateComplaintPdf = (d: ComplaintPdfData) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  // Header
  doc.setFontSize(16); doc.setFont("helvetica", "bold");
  doc.text("Complaint Record", margin, y); y += 6;
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
  doc.text(`Generated ${new Date().toLocaleString("en-GB")}`, margin, y);
  doc.setTextColor(0); y += 8;

  // Code chip row
  doc.setDrawColor(220); doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, y, pageW - margin * 2, 14, 2, 2, "FD");
  doc.setFontSize(11); doc.setFont("helvetica", "bold");
  doc.text(d.complaintCode, margin + 4, y + 6);
  if (d.ticketNumber) {
    doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text(`Ticket: ${d.ticketNumber}`, margin + 4, y + 11);
  }
  doc.setTextColor(0); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`Status: ${d.status.replace(/_/g, " ")}`, pageW - margin - 70, y + 6);
  doc.text(`Payment: ${d.paymentStatus}`, pageW - margin - 70, y + 11);
  y += 20;

  const section = (title: string) => {
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text(title, margin, y); y += 5;
    doc.setDrawColor(220); doc.line(margin, y, pageW - margin, y); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  };
  const kv = (label: string, value: string) => {
    doc.setTextColor(110); doc.text(`${label}:`, margin, y);
    doc.setTextColor(0);
    const lines = doc.splitTextToSize(value || "—", pageW - margin * 2 - 40);
    doc.text(lines, margin + 38, y);
    y += 5 * lines.length;
  };

  section("Complaint Details");
  kv("Type", d.type);
  kv("Filed", new Date(d.filedAt).toLocaleString("en-GB"));
  kv("Region", d.region);
  kv("Office", d.officeName || "—");
  kv("Address", d.propertyAddress);
  if (d.gpsLocation) kv("GPS", d.gpsLocation);
  y += 2;

  section("Description");
  const descLines = doc.splitTextToSize(d.description || "—", pageW - margin * 2);
  doc.setFontSize(10); doc.text(descLines, margin, y);
  y += 5 * descLines.length + 4;

  section("Complainant");
  kv(d.complainant.role === "tenant" ? "Tenant" : "Landlord", d.complainant.name);
  kv("Phone", d.complainant.phone || "—");
  kv("Email", d.complainant.email || "—");
  y += 2;

  section("Respondent");
  kv(d.complainant.role === "tenant" ? "Landlord" : "Tenant", d.respondentName);
  y += 2;

  if (d.basket && d.basket.length > 0) {
    if (y > 240) { doc.addPage(); y = 16; }
    section("Charges Billed");
    doc.setFontSize(9);
    doc.setTextColor(110);
    doc.text("Item", margin, y); doc.text("Splits (IGF/Adm/Plt)", margin + 90, y); doc.text("Amount", pageW - margin - 24, y);
    y += 4;
    doc.setDrawColor(230); doc.line(margin, y, pageW - margin, y); y += 3;
    doc.setTextColor(0);
    d.basket.forEach((b) => {
      const lines = doc.splitTextToSize(`${b.label}${b.kind === "manual_adjustment" ? " (manual)" : ""}`, 80);
      doc.text(lines, margin, y);
      doc.text(`${b.igf_pct}/${b.admin_pct}/${b.platform_pct}%`, margin + 90, y);
      doc.text(formatGHSDecimal(b.amount), pageW - margin - 24, y);
      y += 5 * lines.length;
    });
    if (d.basketTotal != null) {
      doc.setFont("helvetica", "bold");
      doc.text("Total", margin, y);
      doc.text(formatGHSDecimal(d.basketTotal), pageW - margin - 24, y);
      doc.setFont("helvetica", "normal");
      y += 6;
    }
  }

  if (d.assignedStaff || (d.assignmentHistory && d.assignmentHistory.length > 0)) {
    if (y > 240) { doc.addPage(); y = 16; }
    section("Staff Assignment");
    if (d.assignedStaff) {
      kv("Currently assigned to", `${d.assignedStaff.name}${d.assignedStaff.office ? ` (${d.assignedStaff.office})` : ""}`);
      kv("Assigned at", new Date(d.assignedStaff.assignedAt).toLocaleString("en-GB"));
    } else {
      kv("Currently assigned to", "Unassigned");
    }
    if (d.assignmentHistory && d.assignmentHistory.length > 0) {
      y += 1;
      doc.setFontSize(9); doc.setTextColor(110);
      doc.text("History", margin, y); y += 4;
      doc.setTextColor(0);
      d.assignmentHistory.forEach((h) => {
        const range = `${new Date(h.assignedAt).toLocaleDateString("en-GB")} → ${h.unassignedAt ? new Date(h.unassignedAt).toLocaleDateString("en-GB") : "current"}`;
        doc.text(`• ${h.name} — ${range}`, margin + 2, y);
        y += 4;
      });
      doc.setFontSize(10);
    }
    y += 2;
  }

  if (d.appointment) {
    if (y > 250) { doc.addPage(); y = 16; }
    section("Appointment");
    kv("Date", new Date(d.appointment.date).toLocaleDateString("en-GB"));
    kv("Time", `${d.appointment.timeStart} – ${d.appointment.timeEnd}`);
    kv("Status", d.appointment.status);
    y += 2;
  }

  if ((d.evidenceUrls && d.evidenceUrls.length > 0) || d.audioUrl) {
    if (y > 250) { doc.addPage(); y = 16; }
    section("Attachments");
    doc.setFontSize(9);
    if (d.audioUrl) { doc.text(`• Audio recording: ${d.audioUrl}`, margin, y); y += 4; }
    (d.evidenceUrls || []).forEach((u, i) => {
      doc.text(`• Evidence ${i + 1}: ${u}`, margin, y); y += 4;
    });
  }

  doc.save(`complaint_${d.complaintCode}.pdf`);
};

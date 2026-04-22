import jsPDF from "jspdf";
import { formatGHSDecimal } from "@/lib/formatters";

export interface ComplaintReportRow {
  code: string;
  ticket?: string | null;
  type: string;
  complainant: string;
  respondent: string;
  region: string;
  office: string;
  status: string;
  paymentStatus: string;
  basketTotal: number | null;
  assignee: string;
  filedAt: string;
  resolvedAt?: string | null;
  daysOpen: number;
}

export interface AssignmentReportRow {
  staffName: string;
  office: string;
  totalAssigned: number;
  active: number;
  resolved: number;
  reassignments: number;
  avgResolutionDays: number | null;
}

export const downloadCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
};

export const generateComplaintReportPdf = (rows: ComplaintReportRow[], opts: { title?: string; from?: string; to?: string } = {}) => {
  const doc = new jsPDF({ orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 14;

  doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text(opts.title || "Complaint Report", margin, y); y += 6;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  const subtitle = `${rows.length} complaint(s)` + (opts.from || opts.to ? ` • ${opts.from || "…"} → ${opts.to || "…"}` : "");
  doc.text(subtitle, margin, y); y += 6;
  doc.setTextColor(0);

  const headers = ["Code", "Type", "Complainant", "Respondent", "Office", "Status", "Pay", "Total", "Assignee", "Filed", "Days"];
  const widths = [22, 30, 35, 35, 25, 22, 14, 22, 32, 22, 12];
  doc.setFontSize(8); doc.setFont("helvetica", "bold");
  let x = margin;
  headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
  y += 3;
  doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 3;
  doc.setFont("helvetica", "normal");

  rows.forEach((r) => {
    if (y > 195) { doc.addPage(); y = 14; }
    x = margin;
    const cells = [
      r.code,
      r.type.slice(0, 22),
      r.complainant.slice(0, 22),
      r.respondent.slice(0, 22),
      r.office.slice(0, 16),
      r.status.replace(/_/g, " ").slice(0, 14),
      r.paymentStatus.slice(0, 8),
      r.basketTotal != null ? formatGHSDecimal(r.basketTotal) : "—",
      r.assignee.slice(0, 22),
      new Date(r.filedAt).toLocaleDateString("en-GB"),
      String(r.daysOpen),
    ];
    cells.forEach((c, i) => { doc.text(c, x, y); x += widths[i]; });
    y += 5;
  });

  doc.save(`complaint_report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const generateAssignmentReportPdf = (rows: AssignmentReportRow[]) => {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 16;

  doc.setFontSize(15); doc.setFont("helvetica", "bold");
  doc.text("Staff Assignment Report", margin, y); y += 6;
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(110);
  doc.text(`${rows.length} staff member(s) — generated ${new Date().toLocaleString("en-GB")}`, margin, y); y += 8;
  doc.setTextColor(0);

  const headers = ["Staff", "Office", "Total", "Active", "Resolved", "Reassign", "Avg Days"];
  const widths = [40, 35, 18, 18, 22, 22, 22];
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  let x = margin;
  headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
  y += 3;
  doc.setDrawColor(200); doc.line(margin, y, pageW - margin, y); y += 4;
  doc.setFont("helvetica", "normal");

  rows.forEach((r) => {
    if (y > 270) { doc.addPage(); y = 16; }
    x = margin;
    const cells = [
      r.staffName.slice(0, 28),
      r.office.slice(0, 24),
      String(r.totalAssigned),
      String(r.active),
      String(r.resolved),
      String(r.reassignments),
      r.avgResolutionDays != null ? r.avgResolutionDays.toFixed(1) : "—",
    ];
    cells.forEach((c, i) => { doc.text(c, x, y); x += widths[i]; });
    y += 6;
  });

  doc.save(`staff_assignment_report_${new Date().toISOString().slice(0, 10)}.pdf`);
};

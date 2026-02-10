import jsPDF from "jspdf";

export interface AgreementPdfData {
  registrationCode: string;
  landlordName: string;
  tenantName: string;
  tenantId: string;
  propertyName: string;
  propertyAddress: string;
  unitName: string;
  unitType: string;
  monthlyRent: number;
  advanceMonths: number;
  startDate: string;
  endDate: string;
  region: string;
}

export const generateAgreementPdf = (data: AgreementPdfData) => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  const center = (text: string, yPos: number, size = 12, style: "normal" | "bold" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.text(text, w / 2, yPos, { align: "center" });
  };

  const left = (text: string, yPos: number, size = 11, style: "normal" | "bold" = "normal") => {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    doc.text(text, 20, yPos);
  };

  const line = (yPos: number) => {
    doc.setDrawColor(34, 87, 45);
    doc.setLineWidth(0.5);
    doc.line(20, yPos, w - 20, yPos);
  };

  // Header
  doc.setFillColor(34, 87, 45);
  doc.rect(0, 0, w, 12, "F");
  doc.setFillColor(252, 209, 22);
  doc.rect(0, 12, w, 4, "F");

  y = 28;
  center("REPUBLIC OF GHANA", y, 10, "bold");
  y += 7;
  center("RENT CONTROL DEPARTMENT", y, 16, "bold");
  y += 7;
  center("Ministry of Works and Housing", y, 10);
  y += 10;
  line(y);
  y += 10;

  center("TENANCY AGREEMENT", y, 18, "bold");
  y += 6;
  center("(Pursuant to the Rent Act, 1963 — Act 220)", y, 10);
  y += 12;

  // Registration
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y - 4, w - 40, 12, "F");
  left(`Registration Code: ${data.registrationCode}`, y + 3, 11, "bold");
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, w - 20, y + 3, { align: "right" });
  y += 18;

  // Parties
  left("PARTIES TO THIS AGREEMENT", y, 13, "bold");
  y += 10;

  left("LANDLORD:", y, 11, "bold");
  left(data.landlordName, y + 6, 11);
  y += 16;

  left("TENANT:", y, 11, "bold");
  left(`${data.tenantName}  (ID: ${data.tenantId})`, y + 6, 11);
  y += 20;

  line(y);
  y += 10;

  // Property details
  left("PROPERTY DETAILS", y, 13, "bold");
  y += 10;

  const details = [
    ["Property:", data.propertyName],
    ["Address:", data.propertyAddress],
    ["Unit:", `${data.unitName} (${data.unitType})`],
    ["Region:", data.region],
  ];

  details.forEach(([label, value]) => {
    left(label, y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y);
    y += 7;
  });

  y += 5;
  line(y);
  y += 10;

  // Financial terms
  left("FINANCIAL TERMS", y, 13, "bold");
  y += 10;

  const financial = [
    ["Monthly Rent:", `GH₵ ${data.monthlyRent.toLocaleString()}`],
    ["Advance Period:", `${data.advanceMonths} month(s)`],
    ["Total Advance:", `GH₵ ${(data.monthlyRent * data.advanceMonths).toLocaleString()}`],
    ["Govt. Tax (8%):", `GH₵ ${(data.monthlyRent * 0.08).toLocaleString()} per month`],
    ["To Landlord (92%):", `GH₵ ${(data.monthlyRent * 0.92).toLocaleString()} per month`],
    ["Tenancy Start:", new Date(data.startDate).toLocaleDateString("en-GB")],
    ["Tenancy End:", new Date(data.endDate).toLocaleDateString("en-GB")],
  ];

  financial.forEach(([label, value]) => {
    left(label, y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.text(value, 75, y);
    y += 7;
  });

  y += 5;
  line(y);
  y += 10;

  // Terms
  left("KEY TERMS & CONDITIONS", y, 13, "bold");
  y += 10;

  const terms = [
    "1. The Tenant shall pay rent monthly, including the statutory 8% government tax through the Rent Control app.",
    "2. Advance rent shall not exceed 6 months as mandated by Act 220.",
    "3. This agreement must be registered within 14 days of signing.",
    "4. The Landlord shall maintain the property in habitable condition.",
    "5. Neither party may unilaterally vary the terms without due process.",
    "6. The tenancy is only valid for months where the 8% tax has been paid.",
  ];

  terms.forEach((term) => {
    const lines = doc.splitTextToSize(term, w - 45);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  // Signatures
  y += 5;
  line(y);
  y += 15;

  left("____________________________", y);
  doc.text("____________________________", w - 20, y, { align: "right" });
  y += 6;
  left("Landlord Signature", y, 9);
  doc.setFontSize(9);
  doc.text("Tenant Signature", w - 20, y, { align: "right" });

  // Footer
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFillColor(252, 209, 22);
  doc.rect(0, y + 5, w, 4, "F");
  doc.setFillColor(34, 87, 45);
  doc.rect(0, y + 9, w, 12, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  center("This is an electronically generated agreement by the Rent Control Department of Ghana.", y);
  center(`Verification: ${data.registrationCode} • rentcontrol.gov.gh/verify`, y + 4);

  return doc;
};

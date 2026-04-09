import jsPDF from "jspdf";
import QRCode from "qrcode";
import { formatGHS } from "@/lib/formatters";

export interface TemplateConfig {
  max_advance_months: number;
  min_lease_duration: number;
  max_lease_duration: number;
  tax_rate: number;
  tax_rates?: Record<string, number>;
  registration_deadline_days: number;
  terms: string[];
}

export interface CustomFieldDef {
  label: string;
  type: "text" | "number" | "date";
  required: boolean;
}

export interface SignatureData {
  name: string;
  signedAt: string;
  method?: string;
}

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
  templateConfig?: TemplateConfig;
  customFields?: CustomFieldDef[];
  customFieldValues?: Record<string, string>;
  landlordSignature?: SignatureData;
  tenantSignature?: SignatureData;
  serialCode?: string;
  version?: number;
  rentCardSerials?: { landlord?: string; tenant?: string };
  // Enhanced fields
  gpsAddress?: string;
  ghanaPostGps?: string;
  tenantPhone?: string;
  landlordPhone?: string;
  bedroomCount?: number;
  bathroomCount?: number;
  propertyCondition?: string;
  amenities?: string[];
  facilities?: {
    hasToiletBathroom?: boolean;
    hasKitchen?: boolean;
    waterAvailable?: boolean;
    electricityAvailable?: boolean;
    hasBorehole?: boolean;
    hasPolytank?: boolean;
  };
  propertyId?: string;
  tenancyId?: string;
}

const DEFAULT_TERMS = [
  "The Tenant shall pay rent monthly, including the statutory 8% government tax through the Rent Control app.",
  "Advance rent shall not exceed 6 months as mandated by Act 220.",
  "This agreement must be registered within 14 days of signing.",
  "The Landlord shall maintain the property in habitable condition.",
  "Neither party may unilaterally vary the terms without due process.",
  "The tenancy is only valid for months where the 8% tax has been paid.",
];

const generateSerialCode = (registrationCode: string): string => {
  const year = new Date().getFullYear();
  const random = String(Math.floor(10000 + Math.random() * 90000));
  const check = String(Math.floor(1000 + Math.random() * 9000));
  return `AGR-${year}-${random}-${check}`;
};

export const generateAgreementPdf = async (data: AgreementPdfData): Promise<jsPDF> => {
  const doc = new jsPDF();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  let y = 20;
  const taxRate = (data.templateConfig?.tax_rate ?? 8) / 100;
  const terms = data.templateConfig?.terms ?? DEFAULT_TERMS;
  const serialCode = data.serialCode || generateSerialCode(data.registrationCode);
  const version = data.version || 1;

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

  const checkPage = (needed: number) => {
    if (y + needed > h - 40) { doc.addPage(); y = 20; }
  };

  // Generate QR code
  const verifyUrl = data.tenancyId
    ? `https://www.rentcontrolghana.com/verify-tenancy/${data.tenancyId}`
    : `https://www.rentcontrolghana.com/verify-tenancy/${data.registrationCode}`;
  let qrDataUrl = "";
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1, errorCorrectionLevel: "H" });
  } catch { /* QR generation failed, continue without */ }

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
  y += 6;
  if (version > 1) {
    doc.setTextColor(34, 87, 45);
    center(`EXECUTED — Version ${version}`, y, 9, "bold");
    doc.setTextColor(0);
  }
  y += 10;

  // Serial & QR section
  doc.setFillColor(245, 245, 245);
  doc.rect(20, y - 4, w - 40, 30, "F");
  doc.setDrawColor(34, 87, 45);
  doc.setLineWidth(0.3);
  doc.rect(20, y - 4, w - 40, 30, "S");

  left(`Registration Code: ${data.registrationCode}`, y + 3, 11, "bold");
  doc.setFontSize(9);
  doc.text(`Date: ${new Date().toLocaleDateString("en-GB")}`, w - 25, y + 3, { align: "right" });
  left(`Serial: ${serialCode}`, y + 11, 9, "bold");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text("ORIGINAL DOCUMENT — Unique serial. Verify at rentcontrolghana.com/verify", 20, y + 19);
  doc.setTextColor(0);

  // QR code in top-right corner
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", w - 50, y - 2, 24, 24);
  }
  y += 36;

  // Parties
  left("PARTIES TO THIS AGREEMENT", y, 13, "bold");
  y += 10;
  left("LANDLORD:", y, 11, "bold");
  left(data.landlordName, y + 6, 11);
  if (data.landlordPhone) {
    doc.setFontSize(9);
    doc.text(`Phone: ${data.landlordPhone}`, 80, y + 6);
  }
  y += 16;
  left("TENANT:", y, 11, "bold");
  left(`${data.tenantName}  (ID: ${data.tenantId})`, y + 6, 11);
  if (data.tenantPhone) {
    doc.setFontSize(9);
    doc.text(`Phone: ${data.tenantPhone}`, 80, y + 12);
    y += 6;
  }
  y += 20;
  line(y);
  y += 10;

  // Property Location
  left("PROPERTY LOCATION", y, 13, "bold");
  y += 10;
  const locationDetails: [string, string][] = [
    ["Property:", data.propertyName],
    ["Address:", data.propertyAddress],
    ["Region:", data.region],
  ];
  if (data.ghanaPostGps) locationDetails.push(["Ghana Post GPS:", data.ghanaPostGps]);
  if (data.gpsAddress) locationDetails.push(["GPS Coordinates:", data.gpsAddress]);
  locationDetails.forEach(([label, value]) => {
    left(label, y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y);
    y += 7;
  });
  y += 5;
  line(y);
  y += 10;

  // Type of Accommodation
  checkPage(40);
  left("TYPE OF ACCOMMODATION", y, 13, "bold");
  y += 10;
  const accomDetails: [string, string][] = [
    ["Unit:", `${data.unitName} (${data.unitType})`],
  ];
  if (data.bedroomCount !== undefined && data.bedroomCount > 0) accomDetails.push(["Bedrooms:", String(data.bedroomCount)]);
  if (data.bathroomCount !== undefined && data.bathroomCount > 0) accomDetails.push(["Bathrooms:", String(data.bathroomCount)]);
  accomDetails.forEach(([label, value]) => {
    left(label, y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.text(value, 65, y);
    y += 7;
  });

  // Facilities
  if (data.facilities) {
    const facilityList: string[] = [];
    if (data.facilities.hasToiletBathroom) facilityList.push("Toilet/Bathroom");
    if (data.facilities.hasKitchen) facilityList.push("Kitchen");
    if (data.facilities.waterAvailable) facilityList.push("Running Water");
    if (data.facilities.electricityAvailable) facilityList.push("Electricity");
    if (data.facilities.hasBorehole) facilityList.push("Borehole");
    if (data.facilities.hasPolytank) facilityList.push("Polytank");
    if (facilityList.length > 0) {
      left("Facilities:", y, 10, "bold");
      doc.setFont("helvetica", "normal");
      doc.text(facilityList.join(", "), 65, y);
      y += 7;
    }
  }
  y += 5;

  // Available Amenities
  if (data.amenities && data.amenities.length > 0) {
    checkPage(20);
    left("AVAILABLE AMENITIES", y, 13, "bold");
    y += 10;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(data.amenities.join(", "), 20, y);
    y += 10;
  }

  // Condition of Property
  if (data.propertyCondition) {
    checkPage(25);
    left("CONDITION OF PROPERTY", y, 13, "bold");
    y += 10;
    const condLines = doc.splitTextToSize(data.propertyCondition, w - 45);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(condLines, 20, y);
    y += condLines.length * 5 + 5;
  }

  line(y);
  y += 10;

  // Financial terms
  const taxAmount = data.monthlyRent * taxRate;
  const toLandlord = data.monthlyRent * (1 - taxRate);

  checkPage(60);
  left("FINANCIAL TERMS", y, 13, "bold");
  y += 10;
  const financial: [string, string][] = [
    ["Assessed Recoverable Rent Per Month:", formatGHS(data.monthlyRent)],
    ["Advance Period:", `${data.advanceMonths} month(s)`],
    ["Total Advance:", formatGHS(data.monthlyRent * data.advanceMonths)],
    [`Govt. Tax (${(taxRate * 100).toFixed(0)}%):`, `${formatGHS(taxAmount)} per month`],
    [`To Landlord (${((1 - taxRate) * 100).toFixed(0)}%):`, `${formatGHS(toLandlord)} per month`],
    ["Tenancy Start:", new Date(data.startDate).toLocaleDateString("en-GB")],
    ["Tenancy End:", new Date(data.endDate).toLocaleDateString("en-GB")],
  ];
  financial.forEach(([label, value]) => {
    left(label, y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.text(value, 95, y);
    y += 7;
  });
  y += 5;
  line(y);
  y += 10;

  // Terms
  checkPage(20);
  left("KEY TERMS & CONDITIONS", y, 13, "bold");
  y += 10;

  terms.forEach((term, i) => {
    const numberedTerm = `${i + 1}. ${term}`;
    const lines = doc.splitTextToSize(numberedTerm, w - 45);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    checkPage(lines.length * 5 + 5);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 3;
  });

  // Custom fields
  if (data.customFields && data.customFields.length > 0 && data.customFieldValues) {
    y += 5;
    checkPage(30);
    line(y);
    y += 10;
    left("ADDITIONAL INFORMATION", y, 13, "bold");
    y += 10;
    data.customFields.forEach((field) => {
      const value = data.customFieldValues?.[field.label] || "—";
      left(field.label + ":", y, 10, "bold");
      doc.setFont("helvetica", "normal");
      doc.text(value, 85, y);
      y += 7;
      checkPage(10);
    });
  }

  // Rent Card Serials
  if (data.rentCardSerials && (data.rentCardSerials.landlord || data.rentCardSerials.tenant)) {
    y += 5;
    checkPage(30);
    line(y);
    y += 10;
    left("RENT CARDS ASSIGNED TO THIS TENANCY", y, 13, "bold");
    y += 10;
    if (data.rentCardSerials.landlord) {
      left("Rent Card (Landlord Copy):", y, 10, "bold");
      doc.setFont("helvetica", "normal");
      doc.text(data.rentCardSerials.landlord, 85, y);
      y += 7;
    }
    if (data.rentCardSerials.tenant) {
      left("Rent Card (Tenant Copy):", y, 10, "bold");
      doc.setFont("helvetica", "normal");
      doc.text(data.rentCardSerials.tenant, 85, y);
      y += 7;
    }
  }

  // Signatures section
  y += 5;
  checkPage(70);
  line(y);
  y += 10;
  left("SIGNATURES", y, 13, "bold");
  y += 12;

  // Landlord signature
  if (data.landlordSignature) {
    left("Landlord:", y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(data.landlordSignature.name, 20, y + 8);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Signed: ${new Date(data.landlordSignature.signedAt).toLocaleString("en-GB")} • Method: ${data.landlordSignature.method || "Digital"}`, 20, y + 14);
    doc.setTextColor(0);
    y += 20;
  } else {
    left("____________________________", y);
    y += 6;
    left("Landlord Signature", y, 9);
    y += 10;
  }

  // Tenant signature
  if (data.tenantSignature) {
    left("Tenant:", y, 10, "bold");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(data.tenantSignature.name, 20, y + 8);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Signed: ${new Date(data.tenantSignature.signedAt).toLocaleString("en-GB")} • Method: ${data.tenantSignature.method || "Digital"}`, 20, y + 14);
    doc.setTextColor(0);
    y += 20;
  } else {
    left("____________________________", y);
    y += 6;
    left("Tenant Signature", y, 9);
    y += 10;
  }

  // Footer
  y = h - 20;
  doc.setFillColor(252, 209, 22);
  doc.rect(0, y + 5, w, 4, "F");
  doc.setFillColor(34, 87, 45);
  doc.rect(0, y + 9, w, 12, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  center("This is an electronically generated agreement by the Rent Control Department of Ghana.", y);
  center(`Serial: ${serialCode} • Verification: ${data.registrationCode} • rentcontrolghana.com/verify`, y + 4);

  return doc;
};

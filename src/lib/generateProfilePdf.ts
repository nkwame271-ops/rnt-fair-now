import jsPDF from "jspdf";

interface ProfileData {
  role: "tenant" | "landlord";
  roleId: string;
  status: string;
  registrationDate: string | null;
  expiryDate: string | null;
  registrationFeePaid: boolean;
  profile?: {
    full_name: string;
    phone: string;
    email: string | null;
    nationality: string;
    is_citizen: boolean;
    ghana_card_no: string | null;
    residence_permit_no: string | null;
    occupation: string | null;
    work_address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    delivery_address: string | null;
    delivery_region: string | null;
  };
  kyc?: {
    status: string;
    ghana_card_number: string;
    ai_match_score: number | null;
    ai_match_result: string | null;
    reviewer_notes: string | null;
  } | null;
  tenancies?: Array<{
    registration_code: string;
    status: string;
    agreed_rent: number;
    start_date: string;
    end_date: string;
    _landlordName?: string;
    _tenantName?: string;
    _propertyName?: string;
    _unitName?: string;
    _region?: string;
  }>;
  complaints?: Array<{
    complaint_code: string;
    complaint_type: string;
    status: string;
    created_at: string;
  }>;
  properties?: Array<{
    property_code: string;
    property_name: string | null;
    address: string;
    region: string;
    units?: Array<{ unit_name: string; monthly_rent: number; status: string }>;
  }>;
}

export const generateProfilePdf = (data: ProfileData) => {
  const doc = new jsPDF();
  let y = 20;
  const lm = 15;
  const pageW = 180;

  const addLine = (label: string, value: string, bold = false) => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(label, lm, y);
    doc.setTextColor(30);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(value || "—", lm + 55, y);
    y += 6;
  };

  const addSection = (title: string) => {
    if (y > 260) { doc.addPage(); y = 20; }
    y += 4;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20, 80, 60);
    doc.text(title, lm, y);
    y += 2;
    doc.setDrawColor(20, 80, 60);
    doc.line(lm, y, lm + pageW, y);
    y += 6;
  };

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 80, 60);
  doc.text("Rent Control Department — Full Profile Report", lm, y);
  y += 8;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, lm, y);
  y += 10;

  // Basic Info
  addSection(`${data.role === "tenant" ? "Tenant" : "Landlord"} Information`);
  addLine(`${data.role === "tenant" ? "Tenant" : "Landlord"} ID:`, data.roleId, true);
  addLine("Status:", data.status);
  addLine("Fee Paid:", data.registrationFeePaid ? "Yes" : "No");
  addLine("Registered:", data.registrationDate ? new Date(data.registrationDate).toLocaleDateString() : "—");
  addLine("Expires:", data.expiryDate ? new Date(data.expiryDate).toLocaleDateString() : "—");

  // Personal Info
  if (data.profile) {
    addSection("Personal Information");
    addLine("Full Name:", data.profile.full_name, true);
    addLine("Phone:", data.profile.phone);
    addLine("Email:", data.profile.email || "—");
    addLine("Nationality:", data.profile.nationality);
    addLine("Citizen:", data.profile.is_citizen ? "Yes" : "No");
    addLine("ID Number:", data.profile.is_citizen ? data.profile.ghana_card_no || "—" : data.profile.residence_permit_no || "—");
    addLine("Occupation:", data.profile.occupation || "—");
    addLine("Work Address:", data.profile.work_address || "—");
    addLine("Emergency Contact:", data.profile.emergency_contact_name || "—");
    addLine("Emergency Phone:", data.profile.emergency_contact_phone || "—");
    addLine("Delivery Address:", data.profile.delivery_address || "—");
    addLine("Delivery Region:", data.profile.delivery_region || "—");
  }

  // KYC
  addSection("KYC Verification");
  if (data.kyc) {
    addLine("KYC Status:", data.kyc.status);
    addLine("Document Number:", data.kyc.ghana_card_number);
    addLine("AI Match Score:", data.kyc.ai_match_score != null ? `${data.kyc.ai_match_score}%` : "—");
    addLine("AI Match Result:", data.kyc.ai_match_result || "—");
    if (data.kyc.reviewer_notes) addLine("Reviewer Notes:", data.kyc.reviewer_notes);
  } else {
    addLine("KYC Status:", "Not submitted");
  }

  // Properties (landlord)
  if (data.properties && data.properties.length > 0) {
    addSection(`Properties (${data.properties.length})`);
    data.properties.forEach((p) => {
      addLine("Property:", `${p.property_name || "Unnamed"} (${p.property_code})`);
      addLine("Address:", `${p.address}, ${p.region}`);
      (p.units || []).forEach((u) => {
        addLine(`  Unit:`, `${u.unit_name} • GH₵${u.monthly_rent}/mo • ${u.status}`);
      });
      y += 2;
    });
  }

  // Tenancies
  if (data.tenancies && data.tenancies.length > 0) {
    addSection(`Tenancy History (${data.tenancies.length})`);
    data.tenancies.forEach((t) => {
      addLine("Agreement:", `${t.registration_code} (${t.status})`);
      if (t._propertyName) addLine("Property:", `${t._propertyName} • ${t._unitName || ""}`);
      if (t._landlordName) addLine("Landlord:", t._landlordName);
      if (t._tenantName) addLine("Tenant:", t._tenantName);
      addLine("Rent:", `GH₵ ${t.agreed_rent?.toLocaleString()}/mo`);
      addLine("Period:", `${new Date(t.start_date).toLocaleDateString()} — ${new Date(t.end_date).toLocaleDateString()}`);
      y += 2;
    });
  }

  // Complaints
  if (data.complaints && data.complaints.length > 0) {
    addSection(`Complaints (${data.complaints.length})`);
    data.complaints.forEach((c) => {
      addLine("Code:", c.complaint_code);
      addLine("Type:", c.complaint_type);
      addLine("Status:", c.status);
      addLine("Filed:", new Date(c.created_at).toLocaleDateString());
      y += 2;
    });
  }

  // Footer
  if (y > 270) { doc.addPage(); y = 20; }
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This document is generated by the Rent Control Digital Platform. Confidential.", lm, y);

  doc.save(`${data.role}_${data.roleId}_profile.pdf`);
};

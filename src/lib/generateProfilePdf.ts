import jsPDF from "jspdf";
import { formatGHS } from "@/lib/formatters";

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
    _tenantPhone?: string;
    _landlordPhone?: string;
    _propertyId?: string;
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
    gps_location?: string | null;
    ghana_post_gps?: string | null;
    property_condition?: string | null;
    room_count?: number | null;
    bathroom_count?: number | null;
    units?: Array<{
      unit_name: string;
      monthly_rent: number;
      status: string;
      unit_type?: string;
      has_toilet_bathroom?: boolean;
      has_kitchen?: boolean;
      water_available?: boolean;
      electricity_available?: boolean;
      has_borehole?: boolean;
      has_polytank?: boolean;
      amenities?: string[];
    }>;
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

  // Properties (landlord) — enriched with location, accommodation, amenities, condition, facilities
  if (data.properties && data.properties.length > 0) {
    addSection(`Properties (${data.properties.length})`);
    data.properties.forEach((p) => {
      // Property Location
      addLine("Property:", `${p.property_name || "Unnamed"} (${p.property_code})`, true);
      addLine("Address:", `${p.address}, ${p.region}`);
      if (p.ghana_post_gps) addLine("Ghana Post GPS:", p.ghana_post_gps);
      if (p.gps_location) addLine("GPS Coordinates:", p.gps_location);

      // Type of Accommodation & Condition
      if (p.room_count || p.bathroom_count) {
        const accom: string[] = [];
        if (p.room_count) accom.push(`${p.room_count} Bedroom(s)`);
        if (p.bathroom_count) accom.push(`${p.bathroom_count} Bathroom(s)`);
        addLine("Accommodation:", accom.join(", "));
      }
      if (p.property_condition) addLine("Property Condition:", p.property_condition);

      // Units with facilities and amenities
      (p.units || []).forEach((u) => {
        addLine(`  Unit:`, `${u.unit_name}${u.unit_type ? ` (${u.unit_type})` : ""} • ${formatGHS(u.monthly_rent)}/mo • ${u.status}`);

        // Facilities
        const facilities: string[] = [];
        if (u.has_toilet_bathroom) facilities.push("Toilet/Bathroom");
        if (u.has_kitchen) facilities.push("Kitchen");
        if (u.water_available) facilities.push("Running Water");
        if (u.electricity_available) facilities.push("Electricity");
        if (u.has_borehole) facilities.push("Borehole");
        if (u.has_polytank) facilities.push("Polytank");
        if (facilities.length > 0) {
          addLine("  Facilities:", facilities.join(", "));
        }

        // Available Amenities
        if (u.amenities && u.amenities.length > 0) {
          addLine("  Amenities:", u.amenities.join(", "));
        }
      });
      y += 2;
    });
  }

  // Tenancies — enriched with contact details
  if (data.tenancies && data.tenancies.length > 0) {
    addSection(`Tenancy History (${data.tenancies.length})`);
    data.tenancies.forEach((t) => {
      addLine("Agreement:", `${t.registration_code} (${t.status})`);
      if (t._propertyName) addLine("Property:", `${t._propertyName} • ${t._unitName || ""}`);
      if (t._landlordName) {
        let landlordInfo = t._landlordName;
        if (t._landlordPhone) landlordInfo += ` (${t._landlordPhone})`;
        addLine("Landlord:", landlordInfo);
      }
      if (t._tenantName) {
        let tenantInfo = t._tenantName;
        if (t._tenantPhone) tenantInfo += ` (${t._tenantPhone})`;
        addLine("Tenant:", tenantInfo);
      }
      addLine("Assessed Recoverable Rent Per Month:", formatGHS(t.agreed_rent));
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

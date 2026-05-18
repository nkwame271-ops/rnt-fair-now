import { supabase } from "@/integrations/supabase/client";
import { renderForm7, Form7Data, Form7Party } from "@/lib/pdf/form7";
import { renderForm33, Form33Data } from "@/lib/pdf/form33";

const uploadPdf = async (caseId: string, formCode: string, version: number, blob: Blob) => {
  const path = `complaints/${caseId}/${formCode}-v${version}.pdf`;
  const { error } = await supabase.storage
    .from("form-outputs")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
};

const partiesFromComplaint = (c: any, kind: "complainants" | "respondents"): Form7Party[] => {
  const arr = Array.isArray(c?.[kind]) ? c[kind] : [];
  if (arr.length) return arr.map((p: any) => ({ name: p.name, phone: p.phone, address: p.address }));
  if (kind === "complainants") {
    return [{
      name: c.placeholder_complainant_name || c.complainant_name || "—",
      phone: c.placeholder_complainant_phone || undefined,
      address: c.complainant_address || undefined,
    }];
  }
  return [{
    name: c.placeholder_respondent_name || c.landlord_name || "—",
    phone: c.placeholder_respondent_phone || undefined,
  }];
};

const officeName = async (officeId?: string | null): Promise<{ name: string; region?: string }> => {
  if (!officeId) return { name: "Rent Control Department" };
  const { data } = await supabase.from("offices").select("name, region").eq("id", officeId).maybeSingle();
  return { name: data?.name || "Rent Control Department", region: data?.region };
};

const insertDoc = async (
  caseId: string,
  formType: "form_7" | "form_33",
  title: string,
  status: "draft" | "finalized",
  path: string | null,
  metadata: Record<string, any>
) => {
  const { data: existing } = await supabase
    .from("complaint_documents")
    .select("id, version_number")
    .eq("case_id", caseId)
    .eq("form_type", formType)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version_number || 0) + 1;
  const { data: auth } = await supabase.auth.getUser();
  const { data: inserted, error } = await supabase
    .from("complaint_documents")
    .insert({
      case_id: caseId,
      case_kind: "complaint",
      form_type: formType,
      version_number: nextVersion,
      status,
      file_url: path,
      title,
      generated_by: auth.user?.id,
      finalized_by: status === "finalized" ? auth.user?.id : null,
      finalized_at: status === "finalized" ? new Date().toISOString() : null,
      change_reason: "Auto-generated",
      metadata,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted.id, version: nextVersion };
};

export async function autoGenerateForm7(caseId: string, complaint: any) {
  const office = await officeName(complaint.office_id);
  const data: Form7Data = {
    ticket_number: complaint.ticket_number,
    case_number: complaint.case_number,
    complainants: partiesFromComplaint(complaint, "complainants"),
    respondents: partiesFromComplaint(complaint, "respondents"),
    premises_house_no: complaint.premises_house_no,
    premises_town: complaint.premises_town,
    property_address: complaint.property_address,
    region: complaint.region,
    rent_amount: complaint.rent_amount,
    deposit_amount: complaint.deposit_amount,
    agreement_expiry_date: complaint.agreement_expiry_date,
    occupied_months: complaint.occupied_months,
    tenants_intent: complaint.tenants_intent,
    description: complaint.description,
    relief_sought: complaint.relief_sought,
    filed_at: complaint.created_at || new Date().toISOString(),
    office_name: office.name,
  };
  const blob = renderForm7(data).output("blob");
  const path = await uploadPdf(caseId, "form-7", Date.now() % 100000, blob);
  return insertDoc(caseId, "form_7", "Form 7 — Complaint", "finalized", path, { autofilled: true });
}

export async function generateForm33Draft(
  caseId: string,
  complaint: any,
  hearing: { scheduled_at: string; venue?: string }
) {
  // Ensure a CAR case number exists
  let caseNumber = complaint.case_number as string | null;
  if (!caseNumber) {
    const { data: cn } = await supabase.rpc("issue_car_case_number" as any);
    caseNumber = (cn as string) || null;
    if (caseNumber) {
      await supabase
        .from("complaints")
        .update({ case_number: caseNumber, summons_issued_at: new Date().toISOString() })
        .eq("id", caseId);
    }
  }

  const office = await officeName(complaint.office_id);
  const respondents = partiesFromComplaint(complaint, "respondents");
  const complainants = partiesFromComplaint(complaint, "complainants");

  // One summons per respondent
  const results: any[] = [];
  for (const r of respondents) {
    const data: Form33Data = {
      case_number: caseNumber || "—",
      ticket_number: complaint.ticket_number,
      office_name: office.name,
      office_region: office.region,
      complainants,
      respondents,
      person_summoned: r.name,
      nature_of_complaint: complaint.complaint_type || "—",
      appearance_at: hearing.scheduled_at,
      venue: hearing.venue || office.name,
      issued_at_location: office.name,
      date_issued: new Date().toISOString(),
      hearing_officer_name: complaint.hearing_officer_name,
    };
    const blob = renderForm33(data).output("blob");
    const path = await uploadPdf(caseId, `form-33-${r.name.replace(/\W+/g, "_").toLowerCase()}`, Date.now() % 100000, blob);
    const doc = await insertDoc(
      caseId,
      "form_33",
      `Form 33 — Summons (${r.name})`,
      "draft",
      path,
      { respondent: r.name, hearing }
    );
    results.push(doc);
  }
  return { case_number: caseNumber, documents: results };
}

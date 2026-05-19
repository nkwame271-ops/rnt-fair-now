import { supabase } from "@/integrations/supabase/client";
import { renderForm7, Form7Data } from "@/lib/pdf/form7";
import { renderForm33, Form33Data } from "@/lib/pdf/form33";
import { renderForm32A, Form32AData } from "@/lib/pdf/form32a";

export type StatutoryFormType = "form_7" | "form_33" | "form_32a";

const uploadPdf = async (caseId: string, formCode: string, version: number, blob: Blob) => {
  const path = `complaints/${caseId}/${formCode}-v${version}-${Date.now()}.pdf`;
  const { error } = await supabase.storage
    .from("form-outputs")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
};

const insertDoc = async (
  caseId: string,
  formType: StatutoryFormType,
  title: string,
  status: "draft" | "finalized",
  path: string | null,
  formData: Record<string, any>,
  metadata: Record<string, any> = {}
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
      change_reason: metadata.change_reason || "Generated from Form Editor",
      metadata,
      form_data_json: formData,
    } as any)
    .select("id")
    .single();
  if (error) throw error;
  return { id: inserted.id, version: nextVersion, path };
};

/** Prefill a Form 7 editor payload from a complaint row. */
export function prefillForm7(c: any, officeName?: string): Form7Data {
  const complainants = Array.isArray(c.complainants) ? c.complainants : [];
  const respondents = Array.isArray(c.respondents) ? c.respondents : [];
  const primaryC = complainants[0] || {};
  const respondentText = respondents.length
    ? respondents.map((r: any) => `${r.name || ""}${r.address ? " — " + r.address : ""}${r.phone ? " (" + r.phone + ")" : ""}`).join("\n")
    : c.placeholder_respondent_name || c.landlord_name || "";

  return {
    case_reference: c.ticket_number || "",
    case_number: c.case_number || "",
    ticket_number: c.ticket_number,
    complainant_name: primaryC.name || c.placeholder_complainant_name || c.complainant_name || "",
    complainant_postal_address: primaryC.address || c.complainant_address || c.property_address || "",
    complainant_telephone: primaryC.phone || c.placeholder_complainant_phone || c.complainant_phone || "",
    respondent_name_address: respondentText,
    premises_address: c.property_address || "",
    premises_house_no: c.premises_house_no || "",
    complaint_category: c.complaint_type || "",
    complaint_statement: c.description || "",
    rent_office: officeName || "",
    signature_name: primaryC.name || c.placeholder_complainant_name || "",
    signature_date: c.created_at || new Date().toISOString(),
    stamp_text: "Rent Control Department — Received",
    footer_slogan: "We Promote Peace & Reconcile Parties",
    filed_at: c.created_at,
  };
}

/** Prefill a Form 33 editor payload from a complaint row + optional hearing. */
export function prefillForm33(c: any, officeName?: string, hearing?: { scheduled_at?: string; venue?: string; officer_name?: string }): Form33Data {
  const complainants = Array.isArray(c.complainants) ? c.complainants : [];
  const respondents = Array.isArray(c.respondents) ? c.respondents : [];
  const primaryC = complainants[0] || {};
  const cNames = complainants.map((x: any) => x.name).filter(Boolean).join(", ")
    || c.placeholder_complainant_name || c.complainant_name || "Complainant";
  const rNames = respondents.map((x: any) => x.name).filter(Boolean).join(", ")
    || c.placeholder_respondent_name || c.landlord_name || "Respondent";
  const primaryR = respondents[0]?.name || c.placeholder_respondent_name || c.landlord_name || "";

  return {
    case_prefix: "CA",
    case_number: c.case_number || "",
    parties_line: `${cNames} VRS ${rNames}`,
    rent_office: officeName || c.hearing_venue || "",
    rent_officer: hearing?.officer_name || c.hearing_officer_name || "",
    person_summoned: primaryR,
    complaint_category: c.complaint_type || "",
    hearing_time: hearing?.scheduled_at || c.next_hearing_at || "",
    hearing_date: hearing?.scheduled_at || c.next_hearing_at || "",
    hearing_venue: hearing?.venue || c.hearing_venue || officeName || "",
    summons_paragraph: "",
    issued_office: officeName || "",
    issued_date: new Date().toISOString(),
    signature_name: hearing?.officer_name || c.hearing_officer_name || "",
    stamp_text: "Rent Control Department",
    footer_slogan: "We Promote Peace & Reconcile Parties",
    ticket_number: c.ticket_number,
    complainant_name: primaryC.name || c.placeholder_complainant_name || c.complainant_name || "",
    complainant_phone: primaryC.phone || c.placeholder_complainant_phone || c.complainant_phone || "",
    complainant_address: primaryC.address || c.complainant_address || c.property_address || "",
    body_font_size: 10,
  };
}

/** Prefill a Form 32A editor payload from a complaint row. */
export function prefillForm32A(c: any, officeName?: string): Form32AData {
  const complainants = Array.isArray(c.complainants) ? c.complainants : [];
  const respondents = Array.isArray(c.respondents) ? c.respondents : [];
  const cNames = complainants.map((x: any) => x.name).filter(Boolean).join(", ")
    || c.placeholder_complainant_name || c.complainant_name || "Complainant";
  const rNames = respondents.map((x: any) => x.name).filter(Boolean).join(", ")
    || c.placeholder_respondent_name || c.landlord_name || "Respondent";
  return {
    case_number: c.case_number || "",
    parties_line: `${cNames} VRS ${rNames}`,
    rent_office: officeName || "",
    rent_officer: c.hearing_officer_name || "",
    hearing_reference: c.next_hearing_at ? new Date(c.next_hearing_at).toLocaleString() : "",
    decision_body: "",
    issued_office: officeName || "",
    issued_date: new Date().toISOString(),
    signature_name: c.hearing_officer_name || "",
    stamp_text: "Rent Control Department",
    footer_slogan: "We Promote Peace & Reconcile Parties",
    ticket_number: c.ticket_number,
  };
}

/** Render a given form payload to PDF and persist as a finalized complaint_documents row. */
export async function generateStatutoryForm(
  caseId: string,
  formType: StatutoryFormType,
  formData: Form7Data | Form33Data | Form32AData,
  opts: { title?: string; metadata?: Record<string, any> } = {}
) {
  let blob: Blob;
  let code: string;
  let defaultTitle: string;
  if (formType === "form_7") {
    blob = renderForm7(formData as Form7Data).output("blob");
    code = "form-7";
    defaultTitle = "Form 7 — Complaint";
  } else if (formType === "form_33") {
    blob = renderForm33(formData as Form33Data).output("blob");
    code = "form-33";
    defaultTitle = "Form 33 — Summons";
  } else {
    blob = renderForm32A(formData as Form32AData).output("blob");
    code = "form-32a";
    defaultTitle = "Form 32A — Order / Decision";
  }
  // Pre-compute next version for filename uniqueness
  const { data: existing } = await supabase
    .from("complaint_documents")
    .select("version_number")
    .eq("case_id", caseId)
    .eq("form_type", formType)
    .order("version_number", { ascending: false })
    .limit(1);
  const nextVersion = (existing?.[0]?.version_number || 0) + 1;
  const path = await uploadPdf(caseId, code, nextVersion, blob);
  return insertDoc(caseId, formType, opts.title || defaultTitle, "finalized", path, formData as any, opts.metadata || {});
}

/* ---- Backwards-compatible helpers used by older call sites ---- */

const officeName = async (officeId?: string | null): Promise<string> => {
  if (!officeId) return "Rent Control Department";
  const { data } = await supabase.from("offices").select("name").eq("id", officeId).maybeSingle();
  return data?.name || "Rent Control Department";
};

export async function autoGenerateForm7(caseId: string, complaint: any) {
  const office = await officeName(complaint.office_id);
  const data = prefillForm7(complaint, office);
  return generateStatutoryForm(caseId, "form_7", data, { metadata: { autofilled: true } });
}

export async function generateForm33Draft(
  caseId: string,
  complaint: any,
  hearing: { scheduled_at: string; venue?: string }
) {
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
  const data = prefillForm33({ ...complaint, case_number: caseNumber || complaint.case_number }, office, hearing);
  const result = await generateStatutoryForm(caseId, "form_33", data, { metadata: { hearing } });
  return { case_number: caseNumber, documents: [result] };
}

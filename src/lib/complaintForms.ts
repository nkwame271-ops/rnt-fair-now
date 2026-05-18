import { supabase } from "@/integrations/supabase/client";
import { generateDynamicFormPdf, FormSchema, FormLayout } from "@/lib/generateDynamicFormPdf";

/** Resolve auto-fill values from a complaint record onto a form template's field IDs. */
const fillFromComplaint = (schema: FormSchema, complaint: any, extra: Record<string, any> = {}) => {
  const data: Record<string, any> = {};
  const ctx: Record<string, any> = {
    ticket: complaint.ticket_number || complaint.complaint_code || "",
    case_number: complaint.ticket_number || complaint.complaint_code || "",
    complainant_name: complaint.placeholder_complainant_name || "",
    complainant_phone: complaint.placeholder_complainant_phone || "",
    respondent_name: complaint.placeholder_respondent_name || complaint.landlord_name || "",
    respondent_phone: complaint.placeholder_respondent_phone || "",
    property_address: complaint.property_address || "",
    region: complaint.region || "",
    rent: complaint.rent_amount ? String(complaint.rent_amount) : "",
    description: complaint.description || "",
    date: new Date().toLocaleDateString(),
    ...extra,
  };

  for (const sec of schema.sections || []) {
    for (const f of sec.fields || []) {
      const key = (f.id || "").toLowerCase();
      const label = (f.label || "").toLowerCase();
      const hit = Object.keys(ctx).find(
        (k) => key.includes(k) || label.includes(k.replace("_", " "))
      );
      if (hit) data[f.id] = ctx[hit];
    }
  }
  return data;
};

const uploadPdf = async (caseId: string, formCode: string, version: number, blob: Blob) => {
  const path = `complaints/${caseId}/${formCode}-v${version}.pdf`;
  const { error } = await supabase.storage
    .from("form-outputs")
    .upload(path, blob, { contentType: "application/pdf", upsert: true });
  if (error) throw error;
  return path;
};

interface AutoFormOptions {
  caseId: string;
  complaint: any;
  formType: "form_7" | "form_33";
  formNumber: "Form 7" | "Form 33";
  status?: "draft" | "finalized";
  extra?: Record<string, any>;
  title?: string;
}

/** Generate (or skip if exists) a statutory form for a complaint and attach it. */
export const autoGenerateComplaintForm = async ({
  caseId,
  complaint,
  formType,
  formNumber,
  status = "finalized",
  extra,
  title,
}: AutoFormOptions) => {
  // Idempotency: skip if a final version exists for this form_type
  const { data: existing } = await supabase
    .from("complaint_documents")
    .select("id, version_number, status")
    .eq("case_id", caseId)
    .eq("form_type", formType)
    .order("version_number", { ascending: false })
    .limit(1);
  const last = existing?.[0];
  if (last && last.status === "finalized" && status === "finalized") {
    return { skipped: true, id: last.id };
  }

  // Load the template
  const { data: template, error: tErr } = await supabase
    .from("form_templates")
    .select("*")
    .eq("form_number", formNumber)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (tErr || !template) {
    console.warn(`[complaintForms] template ${formNumber} not found`, tErr);
    return { skipped: true, reason: "template_missing" };
  }

  const schema = (template.schema || { sections: [] }) as FormSchema;
  const layout = (template.layout || {}) as FormLayout;
  const data = fillFromComplaint(schema, complaint, extra);

  let pdfPath: string | null = null;
  try {
    const blob = generateDynamicFormPdf({
      formName: template.form_name,
      formNumber: template.form_number,
      regulationRef: template.regulation_ref,
      schema,
      layout,
      data,
    });
    const nextVersion = (last?.version_number || 0) + 1;
    pdfPath = await uploadPdf(caseId, formType.replace("_", "-"), nextVersion, blob);
  } catch (e) {
    console.warn("[complaintForms] PDF render failed", e);
  }

  const nextVersion = (last?.version_number || 0) + 1;
  const { data: auth } = await supabase.auth.getUser();
  const { data: inserted, error: iErr } = await supabase
    .from("complaint_documents")
    .insert({
      case_id: caseId,
      case_kind: "complaint",
      form_type: formType,
      version_number: nextVersion,
      status,
      file_url: pdfPath,
      title: title || `${formNumber}: ${template.form_name}`,
      generated_by: auth.user?.id,
      finalized_by: status === "finalized" ? auth.user?.id : null,
      finalized_at: status === "finalized" ? new Date().toISOString() : null,
      change_reason: "Auto-generated from complaint data",
      metadata: { template_id: template.id, autofilled: true, data },
    } as any)
    .select("id")
    .single();

  if (iErr) {
    console.warn("[complaintForms] document insert failed", iErr);
    return { skipped: true, reason: iErr.message };
  }

  return { id: inserted.id, version: nextVersion, path: pdfPath };
};

export const autoGenerateForm7 = (caseId: string, complaint: any) =>
  autoGenerateComplaintForm({
    caseId,
    complaint,
    formType: "form_7",
    formNumber: "Form 7",
    status: "finalized",
  });

export const generateForm33Draft = (
  caseId: string,
  complaint: any,
  hearing: { scheduled_at: string; venue?: string }
) =>
  autoGenerateComplaintForm({
    caseId,
    complaint,
    formType: "form_33",
    formNumber: "Form 33",
    status: "draft",
    extra: {
      date: new Date(hearing.scheduled_at).toLocaleDateString(),
      time: new Date(hearing.scheduled_at).toLocaleTimeString(),
      venue: hearing.venue || "Rent Control Office",
    },
    title: "Form 33: Summons (Draft)",
  });

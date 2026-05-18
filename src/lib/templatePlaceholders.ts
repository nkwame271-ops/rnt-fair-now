/**
 * Replace {{placeholder}} tokens in an HTML/text body using a context object.
 * Unknown placeholders are left empty.
 */
export function applyTemplatePlaceholders(body: string, ctx: Record<string, any>): string {
  if (!body) return "";
  const safe: Record<string, string> = {
    today: new Date().toLocaleDateString("en-GB"),
    now: new Date().toLocaleString("en-GB"),
    ...Object.fromEntries(
      Object.entries(ctx).map(([k, v]) => [k, v == null ? "" : String(v)])
    ),
  };
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, key) => {
    return safe[key] ?? "";
  });
}

export function buildComplaintContext(complaint: any): Record<string, any> {
  return {
    ticket_number: complaint?.ticket_number || "",
    case_number: complaint?.case_number || "",
    title: complaint?.complaint_title || complaint?.complaint_type || "",
    description: complaint?.description || "",
    complainant_name:
      complaint?.placeholder_complainant_name ||
      complaint?.complainant_name ||
      "",
    complainant_phone:
      complaint?.placeholder_complainant_phone ||
      complaint?.complainant_phone ||
      "",
    respondent_name:
      complaint?.placeholder_respondent_name ||
      complaint?.landlord_name ||
      "",
    respondent_phone:
      complaint?.placeholder_respondent_phone || "",
    property_address: complaint?.property_address || "",
    region: complaint?.region || "",
    rent_amount: complaint?.rent_amount != null ? `GHS ${Number(complaint.rent_amount).toLocaleString()}` : "",
  };
}

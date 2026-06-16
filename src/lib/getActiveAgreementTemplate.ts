/**
 * Always-fresh agreement rendering.
 *
 * Every download from Landlord / Tenant / Student / Admin portals routes
 * through this helper so the resulting PDF reflects the LATEST active
 * configuration in `agreement_template_config` (changes propagate instantly,
 * stored snapshot URLs are only used as a fallback if regeneration fails).
 */
import { supabase } from "@/integrations/supabase/client";
import {
  generateAgreementPdf,
  type AgreementPdfData,
  type TemplateConfig,
  type CustomFieldDef,
  type SignatureData,
} from "@/lib/generateAgreementPdf";

export type AgreementVariant = "draft" | "final";

export interface RenderAgreementResult {
  blob: Blob;
  filename: string;
  variant: AgreementVariant;
}

export class FinalAgreementNotReadyError extends Error {
  constructor(message = "Final agreement requires both landlord and tenant signatures") {
    super(message);
    this.name = "FinalAgreementNotReadyError";
  }
}

export async function renderTenancyAgreement(
  tenancyId: string,
  variant: AgreementVariant,
): Promise<RenderAgreementResult> {
  // 1. Always reload the active template config — this is the whole point
  const { data: cfg } = await supabase
    .from("agreement_template_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  const templateConfig: TemplateConfig = {
    max_advance_months: (cfg as any)?.max_advance_months ?? 6,
    min_lease_duration: (cfg as any)?.min_lease_duration ?? 1,
    max_lease_duration: (cfg as any)?.max_lease_duration ?? 24,
    tax_rate: (cfg as any)?.tax_rate ?? 8,
    tax_rates: (cfg as any)?.tax_rates || undefined,
    registration_deadline_days: (cfg as any)?.registration_deadline_days ?? 30,
    terms: (cfg as any)?.terms || [],
    gra_tax_enabled: (cfg as any)?.gra_tax_enabled ?? false,
  };
  const customFields: CustomFieldDef[] = ((cfg as any)?.custom_fields || []) as CustomFieldDef[];

  // 2. Load tenancy + unit + property
  const { data: t, error: tErr } = await supabase
    .from("tenancies")
    .select(
      "*, unit:units(unit_name, unit_type, property_id, bedrooms, bathrooms), tenant:profiles!tenancies_tenant_user_id_fkey(full_name, phone), landlord:profiles!tenancies_landlord_user_id_fkey(full_name, phone)"
    )
    .eq("id", tenancyId)
    .single();
  if (tErr || !t) throw new Error("Tenancy not found");

  const { data: prop } = await supabase
    .from("properties")
    .select("property_name, region, area, street_address, ghana_post_gps, amenities")
    .eq("id", (t as any).unit?.property_id)
    .maybeSingle();

  // 3. Signatures — only allow "final" when both parties have signed
  const { data: sigs } = await supabase
    .from("tenancy_signatures")
    .select("signer_role, signer_user_id, signed_at, signature_method")
    .eq("tenancy_id", tenancyId);

  const findSig = (role: "landlord" | "tenant"): SignatureData | undefined => {
    const row = (sigs || []).find((s: any) => s.signer_role === role);
    if (!row) return undefined;
    return {
      name: role === "landlord" ? (t as any).landlord?.full_name || "Landlord" : (t as any).tenant?.full_name || "Tenant",
      signedAt: (row as any).signed_at,
      method: (row as any).signature_method || "digital",
    };
  };
  const landlordSig = findSig("landlord");
  const tenantSig = findSig("tenant");

  if (variant === "final" && !(landlordSig && tenantSig)) {
    throw new FinalAgreementNotReadyError(
      "Both landlord and tenant must sign before the Final Agreement can be issued.",
    );
  }

  // 4. Compose render payload
  const data: AgreementPdfData = {
    registrationCode: (t as any).registration_code,
    landlordName: (t as any).landlord?.full_name || "Landlord",
    tenantName: (t as any).tenant?.full_name || (t as any).placeholder_tenant_name || "Tenant",
    tenantId: (t as any).tenant_id_code || "",
    propertyName: (prop as any)?.property_name || "Property",
    propertyAddress: [(prop as any)?.street_address, (prop as any)?.area, (prop as any)?.region]
      .filter(Boolean)
      .join(", "),
    unitName: (t as any).unit?.unit_name || "",
    unitType: (t as any).unit?.unit_type || "",
    monthlyRent: Number((t as any).agreed_rent || 0),
    advanceMonths: Number((t as any).advance_months || 0),
    startDate: (t as any).start_date,
    endDate: (t as any).end_date,
    region: (prop as any)?.region || "",
    templateConfig,
    customFields,
    customFieldValues: (t as any).custom_field_values || {},
    landlordSignature: variant === "final" ? landlordSig : undefined,
    tenantSignature: variant === "final" ? tenantSig : undefined,
    serialCode: (t as any).serial_code || undefined,
    version: (t as any).version || 1,
    isExistingTenancy: (t as any).tenancy_type === "existing_migration",
    gpsAddress: (prop as any)?.street_address || undefined,
    ghanaPostGps: (prop as any)?.ghana_post_gps || undefined,
    tenantPhone: (t as any).tenant?.phone || (t as any).placeholder_tenant_phone || undefined,
    landlordPhone: (t as any).landlord?.phone || undefined,
    bedroomCount: (t as any).unit?.bedrooms || undefined,
    bathroomCount: (t as any).unit?.bathrooms || undefined,
    amenities: (prop as any)?.amenities || undefined,
  };

  const doc = await generateAgreementPdf(data);
  const blob = doc.output("blob") as Blob;
  const filename = `${variant === "final" ? "Final" : "Draft"}-Agreement-${data.registrationCode || tenancyId.slice(0, 8)}.pdf`;
  return { blob, filename, variant };
}

/** Trigger a browser download of the rendered agreement. */
export async function downloadTenancyAgreement(tenancyId: string, variant: AgreementVariant) {
  const { blob, filename } = await renderTenancyAgreement(tenancyId, variant);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

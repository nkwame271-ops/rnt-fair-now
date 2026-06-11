import ReferencePage from "./ReferencePage";

export default function RefTenants() {
  return (
    <ReferencePage
      scope="tenants:read"
      title="Reference — Tenants"
      description="Tenant directory, tenancy lifecycle, rent card delivery."
      endpoints={[
        { name: "tenants/list", summary: "Paginated tenant directory.", example: { page: 1, limit: 50 } },
        { name: "tenants/detail", summary: "Single tenant by code, with current tenancy and property link.", example: { tenant_id: "TN-2025-000456" } },
        { name: "tenants/registered", summary: "Counts of registered tenants by region and period." },
        { name: "tenants/without-landlord", summary: "Tenants not yet linked to a verified landlord." },
        { name: "tenants/expired-registration", summary: "Tenants whose registration has expired." },
        { name: "tenants/rent-card-delivery", summary: "Rent card delivery status." },
        { name: "tenants/non-citizens", summary: "Non-citizen tenant statistics for immigration reporting." },
      ]}
      prev={{ to: "/developers/docs/reference/landlords", label: "Landlords" }}
      next={{ to: "/developers/docs/reference/properties", label: "Properties" }}
    />
  );
}

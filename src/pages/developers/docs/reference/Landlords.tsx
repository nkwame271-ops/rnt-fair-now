import ReferencePage from "./ReferencePage";

export default function RefLandlords() {
  return (
    <ReferencePage
      scope="landlords:read"
      title="Reference — Landlords"
      description="Landlord directory, registration status, and tax footprint."
      endpoints={[
        { name: "landlords/list", summary: "Paginated landlord directory. Filter by phone, region, kyc status.", example: { page: 1, limit: 50, region: "Greater Accra" } },
        { name: "landlords/detail", summary: "Single landlord by code, with linked properties and compliance score.", example: { landlord_id: "LL-2025-000123" } },
        { name: "landlords/registered", summary: "Aggregate counts of registered landlords by region and period." },
        { name: "landlords/unregistered-fee", summary: "Landlords with outstanding registration fees." },
        { name: "landlords/property-count", summary: "Property count per landlord (top N)." },
      ]}
      prev={{ to: "/developers/docs/tutorials/retries", label: "Retries" }}
      next={{ to: "/developers/docs/reference/tenants", label: "Tenants" }}
    />
  );
}

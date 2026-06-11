import ReferencePage from "./ReferencePage";

export default function RefProperties() {
  return (
    <ReferencePage
      scope="properties:read"
      title="Reference — Properties"
      description="Property inventory, regional breakdown, vacancy and condition signals."
      endpoints={[
        { name: "properties/list", summary: "Paginated property directory.", example: { region: "Greater Accra", page: 1, limit: 50 } },
        { name: "properties/detail", summary: "Single property by code with units and active tenancy.", example: { property_code: "PR-AC-000789" } },
        { name: "properties/by-region", summary: "Counts grouped by region." },
        { name: "properties/vacant-units", summary: "Currently vacant units, optionally filtered by region." },
        { name: "properties/conditions", summary: "Property condition distribution." },
      ]}
      prev={{ to: "/developers/docs/reference/tenants", label: "Tenants" }}
      next={{ to: "/developers/docs/reference/complaints", label: "Complaints" }}
    />
  );
}

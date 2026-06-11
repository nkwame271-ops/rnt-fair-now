import ReferencePage from "./ReferencePage";

export default function RefComplaints() {
  return (
    <ReferencePage
      scope="complaints:read"
      title="Reference — Complaints"
      description="Complaint case volumes and resolution metrics."
      endpoints={[
        { name: "complaints/list", summary: "Paginated complaint cases.", example: { region: "Ashanti", status: "open" } },
        { name: "complaints/detail", summary: "Single complaint case.", example: { complaint_code: "TKT-20251001-00012" } },
        { name: "complaints/summary", summary: "Complaint volume and resolution metrics by period." },
      ]}
      prev={{ to: "/developers/docs/reference/properties", label: "Properties" }}
      next={{ to: "/developers/docs/reference/webhooks", label: "Webhook events" }}
    />
  );
}

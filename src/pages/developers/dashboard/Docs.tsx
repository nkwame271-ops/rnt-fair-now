import ApiDocsContent from "@/components/agency-api/ApiDocsContent";

export default function DeveloperDocsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">API Documentation</h1>
        <p className="text-sm text-muted-foreground">Full reference for the Agency API.</p>
      </div>
      <ApiDocsContent />
    </div>
  );
}

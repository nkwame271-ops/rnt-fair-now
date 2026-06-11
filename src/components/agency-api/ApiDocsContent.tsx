import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/agency-api`;

const ENDPOINT_CATALOGUE: { category: string; items: { name: string; scope: string; example?: object }[] }[] = [
  {
    category: "Landlords",
    items: [
      { name: "landlords/list", scope: "landlords:read", example: { page: 1, limit: 50 } },
      { name: "landlords/detail", scope: "landlords:read", example: { landlord_id: "LL-2025-000123" } },
      { name: "landlords/registered", scope: "landlords:read" },
      { name: "landlords/property-count", scope: "landlords:read" },
    ],
  },
  {
    category: "Tenants",
    items: [
      { name: "tenants/list", scope: "tenants:read", example: { page: 1, limit: 50 } },
      { name: "tenants/detail", scope: "tenants:read", example: { tenant_id: "TN-2025-000456" } },
      { name: "tenants/registered", scope: "tenants:read" },
      { name: "tenants/expired-registration", scope: "tenants:read" },
    ],
  },
  {
    category: "Properties",
    items: [
      { name: "properties/list", scope: "properties:read", example: { region: "Greater Accra" } },
      { name: "properties/detail", scope: "properties:read", example: { property_code: "PR-AC-000789" } },
      { name: "properties/by-region", scope: "properties:read" },
      { name: "properties/vacant-units", scope: "properties:read" },
    ],
  },
  {
    category: "Complaints",
    items: [
      { name: "complaints/list", scope: "complaints:read", example: { region: "Ashanti", status: "open" } },
      { name: "complaints/detail", scope: "complaints:read", example: { complaint_code: "TKT-20251001-00012" } },
      { name: "complaints/summary", scope: "complaints:read" },
    ],
  },
];

export default function ApiDocsContent() {
  const { data: scopes = [] } = useQuery({
    queryKey: ["public-api-scopes"],
    queryFn: async () => {
      const { data } = await supabase.from("api_scopes" as any).select("*").eq("is_active", true).order("category");
      return (data as any[]) || [];
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            The Rent Control Ghana Agency API is a read-only HTTP API for partner
            government agencies. All requests are <code>POST</code>, authenticated
            with an <code>X-API-Key</code> header, and respond with JSON.
          </p>
          <div className="bg-muted rounded p-3 font-mono text-xs break-all">
            POST {BASE_URL}
          </div>
          <div>
            <p className="font-semibold mb-1">Headers</p>
            <pre className="bg-muted rounded p-3 font-mono text-xs overflow-x-auto">
{`X-API-Key: rcg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Content-Type: application/json`}
            </pre>
          </div>
          <div>
            <p className="font-semibold mb-1">Request body</p>
            <pre className="bg-muted rounded p-3 font-mono text-xs overflow-x-auto">
{`{
  "endpoint": "landlords/list",
  "filters": { "page": 1, "limit": 50 }
}`}
            </pre>
          </div>
          <p className="text-muted-foreground text-xs">
            Default rate limit is 60 requests / minute / key. PII fields
            (phone, email, Ghana Card) are masked unless your key holds the
            <code className="mx-1">identity:read</code> scope and a signed
            data-sharing agreement is on file.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available scopes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-2">
            {scopes.map((s: any) => (
              <div key={s.scope_key} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <Badge variant="outline" className="text-[10px] capitalize">{s.category}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <code className="text-[10px] block mt-1">{s.scope_key}</code>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoint reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ENDPOINT_CATALOGUE.map((group) => (
            <div key={group.category}>
              <h3 className="text-sm font-semibold mb-2">{group.category}</h3>
              <div className="space-y-2">
                {group.items.map((ep) => (
                  <div key={ep.name} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <code className="text-xs font-mono">{ep.name}</code>
                      <Badge variant="secondary" className="text-[10px]">{ep.scope}</Badge>
                    </div>
                    {ep.example && (
                      <pre className="mt-2 bg-muted rounded p-2 font-mono text-[11px] overflow-x-auto">
{`curl -X POST ${BASE_URL} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ endpoint: ep.name, filters: ep.example })}'`}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Errors</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><Badge variant="outline">401</Badge> Missing or invalid <code>X-API-Key</code> header.</p>
          <p><Badge variant="outline">403</Badge> Key revoked, expired, IP-blocked, or scope not authorised.</p>
          <p><Badge variant="outline">429</Badge> Rate limit exceeded.</p>
          <p><Badge variant="outline">500</Badge> Server error — please retry.</p>
        </CardContent>
      </Card>
    </div>
  );
}

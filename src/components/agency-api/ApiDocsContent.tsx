import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Info, ShieldCheck, Webhook, KeyRound, Activity, BookOpen, Code2, AlertTriangle } from "lucide-react";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/agency-api`;
const OPENAPI_URL = `${BASE_URL}/v1/openapi.json`;

// Mirror of SCOPE_MAP in supabase/functions/agency-api/index.ts
const SCOPE_MAP: Record<string, { endpoints: { name: string; summary: string; example?: object }[] }> = {
  "landlords:read": {
    endpoints: [
      { name: "landlords/list", summary: "Paginated landlord directory", example: { page: 1, limit: 50, region: "Greater Accra" } },
      { name: "landlords/detail", summary: "Single landlord by code", example: { landlord_id: "LL-2025-000123" } },
      { name: "landlords/registered", summary: "Aggregate counts of registered landlords" },
      { name: "landlords/unregistered-fee", summary: "Landlords with outstanding registration fees" },
      { name: "landlords/property-count", summary: "Property count per landlord" },
    ],
  },
  "tenants:read": {
    endpoints: [
      { name: "tenants/list", summary: "Paginated tenant directory", example: { page: 1, limit: 50 } },
      { name: "tenants/detail", summary: "Single tenant by code", example: { tenant_id: "TN-2025-000456" } },
      { name: "tenants/registered", summary: "Counts of registered tenants" },
      { name: "tenants/without-landlord", summary: "Tenants not yet linked to a landlord" },
      { name: "tenants/expired-registration", summary: "Tenants with expired registrations" },
      { name: "tenants/rent-card-delivery", summary: "Rent card delivery status" },
      { name: "tenants/non-citizens", summary: "Non-citizen tenant statistics" },
    ],
  },
  "properties:read": {
    endpoints: [
      { name: "properties/list", summary: "Paginated property directory", example: { region: "Greater Accra", page: 1 } },
      { name: "properties/detail", summary: "Single property by code", example: { property_code: "PR-AC-000789" } },
      { name: "properties/by-region", summary: "Counts grouped by region" },
      { name: "properties/vacant-units", summary: "Currently vacant units" },
      { name: "properties/conditions", summary: "Property condition distribution" },
    ],
  },
  "complaints:read": {
    endpoints: [
      { name: "complaints/list", summary: "Complaint cases", example: { region: "Ashanti", status: "open" } },
      { name: "complaints/detail", summary: "Single complaint", example: { complaint_code: "TKT-20251001-00012" } },
      { name: "complaints/summary", summary: "Complaint volume and resolution metrics" },
    ],
  },
  "tax:read": {
    endpoints: [
      { name: "tax/landlord-income", summary: "Aggregate landlord rent income" },
      { name: "tax/rent-tax-collected", summary: "Rent tax collected by period" },
      { name: "tax/landlord-list", summary: "Landlord-level tax footprint" },
    ],
  },
  "stats:read": {
    endpoints: [
      { name: "stats/overview", summary: "Platform-wide KPIs" },
      { name: "stats/regional-breakdown", summary: "KPIs by region" },
      { name: "stats/citizen-breakdown", summary: "Citizenship breakdown" },
    ],
  },
  "identity:read": {
    endpoints: [
      { name: "identity/kyc-stats", summary: "KYC completion statistics" },
      { name: "identity/ghana-card-usage", summary: "Ghana Card usage metrics" },
    ],
  },
};

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-muted rounded-md p-3 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre">
      {children}
    </pre>
  );
}

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
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Read-only, government-grade API</AlertTitle>
        <AlertDescription>
          Access is granted by the Rent Control regulator after accreditation and a signed
          Data Sharing Agreement (DSA). All requests are over HTTPS and audit-logged.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="quickstart">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="quickstart"><BookOpen className="h-3.5 w-3.5 mr-1.5" />Quickstart</TabsTrigger>
          <TabsTrigger value="auth"><KeyRound className="h-3.5 w-3.5 mr-1.5" />Auth & Keys</TabsTrigger>
          <TabsTrigger value="endpoints"><Code2 className="h-3.5 w-3.5 mr-1.5" />Endpoints</TabsTrigger>
          <TabsTrigger value="conventions"><ShieldCheck className="h-3.5 w-3.5 mr-1.5" />Conventions</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-3.5 w-3.5 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="errors"><AlertTriangle className="h-3.5 w-3.5 mr-1.5" />Errors</TabsTrigger>
          <TabsTrigger value="changelog"><Activity className="h-3.5 w-3.5 mr-1.5" />Changelog</TabsTrigger>
        </TabsList>

        {/* ─────────────── QUICKSTART ─────────────── */}
        <TabsContent value="quickstart" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>1. Base URL & versioning</CardTitle>
              <CardDescription>
                The current stable version is <code>v1</code>. We never make breaking changes within
                a major version. Breaking changes ship under a new prefix (<code>/v2</code>) with at
                least 6 months of overlap.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <CodeBlock>{`Production : ${BASE_URL}
Sandbox    : ${BASE_URL}   (key prefix rcg_test_…)
OpenAPI    : ${OPENAPI_URL}
Health     : ${BASE_URL}/v1/health`}</CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. Your first call</CardTitle>
              <CardDescription>
                Data endpoints are <code>POST</code> to the root with a JSON body. Utility endpoints
                (<code>/v1/health</code>, <code>/v1/me</code>, <code>/v1/openapi.json</code>) are <code>GET</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs defaultValue="curl">
                <TabsList>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                  <TabsTrigger value="node">Node.js</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                </TabsList>
                <TabsContent value="curl">
                  <CodeBlock>{`curl -X POST ${BASE_URL} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "endpoint": "landlords/list",
    "filters": { "page": 1, "limit": 50, "region": "Greater Accra" }
  }'`}</CodeBlock>
                </TabsContent>
                <TabsContent value="node">
                  <CodeBlock>{`import { randomUUID } from "node:crypto";

const res = await fetch("${BASE_URL}", {
  method: "POST",
  headers: {
    "X-API-Key": process.env.RCG_API_KEY!,
    "Content-Type": "application/json",
    "Idempotency-Key": randomUUID(),
  },
  body: JSON.stringify({
    endpoint: "landlords/list",
    filters: { page: 1, limit: 50 },
  }),
});

console.log(res.headers.get("x-request-id"));
const json = await res.json();`}</CodeBlock>
                </TabsContent>
                <TabsContent value="python">
                  <CodeBlock>{`import os, uuid, requests

r = requests.post(
    "${BASE_URL}",
    headers={
        "X-API-Key": os.environ["RCG_API_KEY"],
        "Content-Type": "application/json",
        "Idempotency-Key": str(uuid.uuid4()),
    },
    json={"endpoint": "landlords/list", "filters": {"page": 1, "limit": 50}},
    timeout=30,
)
r.raise_for_status()
print(r.json())`}</CodeBlock>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>3. Response envelope</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock>{`{
  "success": true,
  "endpoint": "landlords/list",
  "agency": "Ghana Revenue Authority",
  "data": [ /* rows */ ],
  "meta": {
    "page": 1,
    "page_size": 50,
    "request_id": "f0e1d2c3-…"
  }
}`}</CodeBlock>
              <p className="text-xs text-muted-foreground mt-2">
                Every response includes <code>X-Request-Id</code>, <code>X-API-Version</code>,
                and <code>X-RateLimit-*</code> headers. Always log <code>X-Request-Id</code> —
                support requests are resolved against it.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── AUTH ─────────────── */}
        <TabsContent value="auth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>API keys</CardTitle>
              <CardDescription>Keys are issued by the regulator. Treat them as production secrets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-semibold mb-1">Format</p>
                <CodeBlock>{`rcg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (production)
rcg_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx   (sandbox)`}</CodeBlock>
              </div>
              <div>
                <p className="font-semibold mb-1">Sending the key</p>
                <CodeBlock>{`X-API-Key: rcg_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}</CodeBlock>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Keys are shown <strong>once</strong> at issuance. Only a SHA-256 hash is stored server-side.</li>
                <li>Store keys in a secret manager. Never ship them to a browser or commit to git.</li>
                <li>Each key is scoped to one environment (<code>live</code> or <code>sandbox</code>) and one agency.</li>
                <li>An optional IP allowlist restricts which source IPs can use the key.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Key rotation</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                Rotating a key issues a new secret and keeps the previous hash valid for a
                <strong> 24 hour grace period</strong> so you can roll deployments without downtime.
              </p>
              <p className="text-muted-foreground">
                After 24 hours the old key is permanently rejected. Calls served under grace are
                tagged <code>rotation_grace</code> in the audit log.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Introspect your key</CardTitle>
              <CardDescription>Confirm scopes, plan, environment and remaining quota.</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock>{`GET ${BASE_URL}/v1/me
X-API-Key: $RCG_API_KEY

→ {
  "agency": "Ghana Revenue Authority",
  "environment": "live",
  "scopes": ["landlords:read", "tenants:read"],
  "rate_limit_per_minute": 120,
  "expires_at": "2027-01-01T00:00:00Z",
  "plan": { "name": "Growth", "slug": "growth", "included_calls": 500000 },
  "usage": { "calls_count": 14322, "overage_calls": 0,
             "period_start": "…", "period_end": "…" }
}`}</CodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── ENDPOINTS ─────────────── */}
        <TabsContent value="endpoints" className="space-y-4">
          {scopes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Scopes</CardTitle>
                <CardDescription>Your key only grants access to endpoints whose scope is enabled.</CardDescription>
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
          )}

          <Card>
            <CardHeader>
              <CardTitle>Endpoint catalogue</CardTitle>
              <CardDescription>
                All endpoints use the same envelope: <code>{`POST ${BASE_URL}`}</code> with
                <code className="ml-1">{`{ "endpoint": "...", "filters": { … } }`}</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {Object.entries(SCOPE_MAP).map(([scope, group]) => (
                  <AccordionItem key={scope} value={scope}>
                    <AccordionTrigger>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">{scope}</Badge>
                        <span className="text-sm font-medium">{group.endpoints.length} endpoints</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2">
                        {group.endpoints.map((ep) => (
                          <div key={ep.name} className="border rounded-lg p-3">
                            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                              <code className="text-xs font-mono">{ep.name}</code>
                              <Badge variant="outline" className="text-[10px]">requires {scope}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{ep.summary}</p>
                            <pre className="mt-2 bg-muted rounded p-2 font-mono text-[11px] overflow-x-auto">
{`curl -X POST ${BASE_URL} \\
  -H "X-API-Key: $RCG_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({ endpoint: ep.name, filters: ep.example ?? {} })}'`}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Utility endpoints</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><Badge variant="outline" className="mr-2">GET</Badge><code>/v1/health</code> — liveness probe, no auth.</p>
              <p><Badge variant="outline" className="mr-2">GET</Badge><code>/v1/me</code> — introspect the calling key.</p>
              <p>
                <Badge variant="outline" className="mr-2">GET</Badge>
                <code>/v1/openapi.json</code> — OpenAPI 3.1 spec. Import into Postman, Insomnia,
                or generate clients with <code>openapi-generator</code>.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── CONVENTIONS ─────────────── */}
        <TabsContent value="conventions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pagination, filtering & sorting</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Pass <code>page</code> (1-based) and <code>limit</code> (max <strong>500</strong>) in <code>filters</code>.</p>
              <CodeBlock>{`{ "endpoint": "tenants/list",
  "filters": { "page": 2, "limit": 100, "region": "Ashanti", "sort": "-created_at" } }`}</CodeBlock>
              <p className="text-muted-foreground text-xs">
                Sort uses a leading <code>-</code> for descending (e.g. <code>-created_at</code>).
                Allowed filter keys vary per endpoint and are advertised in the OpenAPI spec.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rate limits</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>Limits are per-key, per-minute. The default is 60/min; paid plans raise this.</p>
              <CodeBlock>{`X-RateLimit-Limit:     120
X-RateLimit-Remaining: 87
X-RateLimit-Reset:     60       # seconds until window resets
Retry-After:           60       # only on 429 responses`}</CodeBlock>
              <p className="text-muted-foreground text-xs">
                On a <code>429</code>, back off using <code>Retry-After</code>. We recommend
                exponential jitter for retry loops.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Idempotency</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                Send a unique <code>Idempotency-Key</code> header (UUID v4 recommended) to safely
                retry. Identical requests within 24 hours return the original response.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>PII masking</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                By default, phone numbers, emails and Ghana Card numbers are masked
                (e.g. <code>233****123</code>, <code>j***@gmail.com</code>).
              </p>
              <p className="text-muted-foreground">
                Unmasked PII is only returned when your key holds the <code>identity:read</code>
                scope <em>and</em> a signed Data Sharing Agreement is on file
                (<code>dsa_signed_at</code> populated by the regulator).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Environments</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Sandbox</strong> (<code>rcg_test_…</code>) — synthetic data, free, no rate-limit billing.</li>
                <li><strong>Live</strong> (<code>rcg_live_…</code>) — production data, metered against your plan.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── WEBHOOKS ─────────────── */}
        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook events</CardTitle>
              <CardDescription>
                Register an HTTPS endpoint in the agency console to receive push events instead of polling.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold mb-1">Event types</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li><code>landlord.registered</code>, <code>landlord.updated</code></li>
                  <li><code>tenant.registered</code>, <code>tenant.tenancy_started</code>, <code>tenant.tenancy_ended</code></li>
                  <li><code>property.created</code>, <code>property.vacancy_changed</code></li>
                  <li><code>complaint.opened</code>, <code>complaint.status_changed</code>, <code>complaint.closed</code></li>
                </ul>
              </div>
              <div>
                <p className="font-semibold mb-1">Delivery</p>
                <CodeBlock>{`POST https://your-endpoint.example.gov.gh/webhooks/rcg
Content-Type:               application/json
X-RentControl-Event:        complaint.opened
X-RentControl-Delivery-Id:  c2f8a1f0-…
X-RentControl-Timestamp:    1736012345
X-RentControl-Signature:    sha256=<hex>

{ "id": "evt_…", "type": "complaint.opened", "created_at": "…", "data": { … } }`}</CodeBlock>
              </div>
              <div>
                <p className="font-semibold mb-1">Retries</p>
                <p className="text-muted-foreground">
                  Non-<code>2xx</code> responses are retried with exponential backoff
                  (1m → 5m → 30m → 2h → 6h → 24h). After 10 consecutive failures the endpoint is
                  auto-disabled and the regulator is notified.
                </p>
              </div>
              <div>
                <p className="font-semibold mb-1">Verifying signatures (Node.js)</p>
                <CodeBlock>{`import crypto from "node:crypto";

function verify(req, secret) {
  const ts  = req.headers["x-rentcontrol-timestamp"];
  const sig = (req.headers["x-rentcontrol-signature"] || "").replace("sha256=", "");
  const payload = ts + "." + req.rawBody;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  // Reject if older than 5 minutes
  if (Math.abs(Date.now()/1000 - Number(ts)) > 300) return false;
  return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
}`}</CodeBlock>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── ERRORS ─────────────── */}
        <TabsContent value="errors" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Error format (RFC 7807)</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <CodeBlock>{`HTTP/1.1 403 Forbidden
Content-Type: application/json
X-Request-Id: f0e1d2c3-…

{
  "type":   "about:blank",
  "title":  "Endpoint not authorised",
  "status": 403,
  "detail": "Endpoint 'tenants/detail' not allowed. Granted scopes: landlords:read.",
  "request_id": "f0e1d2c3-…"
}`}</CodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Status codes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><Badge variant="outline">200</Badge> OK</p>
              <p><Badge variant="outline">400</Badge> Bad request — missing or malformed body.</p>
              <p><Badge variant="outline">401</Badge> Missing or invalid <code>X-API-Key</code>.</p>
              <p><Badge variant="outline">402</Badge> Billing enabled but no active plan on the key.</p>
              <p><Badge variant="outline">403</Badge> Key revoked, expired, IP-blocked, or scope/environment not authorised.</p>
              <p><Badge variant="outline">405</Badge> Wrong HTTP method (data endpoints require <code>POST</code>).</p>
              <p><Badge variant="outline">429</Badge> Rate limit or monthly quota exceeded — back off using <code>Retry-After</code>.</p>
              <p><Badge variant="outline">5xx</Badge> Server error — retry with backoff, then contact support with the <code>X-Request-Id</code>.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────────── CHANGELOG ─────────────── */}
        <TabsContent value="changelog" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Changelog</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold">v1 — current</p>
                <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                  <li>Stable read-only endpoints for landlords, tenants, properties, complaints, tax, stats, identity.</li>
                  <li>OpenAPI 3.1 spec at <code>/v1/openapi.json</code>.</li>
                  <li>Webhooks with HMAC-SHA256 signing and exponential backoff retries.</li>
                  <li>Idempotency keys, RFC 7807 errors, <code>X-Request-Id</code> tracing.</li>
                  <li>Per-key plans, sandbox + live environments, 24-hour rotation grace.</li>
                </ul>
              </div>
              <p className="text-muted-foreground text-xs">
                Need access? <a href="/contact" className="text-primary hover:underline">Request agency credentials</a>
                {" "}or open <code>/v1/openapi.json</code> in Swagger UI to explore the full schema.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

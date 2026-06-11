import { useState } from "react";
import { useDeveloperOrg, useDeveloperKeys } from "@/hooks/useDeveloperOrg";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const BASE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/agency-api`;

const ENDPOINTS = [
  "landlords/list", "landlords/detail", "landlords/registered", "landlords/property-count",
  "tenants/list", "tenants/detail", "tenants/registered",
  "properties/list", "properties/detail", "properties/by-region", "properties/vacant-units",
  "complaints/list", "complaints/detail", "complaints/summary",
  "stats/overview", "stats/regional-breakdown",
];

export default function DeveloperSandbox() {
  const { data: org } = useDeveloperOrg();
  const { data: keys = [] } = useDeveloperKeys(org?.id);
  const usableKeys = keys.filter((k) => k.is_active);

  const [keyId, setKeyId] = useState<string>("");
  const [endpoint, setEndpoint] = useState("landlords/list");
  const [filters, setFilters] = useState('{ "page": 1, "limit": 10 }');
  const [usePlaintext, setUsePlaintext] = useState("");
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<{ status: number; headers: Record<string, string>; body: string } | null>(null);

  const selectedKey = keys.find((k) => k.id === keyId);

  const send = async () => {
    const apiKey = usePlaintext.trim();
    if (!apiKey) {
      setResp({ status: 0, headers: {}, body: "Paste a plaintext key (you saved it when it was issued)." });
      return;
    }
    let filtersObj: any = {};
    try { filtersObj = JSON.parse(filters || "{}"); } catch {
      setResp({ status: 0, headers: {}, body: "Invalid JSON in filters." }); return;
    }
    setBusy(true);
    try {
      const res = await fetch(BASE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ endpoint, filters: filtersObj }),
      });
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      const body = await res.text();
      let pretty = body;
      try { pretty = JSON.stringify(JSON.parse(body), null, 2); } catch { /* ignore */ }
      setResp({ status: res.status, headers, body: pretty });
    } catch (e: any) {
      setResp({ status: 0, headers: {}, body: e.message ?? "Request failed" });
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Sandbox console</h1>
        <p className="text-sm text-muted-foreground">Make real calls against the API from your browser.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request</CardTitle>
          <CardDescription>POST {BASE_URL}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Key</Label>
              <Select value={keyId} onValueChange={setKeyId}>
                <SelectTrigger><SelectValue placeholder="Select a key" /></SelectTrigger>
                <SelectContent>
                  {usableKeys.map((k) => (
                    <SelectItem key={k.id} value={k.id}>
                      {k.key_prefix}… ({k.environment})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedKey && (
                <p className="text-xs text-muted-foreground mt-1">
                  Scopes: {(selectedKey.scopes ?? []).join(", ")}
                </p>
              )}
            </div>
            <div>
              <Label>Endpoint</Label>
              <Select value={endpoint} onValueChange={setEndpoint}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ENDPOINTS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>X-API-Key (paste the plaintext key)</Label>
            <input
              type="password"
              className="w-full border rounded-md px-3 py-2 text-sm font-mono bg-background"
              placeholder="rcg_test_…"
              value={usePlaintext}
              onChange={(e) => setUsePlaintext(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              We only store key hashes server-side, so paste the plaintext you saved when issuing the key.
            </p>
          </div>
          <div>
            <Label>Filters (JSON)</Label>
            <Textarea rows={4} className="font-mono text-xs" value={filters} onChange={(e) => setFilters(e.target.value)} />
          </div>
          <Button onClick={send} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </CardContent>
      </Card>

      {resp && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Response <Badge variant={resp.status >= 200 && resp.status < 300 ? "default" : "destructive"}>{resp.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <details className="border rounded-md p-2">
              <summary className="cursor-pointer text-sm font-medium">Headers ({Object.keys(resp.headers).length})</summary>
              <pre className="text-[11px] font-mono mt-2 overflow-x-auto">{Object.entries(resp.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}</pre>
            </details>
            <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-[500px]">{resp.body}</pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Key, Plus, Copy, Shield, Trash2, RotateCcw, Activity, BarChart3,
  FileText, Pause, Play, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { format, formatDistanceToNow, subDays } from "date-fns";
import ApiDocsContent from "@/components/agency-api/ApiDocsContent";
import { PlansTab, BillingTab, WebhooksTab } from "@/pages/regulator/agency-api/BillingTabs";
import DeveloperAccessControl from "@/pages/regulator/agency-api/DeveloperAccessControl";
import { DollarSign, CreditCard, Webhook, Settings2 } from "lucide-react";

// ───────────────────────── Keys tab ─────────────────────────

function KeysTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    agency_name: "",
    environment: "production" as "production" | "sandbox",
    rate_limit_per_minute: 60,
    agency_contact_email: "",
    agency_contact_phone: "",
    expires_at: "",
    selectedScopes: [] as string[],
  });

  // Deep-link prefill from ApiAccessRequests "Issue live key now" shortcut.
  useEffect(() => {
    const issueForOrg = searchParams.get("issueForOrg");
    if (!issueForOrg) return;
    const agency = searchParams.get("agency") || "";
    const scopes = (searchParams.get("scopes") || "").split(",").filter(Boolean);
    const email = searchParams.get("email") || "";
    const phone = searchParams.get("phone") || "";
    setForm((f) => ({
      ...f,
      agency_name: agency,
      environment: "production",
      selectedScopes: scopes,
      agency_contact_email: email,
      agency_contact_phone: phone,
    }));
    setCreateOpen(true);
    // Clean query params so reload doesn't re-trigger.
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["agency-api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: scopes = [] } = useQuery({
    queryKey: ["api-scopes"],
    queryFn: async () => {
      const { data } = await supabase.from("api_scopes" as any).select("*").eq("is_active", true).order("category");
      return (data as any[]) || [];
    },
  });

  const callAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("agency-api-admin", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const issueMut = useMutation({
    mutationFn: async () => {
      return await callAdmin("issue", {
        agency_name: form.agency_name.trim(),
        scopes: form.selectedScopes,
        environment: form.environment,
        rate_limit_per_minute: form.rate_limit_per_minute,
        agency_contact_email: form.agency_contact_email || null,
        agency_contact_phone: form.agency_contact_phone || null,
        expires_at: form.expires_at || null,
      });
    },
    onSuccess: (data: any) => {
      setGeneratedKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ["agency-api-keys"] });
      toast.success("API key issued");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: async (key_id: string) => callAdmin("revoke", { key_id, reason: "Revoked via console" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-api-keys"] });
      toast.success("Key revoked");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rotateMut = useMutation({
    mutationFn: async (key_id: string) => callAdmin("rotate", { key_id }),
    onSuccess: (data: any) => {
      setGeneratedKey(data.api_key);
      queryClient.invalidateQueries({ queryKey: ["agency-api-keys"] });
      toast.success("Key rotated — copy the new value now");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () =>
    setForm({
      agency_name: "", environment: "production", rate_limit_per_minute: 60,
      agency_contact_email: "", agency_contact_phone: "", expires_at: "", selectedScopes: [],
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{keys.length} key{keys.length !== 1 ? "s" : ""} issued</p>
        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            setCreateOpen(o);
            if (!o) { resetForm(); setGeneratedKey(null); }
          }}
        >
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Issue Key</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{generatedKey ? "API Key Issued" : "Issue New API Key"}</DialogTitle>
            </DialogHeader>

            {generatedKey ? (
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                  <p className="text-sm font-semibold text-destructive mb-2 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" /> Copy this key now — it will not be shown again.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted p-2 rounded text-xs break-all font-mono">{generatedKey}</code>
                    <Button size="sm" variant="outline" onClick={() => {
                      navigator.clipboard.writeText(generatedKey);
                      toast.success("Copied");
                    }}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => {
                  setCreateOpen(false); resetForm(); setGeneratedKey(null);
                }}>Done</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>Agency name</Label>
                  <Input value={form.agency_name}
                    onChange={(e) => setForm((f) => ({ ...f, agency_name: e.target.value }))}
                    placeholder="e.g. Ghana Revenue Authority" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Environment</Label>
                    <Select value={form.environment} onValueChange={(v) => setForm((f) => ({ ...f, environment: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="production">Production</SelectItem>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Rate limit /min</Label>
                    <Input type="number" min={1} max={6000} value={form.rate_limit_per_minute}
                      onChange={(e) => setForm((f) => ({ ...f, rate_limit_per_minute: Number(e.target.value) || 60 }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Contact email</Label>
                    <Input type="email" value={form.agency_contact_email}
                      onChange={(e) => setForm((f) => ({ ...f, agency_contact_email: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Contact phone</Label>
                    <Input value={form.agency_contact_phone}
                      onChange={(e) => setForm((f) => ({ ...f, agency_contact_phone: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Expires (optional)</Label>
                  <Input type="date" value={form.expires_at}
                    onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
                </div>
                <div>
                  <Label className="mb-1 block">Scopes</Label>
                  <div className="space-y-1 max-h-56 overflow-y-auto border rounded p-2">
                    {scopes.map((s: any) => (
                      <label key={s.scope_key} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer">
                        <Checkbox
                          checked={form.selectedScopes.includes(s.scope_key)}
                          onCheckedChange={(c) =>
                            setForm((f) => ({
                              ...f,
                              selectedScopes: c
                                ? [...f.selectedScopes, s.scope_key]
                                : f.selectedScopes.filter((x) => x !== s.scope_key),
                            }))
                          } />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <Button className="w-full" disabled={issueMut.isPending || !form.agency_name || form.selectedScopes.length === 0}
                  onClick={() => issueMut.mutate()}>
                  {issueMut.isPending ? "Issuing…" : "Issue Key"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground text-sm py-8 text-center">Loading…</p>
          ) : keys.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No API keys issued yet</p>
            </div>
          ) : (
            <div className="responsive-table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agency</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Env</TableHead>
                    <TableHead>Scopes</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last used</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k: any) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.agency_name}</TableCell>
                      <TableCell className="font-mono text-xs">{k.key_prefix ?? "—"}…</TableCell>
                      <TableCell>
                        <Badge variant={k.environment === "production" ? "default" : "outline"} className="text-[10px]">
                          {k.environment ?? "production"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(k.scopes || []).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{k.rate_limit_per_minute ?? 60}/min</TableCell>
                      <TableCell>
                        {k.revoked_at ? (
                          <Badge variant="destructive">Revoked</Badge>
                        ) : k.expires_at && new Date(k.expires_at) < new Date() ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : k.is_active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {k.last_used_at ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true }) : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" title="Rotate"
                            onClick={() => {
                              if (confirm("Rotate this key? The old key will stop working immediately.")) {
                                rotateMut.mutate(k.id);
                              }
                            }}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" title="Revoke"
                            className="text-destructive hover:text-destructive"
                            disabled={!!k.revoked_at}
                            onClick={() => {
                              if (confirm(`Revoke key for ${k.agency_name}?`)) revokeMut.mutate(k.id);
                            }}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────── Live activity tab ─────────────────────────

type CallRow = {
  id: string;
  agency_name: string | null;
  endpoint: string;
  scope_used: string | null;
  status_code: number;
  response_ms: number | null;
  ip: string | null;
  error_message: string | null;
  created_at: string;
};

function LiveActivityTab() {
  const [paused, setPaused] = useState(false);
  const [events, setEvents] = useState<CallRow[]>([]);
  const [filterAgency, setFilterAgency] = useState("");

  const { data: initial = [] } = useQuery({
    queryKey: ["api-request-log-initial"],
    queryFn: async () => {
      const { data } = await supabase.from("api_request_log" as any)
        .select("*").order("created_at", { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  useEffect(() => {
    if (initial.length) setEvents(initial as CallRow[]);
  }, [initial]);

  useEffect(() => {
    if (paused) return;
    const channel = supabase
      .channel("api_request_log_stream")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "api_request_log" },
        (payload) => {
          setEvents((prev) => [payload.new as CallRow, ...prev].slice(0, 200));
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paused]);

  const filtered = useMemo(() => {
    const q = filterAgency.toLowerCase();
    return events.filter((e) =>
      !q || (e.agency_name?.toLowerCase().includes(q)) || (e.endpoint?.toLowerCase().includes(q))
    );
  }, [events, filterAgency]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input placeholder="Filter by agency or endpoint…" value={filterAgency}
          onChange={(e) => setFilterAgency(e.target.value)} className="max-w-sm" />
        <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
          {paused ? <><Play className="h-4 w-4 mr-1" /> Resume</> : <><Pause className="h-4 w-4 mr-1" /> Pause</>}
        </Button>
        <Badge variant={paused ? "outline" : "default"}>
          {paused ? "Paused" : "Live"} · {filtered.length} events
        </Badge>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="responsive-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Agency</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Latency</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No requests yet
                  </TableCell></TableRow>
                )}
                {filtered.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {format(new Date(e.created_at), "HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-xs">{e.agency_name ?? "—"}</TableCell>
                    <TableCell><code className="text-xs">{e.endpoint}</code></TableCell>
                    <TableCell>
                      <Badge variant={
                        e.status_code < 300 ? "default"
                        : e.status_code === 429 ? "outline"
                        : "destructive"
                      } className="text-[10px]">{e.status_code}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{e.response_ms ?? "—"}ms</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.ip ?? "—"}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">{e.error_message ?? ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ───────────────────────── Usage analytics tab ─────────────────────────

function UsageAnalyticsTab() {
  const { data: stats } = useQuery({
    queryKey: ["api-usage-stats"],
    queryFn: async () => {
      const since = subDays(new Date(), 7).toISOString();
      const { data } = await supabase.from("api_request_log" as any)
        .select("agency_name, endpoint, status_code, response_ms, created_at")
        .gte("created_at", since).limit(5000);
      const rows = (data as any[]) || [];

      const byAgency: Record<string, number> = {};
      const byEndpoint: Record<string, number> = {};
      let errors = 0;
      const lats: number[] = [];
      for (const r of rows) {
        byAgency[r.agency_name ?? "—"] = (byAgency[r.agency_name ?? "—"] || 0) + 1;
        byEndpoint[r.endpoint] = (byEndpoint[r.endpoint] || 0) + 1;
        if (r.status_code >= 400) errors++;
        if (r.response_ms != null) lats.push(r.response_ms);
      }
      lats.sort((a, b) => a - b);
      const p95 = lats.length ? lats[Math.floor(lats.length * 0.95)] : 0;
      return {
        total: rows.length, errors, p95,
        byAgency: Object.entries(byAgency).sort((a, b) => b[1] - a[1]),
        byEndpoint: Object.entries(byEndpoint).sort((a, b) => b[1] - a[1]).slice(0, 10),
      };
    },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Requests (7d)</p>
          <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Errors (7d)</p>
          <p className="text-2xl font-bold text-destructive">{stats?.errors ?? 0}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Error rate</p>
          <p className="text-2xl font-bold">
            {stats && stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : "0.0"}%
          </p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">p95 latency</p>
          <p className="text-2xl font-bold">{stats?.p95 ?? 0}ms</p>
        </CardContent></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Requests by agency</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(stats?.byAgency ?? []).map(([a, c]) => (
              <div key={a} className="flex items-center justify-between text-sm">
                <span className="truncate">{a}</span>
                <Badge variant="secondary">{c}</Badge>
              </div>
            ))}
            {!stats?.byAgency.length && <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Top endpoints</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            {(stats?.byEndpoint ?? []).map(([e, c]) => (
              <div key={e} className="flex items-center justify-between text-sm">
                <code className="text-xs truncate">{e}</code>
                <Badge variant="secondary">{c}</Badge>
              </div>
            ))}
            {!stats?.byEndpoint.length && <p className="text-sm text-muted-foreground">No data</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ───────────────────────── Scopes tab ─────────────────────────

function ScopesTab() {
  const qc = useQueryClient();
  const { data: scopes = [] } = useQuery({
    queryKey: ["api-scopes-admin"],
    queryFn: async () => {
      const { data } = await supabase.from("api_scopes" as any).select("*").order("category");
      return (data as any[]) || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      const { error } = await supabase.from("api_scopes" as any)
        .update({ is_active: value }).eq("scope_key", key);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-scopes-admin"] });
      qc.invalidateQueries({ queryKey: ["api-scopes"] });
      toast.success("Scope updated");
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Scope catalogue</CardTitle>
        <CardDescription>Disable a scope to immediately stop new keys from being issued against it.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {scopes.map((s: any) => (
          <div key={s.scope_key} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">{s.label}</p>
                <Badge variant="outline" className="text-[10px] capitalize">{s.category}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{s.description}</p>
              <code className="text-[10px]">{s.scope_key}</code>
            </div>
            <Switch checked={s.is_active}
              onCheckedChange={(v) => toggle.mutate({ key: s.scope_key, value: v })} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Page ─────────────────────────

export default function AgencyApiKeys() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6 text-primary" /> Agency API Console
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Issue read-only API access to external agencies. Monitor every call in real time.
        </p>
      </div>

      <Tabs defaultValue="keys">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="keys"><Key className="h-4 w-4 mr-1" /> Keys</TabsTrigger>
          <TabsTrigger value="live"><Activity className="h-4 w-4 mr-1" /> Live Activity</TabsTrigger>
          <TabsTrigger value="usage"><BarChart3 className="h-4 w-4 mr-1" /> Usage</TabsTrigger>
          <TabsTrigger value="plans"><DollarSign className="h-4 w-4 mr-1" /> Plans</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1" /> Billing</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1" /> Webhooks</TabsTrigger>
          <TabsTrigger value="scopes"><Shield className="h-4 w-4 mr-1" /> Scopes</TabsTrigger>
          <TabsTrigger value="access-control"><Settings2 className="h-4 w-4 mr-1" /> Access Control</TabsTrigger>
          <TabsTrigger value="docs"><FileText className="h-4 w-4 mr-1" /> Documentation</TabsTrigger>
        </TabsList>
        <TabsContent value="keys" className="mt-4"><KeysTab /></TabsContent>
        <TabsContent value="live" className="mt-4"><LiveActivityTab /></TabsContent>
        <TabsContent value="usage" className="mt-4"><UsageAnalyticsTab /></TabsContent>
        <TabsContent value="plans" className="mt-4"><PlansTab /></TabsContent>
        <TabsContent value="billing" className="mt-4"><BillingTab /></TabsContent>
        <TabsContent value="webhooks" className="mt-4"><WebhooksTab /></TabsContent>
        <TabsContent value="scopes" className="mt-4"><ScopesTab /></TabsContent>
        <TabsContent value="access-control" className="mt-4"><DeveloperAccessControl /></TabsContent>
        <TabsContent value="docs" className="mt-4"><ApiDocsContent /></TabsContent>
      </Tabs>
    </div>
  );
}

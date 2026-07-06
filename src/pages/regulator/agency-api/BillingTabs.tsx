import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, DollarSign, Webhook, AlertCircle, Plus, Trash2, RotateCcw, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";

// ─────────────────────────────── Plans Tab ───────────────────────────────

export function PlansTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);

  const { data: cfg } = useQuery({
    queryKey: ["billing-master"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_config")
        .select("config_value").eq("config_key", "agency_api_billing_enabled").maybeSingle();
      return !!(data?.config_value as any)?.enabled;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["api-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("api_pricing_plans" as any).select("*").order("sort_order");
      return (data as any[]) || [];
    },
  });

  const toggleMaster = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.functions.invoke("agency-api-billing", {
        body: { action: "toggle-billing-master", enabled },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing-master"] });
      toast.success("Master toggle updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertPlan = useMutation({
    mutationFn: async (p: any) => {
      const payload = { ...p, updated_at: new Date().toISOString() };
      if (p.id) {
        const { error } = await supabase.from("api_pricing_plans" as any).update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("api_pricing_plans" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-plans"] });
      setEditing(null);
      toast.success("Plan saved");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Master Billing Toggle</CardTitle>
              <CardDescription>
                When <strong>off</strong>, all API keys run free with no metering — useful during beta.
                When <strong>on</strong>, every key must have an active subscription or a billing override.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={cfg ? "default" : "outline"}>{cfg ? "Billing ON" : "Free Mode"}</Badge>
              <Switch checked={!!cfg} onCheckedChange={(v) => toggleMaster.mutate(v)} />
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{plans.length} plan{plans.length !== 1 ? "s" : ""}</p>
        <Button size="sm" onClick={() => setEditing({
          name: "", slug: "", price_ghs: 0, included_calls: 1000, rate_limit_per_minute: 60,
          allowed_scopes: [], environment_access: "sandbox", is_public: true, is_active: true,
          webhook_endpoints_max: 1, sort_order: 50,
        })}><Plus className="h-4 w-4 mr-1" /> New Plan</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Price (GHS/mo)</TableHead>
                <TableHead>Included calls</TableHead><TableHead>Overage /1k</TableHead>
                <TableHead>Env</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}{p.is_enterprise && <Badge variant="outline" className="ml-2 text-[10px]">Enterprise</Badge>}
                  </TableCell>
                  <TableCell>{Number(p.price_ghs).toLocaleString()}</TableCell>
                  <TableCell>{Number(p.included_calls).toLocaleString()}</TableCell>
                  <TableCell>{p.overage_price_ghs_per_1k ? `GHS ${p.overage_price_ghs_per_1k}` : "Hard cap"}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px]">{p.environment_access}</Badge></TableCell>
                  <TableCell>{p.is_active ? <Badge>Active</Badge> : <Badge variant="outline">Hidden</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Plan" : "New Plan"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Price (GHS/mo)</Label><Input type="number" value={editing.price_ghs} onChange={(e) => setEditing({ ...editing, price_ghs: Number(e.target.value) })} /></div>
                <div><Label>Included calls</Label><Input type="number" value={editing.included_calls} onChange={(e) => setEditing({ ...editing, included_calls: Number(e.target.value) })} /></div>
                <div><Label>Overage /1k (blank = hard cap)</Label><Input type="number" step="0.01" value={editing.overage_price_ghs_per_1k ?? ""} onChange={(e) => setEditing({ ...editing, overage_price_ghs_per_1k: e.target.value ? Number(e.target.value) : null })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Rate /min</Label><Input type="number" value={editing.rate_limit_per_minute} onChange={(e) => setEditing({ ...editing, rate_limit_per_minute: Number(e.target.value) })} /></div>
                <div><Label>Webhook max</Label><Input type="number" value={editing.webhook_endpoints_max} onChange={(e) => setEditing({ ...editing, webhook_endpoints_max: Number(e.target.value) })} /></div>
                <div><Label>Environment</Label>
                  <Select value={editing.environment_access} onValueChange={(v) => setEditing({ ...editing, environment_access: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Allowed scopes (comma separated)</Label>
                <Input value={(editing.allowed_scopes || []).join(",")} onChange={(e) => setEditing({ ...editing, allowed_scopes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /> Active</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={editing.is_public} onCheckedChange={(v) => setEditing({ ...editing, is_public: v })} /> Public</label>
                <label className="flex items-center gap-2 text-sm"><Switch checked={!!editing.is_enterprise} onCheckedChange={(v) => setEditing({ ...editing, is_enterprise: v })} /> Enterprise</label>
              </div>
              <Button className="w-full" disabled={upsertPlan.isPending} onClick={() => upsertPlan.mutate(editing)}>
                {upsertPlan.isPending ? "Saving…" : "Save Plan"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────── Billing Tab ───────────────────────────────

export function BillingTab() {
  const qc = useQueryClient();

  const { data: keys = [] } = useQuery({
    queryKey: ["agency-api-keys"],
    queryFn: async () => {
      const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["api-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("api_pricing_plans" as any).select("*").eq("is_active", true).order("sort_order");
      return (data as any[]) || [];
    },
  });

  const { data: subs = [] } = useQuery({
    queryKey: ["api-subs"],
    queryFn: async () => {
      const { data } = await supabase.from("api_subscriptions" as any)
        .select("*, plan:api_pricing_plans(name, slug, price_ghs)").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["api-invoices"],
    queryFn: async () => {
      const { data } = await supabase.from("api_invoices" as any).select("*").order("created_at", { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  const checkout = useMutation({
    mutationFn: async ({ api_key_id, plan_id, email }: any) => {
      const { data, error } = await supabase.functions.invoke("agency-api-billing", {
        body: { action: "create-checkout", api_key_id, plan_id, email },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: (data: any) => {
      if (!startBrandedCheckout(data)) {
        toast.error("No secure checkout details received");
        return;
      }
      toast.success("Opening secure checkout…");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignManual = useMutation({
    mutationFn: async ({ api_key_id, plan_id }: any) => {
      const { error } = await supabase.functions.invoke("agency-api-billing", {
        body: { action: "assign-plan-manual", api_key_id, plan_id },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["api-subs"] });
      qc.invalidateQueries({ queryKey: ["agency-api-keys"] });
      toast.success("Plan assigned");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setOverride = useMutation({
    mutationFn: async ({ api_key_id, override, price_ghs }: any) => {
      const { error } = await supabase.functions.invoke("agency-api-billing", {
        body: { action: "set-billing-override", api_key_id, override, price_ghs },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agency-api-keys"] });
      toast.success("Override updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeSub = (keyId: string) => subs.find((s: any) => s.api_key_id === keyId && ["active", "trialing", "past_due"].includes(s.status));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Subscriptions by Key</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead><TableHead>Current plan</TableHead>
                <TableHead>Override</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k: any) => {
                const sub = activeSub(k.id);
                return (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.agency_name}</TableCell>
                    <TableCell>{sub?.plan?.name ?? <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell>
                      {k.billing_override === "free" ? <Badge variant="secondary">Free (comp)</Badge>
                        : k.billing_override === "custom_price" ? <Badge variant="secondary">GHS {k.billing_override_price_ghs}/mo</Badge>
                        : <span className="text-muted-foreground text-xs">none</span>}
                    </TableCell>
                    <TableCell>{sub ? <Badge>{sub.status}</Badge> : <Badge variant="outline">No subscription</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <KeyBillingActions
                        keyRow={k}
                        plans={plans}
                        onCheckout={(plan_id) => checkout.mutate({ api_key_id: k.id, plan_id, email: k.agency_contact_email })}
                        onAssign={(plan_id) => assignManual.mutate({ api_key_id: k.id, plan_id })}
                        onComp={() => setOverride.mutate({ api_key_id: k.id, override: "free", price_ghs: null })}
                        onClearOverride={() => setOverride.mutate({ api_key_id: k.id, override: null, price_ghs: null })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Invoices</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead><TableHead>Amount</TableHead>
                <TableHead>Status</TableHead><TableHead>Paystack ref</TableHead><TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">No invoices yet</TableCell></TableRow>}
              {invoices.map((i: any) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                  <TableCell>GHS {Number(i.amount_ghs).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={i.status === "paid" ? "default" : i.status === "pending" ? "outline" : "destructive"}>{i.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{i.paystack_reference ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(i.created_at), { addSuffix: true })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function KeyBillingActions({ keyRow, plans, onCheckout, onAssign, onComp, onClearOverride }: any) {
  const [planId, setPlanId] = useState<string>("");
  return (
    <Dialog>
      <DialogTrigger asChild><Button size="sm" variant="outline">Manage</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Billing — {keyRow.agency_name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Choose plan</Label>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {plans.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — GHS {p.price_ghs}/mo · {Number(p.included_calls).toLocaleString()} calls
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" disabled={!planId} onClick={() => onCheckout(planId)} className="flex-1">
                <ExternalLink className="h-3 w-3 mr-1" /> Open secure checkout
              </Button>
              <Button size="sm" variant="outline" disabled={!planId} onClick={() => onAssign(planId)}>
                Assign without payment
              </Button>
            </div>
          </div>
          <div className="border-t pt-3 space-y-2">
            <Label>Billing override</Label>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={onComp}>Make this key free (comp)</Button>
              <Button size="sm" variant="ghost" onClick={onClearOverride}>Clear override</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────── Webhooks Tab ───────────────────────────────

const ALL_EVENTS = [
  "landlord.created", "tenant.registered", "tenancy.activated", "tenancy.terminated",
  "complaint.filed", "complaint.status_changed", "property.listed", "payment.reconciled",
];

export function WebhooksTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ api_key_id: "", url: "", events: [], description: "" });

  const { data: keys = [] } = useQuery({
    queryKey: ["agency-api-keys"],
    queryFn: async () => (await supabase.from("api_keys").select("id, agency_name")).data || [],
  });

  const { data: endpoints = [] } = useQuery({
    queryKey: ["webhook-endpoints"],
    queryFn: async () => {
      const { data } = await supabase.from("api_webhook_endpoints" as any)
        .select("*, key:api_keys(agency_name)").order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const { data: deliveries = [] } = useQuery({
    queryKey: ["webhook-deliveries"],
    queryFn: async () => {
      const { data } = await supabase.from("api_webhook_deliveries" as any)
        .select("*, endpoint:api_webhook_endpoints(url)").order("created_at", { ascending: false }).limit(50);
      return (data as any[]) || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
      const { error } = await supabase.from("api_webhook_endpoints" as any).insert({
        api_key_id: form.api_key_id, url: form.url, events: form.events,
        description: form.description, secret,
      });
      if (error) throw error;
      return secret;
    },
    onSuccess: (secret) => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      setOpen(false); setForm({ api_key_id: "", url: "", events: [], description: "" });
      toast.success("Endpoint created", {
        description: `Signing secret: ${secret} (copy it now — it can be viewed later in the table)`,
        duration: 15000,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const redeliver = useMutation({
    mutationFn: async (delivery_id: string) => {
      const { error } = await supabase.functions.invoke("agency-webhook-dispatcher", { body: { delivery_id } });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-deliveries"] });
      toast.success("Re-delivery queued");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeEndpoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("api_webhook_endpoints" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhook-endpoints"] });
      toast.success("Endpoint removed");
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Endpoint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New webhook endpoint</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>API key</Label>
                <Select value={form.api_key_id} onValueChange={(v) => setForm({ ...form, api_key_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>{keys.map((k: any) => <SelectItem key={k.id} value={k.id}>{k.agency_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>URL</Label><Input placeholder="https://example.gov.gh/webhooks/rentcontrol" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></div>
              <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div>
                <Label className="mb-1 block">Events</Label>
                <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto border rounded p-2">
                  {ALL_EVENTS.map((ev) => (
                    <label key={ev} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={form.events.includes(ev)}
                        onChange={(e) => setForm({ ...form, events: e.target.checked ? [...form.events, ev] : form.events.filter((x: string) => x !== ev) })} />
                      <code>{ev}</code>
                    </label>
                  ))}
                </div>
              </div>
              <Button className="w-full" disabled={!form.api_key_id || !form.url || form.events.length === 0} onClick={() => create.mutate()}>
                Create endpoint
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> Endpoints</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agency</TableHead><TableHead>URL</TableHead><TableHead>Events</TableHead>
                <TableHead>Status</TableHead><TableHead>Last delivery</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No endpoints yet</TableCell></TableRow>}
              {endpoints.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.key?.agency_name}</TableCell>
                  <TableCell><code className="text-xs">{e.url}</code></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[260px]">
                      {(e.events || []).map((ev: string) => <Badge key={ev} variant="secondary" className="text-[10px]">{ev}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={e.status === "active" ? "default" : e.status === "failing" ? "outline" : "destructive"}>{e.status}</Badge>
                    {e.consecutive_failures > 0 && <span className="text-xs text-muted-foreground ml-1">({e.consecutive_failures} fail)</span>}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.last_delivery_at ? formatDistanceToNow(new Date(e.last_delivery_at), { addSuffix: true }) : "Never"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => confirm("Delete endpoint?") && removeEndpoint.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent Deliveries</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead><TableHead>URL</TableHead><TableHead>Status</TableHead>
                <TableHead>Attempt</TableHead><TableHead>HTTP</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground text-sm">No deliveries yet</TableCell></TableRow>}
              {deliveries.map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="text-xs"><code>{d.event_type}</code></TableCell>
                  <TableCell><code className="text-xs">{d.endpoint?.url}</code></TableCell>
                  <TableCell><Badge variant={d.status === "succeeded" ? "default" : d.status === "pending" ? "outline" : "destructive"}>{d.status}</Badge></TableCell>
                  <TableCell>{d.attempt}</TableCell>
                  <TableCell>{d.response_status ?? "—"}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" onClick={() => redeliver.mutate(d.id)}><RotateCcw className="h-3 w-3" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

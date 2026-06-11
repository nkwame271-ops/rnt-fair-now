import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeveloperOrg, useDeveloperKeys } from "@/hooks/useDeveloperOrg";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const EVENT_TYPES = [
  "landlord.registered", "landlord.updated",
  "tenant.registered", "tenant.tenancy_started", "tenant.tenancy_ended",
  "property.created", "property.vacancy_changed",
  "complaint.opened", "complaint.status_changed", "complaint.closed",
];

function genSecret() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return "whsec_" + Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function DeveloperWebhooks() {
  const qc = useQueryClient();
  const { data: org } = useDeveloperOrg();
  const { data: keys = [] } = useDeveloperKeys(org?.id);
  const keyIds = keys.map((k) => k.id);

  const [url, setUrl] = useState("");
  const [keyId, setKeyId] = useState("");
  const [events, setEvents] = useState<string[]>(["complaint.opened"]);

  const { data: endpoints = [] } = useQuery({
    queryKey: ["developer-webhooks", keyIds.join(",")],
    enabled: keyIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_webhook_endpoints" as any)
        .select("*")
        .in("api_key_id", keyIds)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const addEndpoint = async () => {
    if (!url || !keyId) return toast.error("Pick a key and enter a URL");
    if (!/^https:\/\//.test(url)) return toast.error("URL must use https://");
    const secret = genSecret();
    const { error } = await supabase.from("api_webhook_endpoints" as any).insert({
      api_key_id: keyId, url, signing_secret: secret, events, is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Endpoint added");
    setUrl(""); setEvents(["complaint.opened"]);
    qc.invalidateQueries({ queryKey: ["developer-webhooks"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this webhook endpoint?")) return;
    const { error } = await supabase.from("api_webhook_endpoints" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["developer-webhooks"] });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Webhooks</h1>
        <p className="text-sm text-muted-foreground">Receive signed push events instead of polling. HMAC-SHA256 over <code>timestamp.body</code>.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add endpoint</CardTitle>
          <CardDescription>Choose which key the deliveries are scoped to.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Key</Label>
              <Select value={keyId} onValueChange={setKeyId}>
                <SelectTrigger><SelectValue placeholder="Select a key" /></SelectTrigger>
                <SelectContent>
                  {keys.filter((k) => k.is_active).map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.key_prefix}… ({k.environment})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Endpoint URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-app.example/webhooks/rcg" />
            </div>
          </div>
          <div>
            <Label>Events</Label>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {EVENT_TYPES.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEvents((cur) => cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e])}
                  className={`text-xs px-2 py-1 rounded-md border ${events.includes(e) ? "bg-primary text-primary-foreground" : "bg-background"}`}
                >{e}</button>
              ))}
            </div>
          </div>
          <Button size="sm" onClick={addEndpoint}><Plus className="h-4 w-4 mr-1" />Add endpoint</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {endpoints.map((ep: any) => (
          <Card key={ep.id}>
            <CardContent className="p-4 flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-sm font-mono break-all">{ep.url}</p>
                <div className="flex flex-wrap gap-1">
                  {(ep.events ?? []).map((e: string) => <Badge key={e} variant="outline" className="text-[10px]">{e}</Badge>)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Failures: {ep.consecutive_failures ?? 0} · {ep.is_active ? "Active" : "Disabled"}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(ep.id)}><Trash2 className="h-4 w-4" /></Button>
            </CardContent>
          </Card>
        ))}
        {endpoints.length === 0 && (
          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No endpoints yet.</CardContent></Card>
        )}
      </div>
    </div>
  );
}

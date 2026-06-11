import { useState } from "react";
import { useDeveloperOrg, useDeveloperKeys } from "@/hooks/useDeveloperOrg";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, RotateCw, ShieldOff, Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import AccessRequestBanner from "@/components/developers/AccessRequestBanner";

export default function DeveloperKeys() {
  const qc = useQueryClient();
  const { data: org } = useDeveloperOrg();
  const { data: keys = [], isLoading } = useDeveloperKeys(org?.id);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ key: string; prefix: string } | null>(null);

  const hasActiveSandbox = keys.some((k) => k.environment === "sandbox" && k.is_active);
  const hasLive = keys.some((k) => (k.environment === "live" || k.environment === "production"));

  const provisionSandbox = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("developer_provision_sandbox_key" as any);
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      setRevealed({ key: row.api_key, prefix: row.key_prefix });
      qc.invalidateQueries({ queryKey: ["developer-keys"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to provision");
    } finally {
      setBusy(false);
    }
  };

  const rotate = async (id: string) => {
    if (!confirm("Rotate this key? The current key keeps working for 24 hours.")) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("developer_rotate_api_key" as any, { p_key_id: id });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      setRevealed({ key: row.api_key, prefix: row.key_prefix });
      qc.invalidateQueries({ queryKey: ["developer-keys"] });
    } catch (e: any) {
      toast.error(e.message ?? "Rotation failed");
    } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    const reason = prompt("Reason for revoking (optional):") ?? null;
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("developer_revoke_api_key" as any, { p_key_id: id, p_reason: reason });
      if (error) throw error;
      toast.success("Key revoked");
      qc.invalidateQueries({ queryKey: ["developer-keys"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <AccessRequestBanner />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">Keys are shown once at creation. Store them in a secret manager.</p>
        </div>
        <div className="flex gap-2">
          {!hasActiveSandbox && (
            <Button onClick={provisionSandbox} disabled={busy} size="sm">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create sandbox key
            </Button>
          )}
          {!hasLive && (
            <Link to="/developers/request-access">
              <Button size="sm" variant="outline"><KeyRound className="h-4 w-4 mr-2" />Request live access</Button>
            </Link>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-10"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
      ) : keys.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          No keys yet. Create your sandbox key to get started.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm">{k.key_prefix}…</code>
                    <Badge variant={k.environment === "sandbox" ? "secondary" : "default"}>{k.environment}</Badge>
                    {!k.is_active && <Badge variant="destructive">Revoked</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scopes: {(k.scopes ?? []).join(", ") || "(none)"} · Rate {k.rate_limit_per_minute}/min
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Last used: {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"}
                  </p>
                </div>
                {k.is_active && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => rotate(k.id)} disabled={busy}>
                      <RotateCw className="h-3 w-3 mr-1" />Rotate
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => revoke(k.id)} disabled={busy}>
                      <ShieldOff className="h-3 w-3 mr-1" />Revoke
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!revealed} onOpenChange={(o) => !o && setRevealed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogDescription>
              This is the only time we'll show this key. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input readOnly value={revealed?.key ?? ""} className="font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={() => {
              navigator.clipboard.writeText(revealed?.key ?? "");
              toast.success("Copied");
            }}><Copy className="h-4 w-4" /></Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealed(null)}>I've saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

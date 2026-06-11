import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ShieldOff, PauseCircle, PlayCircle, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Org = {
  id: string;
  name: string;
  contact_email: string;
  contact_phone: string | null;
  agency_type: string | null;
  intended_use_case: string | null;
  owner_user_id: string;
  account_status: "active" | "suspended" | "revoked";
  status_changed_at: string | null;
  status_reason: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<Org["account_status"], "default" | "secondary" | "destructive"> = {
  active: "default",
  suspended: "secondary",
  revoked: "destructive",
};

export default function DeveloperAccounts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [decision, setDecision] = useState<{ org: Org; status: Org["account_status"] } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ["regulator-developer-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("developer_organizations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Org[];
    },
  });

  const { data: keyCounts = {} } = useQuery({
    queryKey: ["regulator-developer-org-keycounts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_keys")
        .select("organization_id, environment, is_active");
      const map: Record<string, { sandbox: number; live: number }> = {};
      for (const k of (data ?? []) as any[]) {
        if (!k.organization_id || !k.is_active) continue;
        map[k.organization_id] ??= { sandbox: 0, live: 0 };
        if (k.environment === "sandbox") map[k.organization_id].sandbox++;
        else map[k.organization_id].live++;
      }
      return map;
    },
  });

  const filtered = orgs.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [o.name, o.contact_email, o.agency_type].some((v) => (v ?? "").toLowerCase().includes(q));
  });

  const apply = async () => {
    if (!decision) return;
    if (decision.status !== "active" && reason.trim().length < 5) {
      toast.error("Please provide a reason (5+ chars).");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("regulator_set_developer_org_status" as any, {
        p_org_id: decision.org.id,
        p_status: decision.status,
        p_reason: reason.trim() || null,
      });
      if (error) throw error;
      toast.success(
        decision.status === "active"
          ? "Account reinstated."
          : `Account ${decision.status}. ${(data as any)?.keys_revoked ?? 0} key(s) revoked.`,
      );
      setDecision(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["regulator-developer-orgs"] });
      qc.invalidateQueries({ queryKey: ["regulator-developer-org-keycounts"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Helmet><title>Developer accounts — Regulator</title></Helmet>

      <div>
        <h1 className="text-2xl font-semibold">Developer accounts</h1>
        <p className="text-sm text-muted-foreground">
          Self-signup developers. Sandbox keys are issued automatically. Live access requires approval from{" "}
          <Link className="underline" to="/regulator/api-access-requests">API Access Requests</Link>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All organizations ({filtered.length})</CardTitle>
          <CardDescription>Suspend or revoke accounts that violate the DSA. Revoking auto-disables all keys.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Input placeholder="Search by org, email, or agency type…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isLoading ? (
            <div className="py-10 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No developer accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((o) => {
                    const ks = keyCounts[o.id] ?? { sandbox: 0, live: 0 };
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-medium">{o.name}</div>
                          <div className="text-xs text-muted-foreground">{o.agency_type || "—"}</div>
                          {o.intended_use_case && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-md line-clamp-2">{o.intended_use_case}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{o.contact_email}</div>
                          <div className="text-xs text-muted-foreground">{o.contact_phone || ""}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> Sandbox · {ks.sandbox}</div>
                          <div className="flex items-center gap-1"><KeyRound className="h-3 w-3" /> Live · {ks.live}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[o.account_status]}>{o.account_status}</Badge>
                          {o.status_reason && (
                            <div className="text-xs text-muted-foreground mt-1 max-w-[220px]">{o.status_reason}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right space-x-1">
                          {o.account_status === "active" && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => { setReason(""); setDecision({ org: o, status: "suspended" }); }}>
                                <PauseCircle className="h-3 w-3 mr-1" />Suspend
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setReason(""); setDecision({ org: o, status: "revoked" }); }}>
                                <ShieldOff className="h-3 w-3 mr-1" />Revoke
                              </Button>
                            </>
                          )}
                          {o.account_status !== "active" && (
                            <Button size="sm" variant="outline" onClick={() => { setReason(""); setDecision({ org: o, status: "active" }); }}>
                              <PlayCircle className="h-3 w-3 mr-1" />Reinstate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!decision} onOpenChange={(o) => !o && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.status === "active" && "Reinstate developer account"}
              {decision?.status === "suspended" && "Suspend developer account"}
              {decision?.status === "revoked" && "Revoke developer account"}
            </DialogTitle>
            <DialogDescription>
              {decision?.status === "active"
                ? "The account regains access; you may issue new keys, but previously revoked keys stay revoked."
                : "All active API keys for this organization will be revoked immediately and the developer will be blocked from the dashboard."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm"><strong>{decision?.org.name}</strong> · {decision?.org.contact_email}</p>
            <Textarea
              placeholder={decision?.status === "active" ? "Optional note" : "Reason (required, 5+ chars)"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Cancel</Button>
            <Button onClick={apply} disabled={busy} variant={decision?.status === "revoked" ? "destructive" : "default"}>
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

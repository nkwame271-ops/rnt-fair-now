import { useState, useEffect } from "react";
import { ShieldAlert, Search, Loader2, RotateCcw, Trash2, Archive, ScrollText, Ban, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

interface Props {
  refreshKey: number;
  onStockChanged: () => void;
}

const AdminActions = ({ refreshKey, onStockChanged }: Props) => {
  // --- Revoke Batch ---
  const [batchSearch, setBatchSearch] = useState("");
  const [batchResults, setBatchResults] = useState<{ batch_label: string; available: number; assigned: number; revoked: number }[]>([]);
  const [batchSearching, setBatchSearching] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);

  // --- Unassign Serial ---
  const [serialSearch, setSerialSearch] = useState("");
  const [serialResult, setSerialResult] = useState<any>(null);
  const [serialSearching, setSerialSearching] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<string | null>(null);

  // --- Void Upload ---
  const [voidBatchSearch, setVoidBatchSearch] = useState("");
  const [voidBatchResults, setVoidBatchResults] = useState<{ batch_label: string; available: number }[]>([]);
  const [voidSearching, setVoidSearching] = useState(false);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);

  // --- Account Management ---
  const [accountSearch, setAccountSearch] = useState("");
  const [accountType, setAccountType] = useState<"landlord" | "tenant" | "admin">("landlord");
  const [accountResult, setAccountResult] = useState<any>(null);
  const [accountSearching, setAccountSearching] = useState(false);
  const [accountAction, setAccountAction] = useState<{ action: string; targetId: string; accountType: string } | null>(null);

  // --- Audit Log ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const handleBatchSearch = async () => {
    if (!batchSearch.trim()) return;
    setBatchSearching(true);
    const { data } = await supabase
      .from("rent_card_serial_stock" as any)
      .select("batch_label, status")
      .ilike("batch_label", `%${batchSearch.trim()}%`);

    const items = (data || []) as any[];
    const grouped = new Map<string, { available: number; assigned: number; revoked: number }>();
    for (const item of items) {
      const key = item.batch_label || "Unknown";
      if (!grouped.has(key)) grouped.set(key, { available: 0, assigned: 0, revoked: 0 });
      const g = grouped.get(key)!;
      if (item.status === "available") g.available++;
      else if (item.status === "assigned") g.assigned++;
      else if (item.status === "revoked") g.revoked++;
    }
    setBatchResults(Array.from(grouped.entries()).map(([batch_label, counts]) => ({ batch_label, ...counts })));
    setBatchSearching(false);
  };

  const handleSerialSearch = async () => {
    if (!serialSearch.trim()) return;
    setSerialSearching(true);
    setSerialResult(null);
    const { data } = await supabase
      .from("rent_card_serial_stock" as any)
      .select("*")
      .eq("serial_number", serialSearch.trim())
      .single();
    setSerialResult(data || null);
    if (!data) toast.error("Serial not found");
    setSerialSearching(false);
  };

  const handleVoidSearch = async () => {
    if (!voidBatchSearch.trim()) return;
    setVoidSearching(true);
    const { data } = await supabase
      .from("rent_card_serial_stock" as any)
      .select("batch_label, status")
      .ilike("batch_label", `%${voidBatchSearch.trim()}%`)
      .eq("status", "available");

    const items = (data || []) as any[];
    const grouped = new Map<string, number>();
    for (const item of items) {
      const key = item.batch_label || "Unknown";
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    setVoidBatchResults(Array.from(grouped.entries()).map(([batch_label, available]) => ({ batch_label, available })));
    setVoidSearching(false);
  };

  const handleAccountSearch = async () => {
    if (!accountSearch.trim()) return;
    setAccountSearching(true);
    setAccountResult(null);

    const table = accountType === "landlord" ? "landlords" : "tenants";
    const idField = accountType === "landlord" ? "landlord_id" : "tenant_id";

    // Search by ID code first
    const { data: records } = await supabase
      .from(table)
      .select(`user_id, ${idField}, account_status`)
      .ilike(idField, `%${accountSearch.trim()}%`)
      .limit(1);

    if (records && records.length > 0) {
      const rec = records[0] as any;
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("user_id", rec.user_id).single();
      setAccountResult({
        userId: rec.user_id,
        idCode: rec[idField],
        name: profile?.full_name || "Unknown",
        email: profile?.email || "",
        accountStatus: rec.account_status || "active",
        type: accountType,
      });
    } else {
      // Fallback: search by name
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").ilike("full_name", `%${accountSearch.trim()}%`).limit(5);
      if (profiles && profiles.length > 0) {
        for (const p of profiles) {
          const { data: rec } = await supabase.from(table).select(`user_id, ${idField}, account_status`).eq("user_id", p.user_id).maybeSingle();
          if (rec) {
            setAccountResult({
              userId: (rec as any).user_id,
              idCode: (rec as any)[idField],
              name: p.full_name,
              email: p.email || "",
              accountStatus: (rec as any).account_status || "active",
              type: accountType,
            });
            break;
          }
        }
      }
      if (!accountResult) toast.error(`No ${accountType} found`);
    }
    setAccountSearching(false);
  };

  const handleAdminAction = async (action: string, targetId: string, password: string, reason: string, extra?: any) => {
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action, target_id: targetId, reason, password, extra },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    toast.success("Action completed successfully");
    onStockChanged();
    loadAuditLogs();
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    const { data } = await supabase
      .from("admin_audit_log" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setAuditLogs((data || []) as any[]);
    setAuditLoading(false);
  };

  useEffect(() => { loadAuditLogs(); }, [refreshKey]);

  return (
    <div className="space-y-6">
      {/* Revoke Serial Batch */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Trash2 className="h-5 w-5 text-destructive" /> Revoke Serial Batch
        </h2>
        <p className="text-sm text-muted-foreground">Search by batch label to revoke unused serials from office stock.</p>
        <div className="flex gap-3">
          <Input placeholder="Search batch label..." value={batchSearch} onChange={(e) => setBatchSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBatchSearch()} className="flex-1" />
          <Button onClick={handleBatchSearch} disabled={batchSearching} variant="outline">
            {batchSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {batchResults.map((b) => (
          <div key={b.batch_label} className="border border-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono font-bold text-sm text-card-foreground">{b.batch_label}</p>
              <p className="text-xs text-muted-foreground">Available: {b.available} • Assigned: {b.assigned} • Revoked: {b.revoked}</p>
            </div>
            {b.available > 0 && (
              <Button variant="destructive" size="sm" onClick={() => setRevokeTarget(b.batch_label)}>
                Revoke {b.available} Unused
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Unassign Serial */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-primary" /> Unassign Serial
        </h2>
        <p className="text-sm text-muted-foreground">Search by exact serial number. Only serials not linked to active tenancies can be unassigned.</p>
        <div className="flex gap-3">
          <Input placeholder="Enter serial number..." value={serialSearch} onChange={(e) => setSerialSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSerialSearch()} className="flex-1" />
          <Button onClick={handleSerialSearch} disabled={serialSearching} variant="outline">
            {serialSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {serialResult && (
          <div className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-mono font-bold text-sm text-card-foreground">{serialResult.serial_number}</p>
                <p className="text-xs text-muted-foreground">Office: {serialResult.office_name} • Status: {serialResult.status}</p>
              </div>
              <Badge className={serialResult.status === "assigned" ? "bg-primary/10 text-primary" : serialResult.status === "available" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                {serialResult.status}
              </Badge>
            </div>
            {serialResult.status === "assigned" && (
              <Button variant="destructive" size="sm" onClick={() => setUnassignTarget(serialResult.serial_number)}>
                Unassign Serial
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Void Upload */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Ban className="h-5 w-5 text-warning" /> Void Upload
        </h2>
        <p className="text-sm text-muted-foreground">Search by batch label to void all unused serials from an incorrect upload.</p>
        <div className="flex gap-3">
          <Input placeholder="Search batch label..." value={voidBatchSearch} onChange={(e) => setVoidBatchSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleVoidSearch()} className="flex-1" />
          <Button onClick={handleVoidSearch} disabled={voidSearching} variant="outline">
            {voidSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {voidBatchResults.map((b) => (
          <div key={b.batch_label} className="border border-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-mono font-bold text-sm text-card-foreground">{b.batch_label}</p>
              <p className="text-xs text-muted-foreground">{b.available} unused serials can be voided</p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setVoidTarget(b.batch_label)}>
              Void {b.available} Serials
            </Button>
          </div>
        ))}
      </div>

      {/* Account Management */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <UserX className="h-5 w-5 text-destructive" /> Account Management
        </h2>
        <p className="text-sm text-muted-foreground">Deactivate or archive landlord/tenant accounts. Accounts with active tenancies cannot be archived.</p>
        <div className="flex gap-3">
          <Select value={accountType} onValueChange={(v) => { setAccountType(v as any); setAccountResult(null); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="landlord">Landlord</SelectItem>
              <SelectItem value="tenant">Tenant</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Search by ID or name..." value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAccountSearch()} className="flex-1" />
          <Button onClick={handleAccountSearch} disabled={accountSearching} variant="outline">
            {accountSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
        {accountResult && (
          <div className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-card-foreground">{accountResult.name}</p>
                <p className="text-xs text-muted-foreground">{accountResult.idCode} • {accountResult.email}</p>
              </div>
              <Badge className={
                accountResult.accountStatus === "active" ? "bg-success/10 text-success" :
                accountResult.accountStatus === "deactivated" ? "bg-warning/10 text-warning" :
                "bg-muted text-muted-foreground"
              }>
                {accountResult.accountStatus}
              </Badge>
            </div>
            <div className="flex gap-2 flex-wrap">
              {accountResult.accountStatus === "active" && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setAccountAction({ action: "deactivate_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                    Deactivate
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setAccountAction({ action: "archive_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                    <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                  </Button>
                </>
              )}
              {accountResult.accountStatus === "deactivated" && (
                <Button variant="destructive" size="sm" onClick={() => setAccountAction({ action: "archive_account", targetId: accountResult.userId, accountType: accountResult.type })}>
                  <Archive className="h-3.5 w-3.5 mr-1" /> Archive
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Audit Log */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-primary" /> Audit Log
        </h2>
        {auditLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading...</p>
        ) : auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No audit entries yet.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {auditLogs.map((log: any) => (
              <div key={log.id} className="border border-border rounded-lg p-3 text-sm space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-xs">{log.action}</Badge>
                  <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                <p className="text-xs text-muted-foreground">Target: <span className="font-mono">{log.target_type}/{log.target_id}</span></p>
                <p className="text-xs text-card-foreground">Reason: {log.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Confirm Dialogs */}
      <AdminPasswordConfirm
        open={!!revokeTarget}
        onOpenChange={() => setRevokeTarget(null)}
        title="Revoke Serial Batch"
        description={`This will revoke all unused serials in batch "${revokeTarget}". This action cannot be undone.`}
        actionLabel="Revoke Batch"
        onConfirm={async (password, reason) => {
          await handleAdminAction("revoke_batch", revokeTarget!, password, reason);
          setRevokeTarget(null);
          setBatchResults([]);
        }}
      />

      <AdminPasswordConfirm
        open={!!unassignTarget}
        onOpenChange={() => setUnassignTarget(null)}
        title="Unassign Serial"
        description={`This will unassign serial "${unassignTarget}" and return it to available stock.`}
        actionLabel="Unassign"
        onConfirm={async (password, reason) => {
          await handleAdminAction("unassign_serial", unassignTarget!, password, reason);
          setUnassignTarget(null);
          setSerialResult(null);
        }}
      />

      <AdminPasswordConfirm
        open={!!voidTarget}
        onOpenChange={() => setVoidTarget(null)}
        title="Void Upload"
        description={`This will void all unused serials in batch "${voidTarget}". Voided serials cannot be recovered.`}
        actionLabel="Void Batch"
        onConfirm={async (password, reason) => {
          await handleAdminAction("void_upload", voidTarget!, password, reason);
          setVoidTarget(null);
          setVoidBatchResults([]);
        }}
      />

      <AdminPasswordConfirm
        open={!!accountAction}
        onOpenChange={() => setAccountAction(null)}
        title={accountAction?.action === "deactivate_account" ? "Deactivate Account" : "Archive Account"}
        description={
          accountAction?.action === "deactivate_account"
            ? "This will deactivate the account. The user will no longer be able to access their dashboard."
            : "This will archive the account. Only accounts without active tenancies can be archived."
        }
        actionLabel={accountAction?.action === "deactivate_account" ? "Deactivate" : "Archive"}
        onConfirm={async (password, reason) => {
          await handleAdminAction(
            accountAction!.action,
            accountAction!.targetId,
            password,
            reason,
            { account_type: accountAction!.accountType }
          );
          setAccountAction(null);
          setAccountResult(null);
        }}
      />
    </div>
  );
};

export default AdminActions;

import { useState, useEffect } from "react";
import { ShieldAlert, Search, Loader2, RotateCcw, Trash2, Archive, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    </div>
  );
};

export default AdminActions;

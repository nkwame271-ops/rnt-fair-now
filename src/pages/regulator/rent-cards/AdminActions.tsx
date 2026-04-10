import { useState, useEffect } from "react";
import { Search, Loader2, RotateCcw, Trash2, ScrollText, Ban, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import { useModuleVisibility } from "@/hooks/useModuleVisibility";

interface Props {
  refreshKey: number;
  onStockChanged: () => void;
}

interface BatchSummary {
  batch_label: string;
  available: number;
  assigned: number;
  revoked: number;
  total: number;
}

const AdminActions = ({ refreshKey, onStockChanged }: Props) => {
  const { isVisible } = useModuleVisibility("rent_cards");
  // --- Serial Stock Registry ---
  const [registryBatches, setRegistryBatches] = useState<BatchSummary[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);

  // --- Revoke Batch ---
  const [batchSearch, setBatchSearch] = useState("");
  const [batchResults, setBatchResults] = useState<BatchSummary[]>([]);
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

  // --- Audit Log ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load all batch labels on mount
  const loadRegistryBatches = async () => {
    setRegistryLoading(true);
    try {
      let allData: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data } = await supabase
          .from("rent_card_serial_stock" as any)
          .select("batch_label, status")
          .not("batch_label", "is", null)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }

      const grouped = new Map<string, BatchSummary>();
      for (const item of allData) {
        const key = item.batch_label || "Unbatched";
        if (!grouped.has(key)) grouped.set(key, { batch_label: key, available: 0, assigned: 0, revoked: 0, total: 0 });
        const g = grouped.get(key)!;
        g.total++;
        if (item.status === "available") g.available++;
        else if (item.status === "assigned") g.assigned++;
        else if (item.status === "revoked") g.revoked++;
      }
      setRegistryBatches(Array.from(grouped.values()).sort((a, b) => b.total - a.total));
    } catch {
      toast.error("Failed to load batch registry");
    }
    setRegistryLoading(false);
  };

  useEffect(() => { loadRegistryBatches(); loadAuditLogs(); }, [refreshKey]);

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
    setBatchResults(Array.from(grouped.entries()).map(([batch_label, counts]) => ({ batch_label, ...counts, total: counts.available + counts.assigned + counts.revoked })));
    setBatchSearching(false);
  };

  const handleSerialSearch = async () => {
    if (!serialSearch.trim()) return;
    setSerialSearching(true);
    setSerialResult(null);
    // Fetch ALL rows for this serial (both pair_index 1 and 2) to get full pair state
    const { data: allRows } = await supabase
      .from("rent_card_serial_stock" as any)
      .select("*")
      .eq("serial_number", serialSearch.trim().toUpperCase())
      .order("pair_index", { ascending: true });

    const rows = (allRows as any[]) || [];
    if (rows.length === 0) {
      toast.error("Serial not found");
      setSerialResult(null);
    } else {
      // Derive aggregate status: if ANY row is assigned, show assigned
      const hasAssigned = rows.some(r => r.status === "assigned");
      const allAvailable = rows.every(r => r.status === "available");
      const aggregateStatus = hasAssigned ? "assigned" : allAvailable ? "available" : rows[0].status;
      setSerialResult({
        ...rows[0],
        status: aggregateStatus,
        pair_count: rows.length,
        all_rows: rows,
      });
    }
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

  const handleAdminAction = async (action: string, targetId: string, password: string, reason: string, _extra?: any) => {
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action, target_id: targetId, reason, password, extra: _extra },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    toast.success("Action completed successfully");
    onStockChanged();
    loadAuditLogs();
    loadRegistryBatches();
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

  return (
    <div className="space-y-6">
      {/* Serial Stock Registry */}
      {isVisible("rent_cards", "stock_correction") && (
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" /> Serial Stock Registry
        </h2>
        <p className="text-sm text-muted-foreground">All uploaded and generated batches. Revoke or void unused serials directly.</p>
        {registryLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading batches...</p>
        ) : registryBatches.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No batches found.</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {registryBatches.map((b) => (
              <div key={b.batch_label} className="border border-border rounded-lg p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-mono font-bold text-sm text-card-foreground">{b.batch_label}</p>
                  <p className="text-xs text-muted-foreground">
                    Total: {b.total} • Available: {b.available} • Assigned: {b.assigned} • Revoked: {b.revoked}
                  </p>
                </div>
                <div className="flex gap-2">
                  {b.available > 0 && (
                    <>
                      <Button variant="destructive" size="sm" onClick={() => setRevokeTarget(b.batch_label)}>
                        Revoke {b.available}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setVoidTarget(b.batch_label)}>
                        <Ban className="h-3 w-3 mr-1" /> Void
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      )}

      {/* Revoke Serial Batch */}
      {isVisible("rent_cards", "batch_revoke") && (
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
    </div>
  );
};

export default AdminActions;

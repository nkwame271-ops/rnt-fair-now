import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Loader2, Search, CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Receipt,
} from "lucide-react";
import { formatGHSDecimal } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { LedgerSyncBadge } from "@/components/regulator/LedgerSyncBadge";

type EscrowRow = {
  id: string;
  reference: string;
  payment_type: string;
  total_amount: number;
  status: string;
  user_id: string;
  created_at: string;
};

const PAID_STATUSES = ["success", "completed", "paid"];

const stageBadge = (state: "ok" | "missing" | "pending") => {
  if (state === "ok") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (state === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
};

const TransactionExplorer = () => {
  const qc = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "pending" | "failed">("all");

  // Type counts
  const { data: typeCounts, isLoading: countsLoading } = useQuery({
    queryKey: ["txn-type-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("escrow_transactions")
        .select("payment_type, status");
      if (error) throw error;
      const map = new Map<string, { total: number; paid: number }>();
      for (const r of data ?? []) {
        const t = (r as any).payment_type ?? "unknown";
        const e = map.get(t) ?? { total: 0, paid: 0 };
        e.total += 1;
        if (PAID_STATUSES.includes((r as any).status)) e.paid += 1;
        map.set(t, e);
      }
      return Array.from(map.entries())
        .map(([type, v]) => ({ type, ...v }))
        .sort((a, b) => b.total - a.total);
    },
  });

  // Transactions for the selected type
  const { data: txns, isLoading: txnsLoading, refetch: refetchTxns } = useQuery({
    queryKey: ["txn-list", selectedType, statusFilter, search],
    enabled: !!selectedType,
    queryFn: async () => {
      let q = supabase
        .from("escrow_transactions")
        .select("id, reference, payment_type, total_amount, status, user_id, created_at")
        .eq("payment_type", selectedType!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter === "paid") q = q.in("status", PAID_STATUSES);
      else if (statusFilter === "pending") q = q.in("status", ["pending", "initiated"]);
      else if (statusFilter === "failed") q = q.in("status", ["failed", "abandoned"]);
      if (search.trim()) q = q.ilike("reference", `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as EscrowRow[];
    },
  });

  return (
    <div className="space-y-3">
    <div className="flex justify-end"><LedgerSyncBadge /></div>
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-3">
      {/* Type list */}
      <Card className="p-2 max-h-[70vh] overflow-y-auto">
        <h3 className="text-xs font-semibold text-muted-foreground px-2 py-1">Transaction Type</h3>
        {countsLoading ? (
          <div className="flex justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : (
          (typeCounts ?? []).map((t) => (
            <button
              key={t.type}
              onClick={() => { setSelectedType(t.type); setSelectedId(null); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between hover:bg-muted ${selectedType === t.type ? "bg-muted font-semibold" : ""}`}
            >
              <span className="capitalize truncate">{t.type.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground ml-1">{t.paid}/{t.total}</span>
            </button>
          ))
        )}
      </Card>

      {/* Transactions list */}
      <Card className="p-3 space-y-2 max-h-[70vh] overflow-hidden flex flex-col">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="h-8 text-sm rounded border border-border bg-background px-2"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="ghost" size="sm" onClick={() => refetchTxns()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="overflow-y-auto flex-1 -mx-1">
          {!selectedType ? (
            <p className="text-sm text-muted-foreground p-4">Select a transaction type to begin.</p>
          ) : txnsLoading ? (
            <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : (txns ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">No transactions match.</p>
          ) : (
            <ul className="space-y-1 px-1">
              {(txns ?? []).map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left p-2 rounded border text-xs hover:bg-muted ${selectedId === t.id ? "border-primary bg-muted" : "border-border"}`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-mono truncate">{t.reference}</span>
                      <span className="font-semibold">{formatGHSDecimal(t.total_amount)}</span>
                    </div>
                    <div className="flex justify-between mt-0.5 text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={`capitalize text-[10px] py-0 ${PAID_STATUSES.includes(t.status) ? "border-emerald-500 text-emerald-700" : "border-amber-500 text-amber-700"}`}
                      >
                        {t.status}
                      </Badge>
                      <span>{new Date(t.created_at).toLocaleDateString()}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Lifecycle panel */}
      <Card className="p-3 max-h-[70vh] overflow-y-auto">
        {selectedId ? (
          <LifecyclePanel
            escrowId={selectedId}
            onRepaired={() => {
              qc.invalidateQueries({ queryKey: ["txn-list"] });
              qc.invalidateQueries({ queryKey: ["txn-type-counts"] });
              qc.invalidateQueries({ queryKey: ["reconcile-gaps"] });
              qc.invalidateQueries({ queryKey: ["receipt-drift"] });
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground p-4">Select a transaction to view its lifecycle.</p>
        )}
      </Card>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────────

const LifecyclePanel = ({ escrowId, onRepaired }: { escrowId: string; onRepaired: () => void }) => {
  const [verifying, setVerifying] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [paystackVerified, setPaystackVerified] = useState<boolean | null>(null);
  const [paystackMessage, setPaystackMessage] = useState<string>("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["txn-lifecycle", escrowId],
    queryFn: async () => {
      const { data: escrow, error } = await supabase
        .from("escrow_transactions")
        .select("id, reference, status, payment_type, total_amount, user_id, created_at, case_id")
        .eq("id", escrowId)
        .maybeSingle();
      if (error) throw error;
      if (!escrow) return null;

      const [{ data: receipt }, { data: splits }, { data: casePayment }] = await Promise.all([
        supabase
          .from("payment_receipts")
          .select("id, receipt_number, created_at")
          .eq("escrow_transaction_id", escrow.id)
          .maybeSingle(),
        supabase
          .from("escrow_splits")
          .select("id, recipient, amount, status")
          .eq("escrow_transaction_id", escrow.id)
          .eq("status", "active"),
        supabase
          .from("case_payments")
          .select("id, payment_status, reconciliation_status, receipt_number, paid_at")
          .eq("payment_reference", (escrow as any).reference)
          .maybeSingle(),
      ]);

      return { escrow, receipt, splits: splits ?? [], casePayment };
    },
  });

  const escrowPaid = data?.escrow && PAID_STATUSES.includes((data.escrow as any).status);
  const receiptMissing = escrowPaid && !data?.receipt;
  const canIssueReceipt = receiptMissing && paystackVerified === true;

  const runPaystackVerify = async () => {
    if (!data?.escrow) return;
    setVerifying(true);
    setPaystackVerified(null);
    setPaystackMessage("");
    try {
      const { data: res, error } = await supabase.functions.invoke("reconcile-payment", {
        body: { action: "dry_run", reference: (data.escrow as any).reference },
      });
      if (error) throw error;
      const verified = !!(res as any)?.verified;
      setPaystackVerified(verified);
      setPaystackMessage((res as any)?.message || "");
      toast({
        title: verified ? "Paystack confirms paid" : "Paystack did not confirm",
        description: verified ? "You can manually issue the receipt." : (res as any)?.message,
        variant: verified ? undefined : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Verify failed", description: e.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const issueReceipt = async () => {
    if (!data?.escrow) return;
    setIssuing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("reconcile-payment", {
        body: {
          action: "reconcile",
          reference: (data.escrow as any).reference,
          notes: "Manual receipt issued from Transaction Explorer (Paystack verified)",
        },
      });
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).error);
      toast({ title: "Receipt issued", description: "Lifecycle is now in sync." });
      await refetch();
      onRepaired();
    } catch (e: any) {
      toast({ title: "Could not issue receipt", description: e.message, variant: "destructive" });
    } finally {
      setIssuing(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  if (!data?.escrow) return <p className="text-sm text-muted-foreground">Not found.</p>;

  const escrow: any = data.escrow;
  const splitsOk = (data.splits?.length ?? 0) > 0;
  const cp = data.casePayment as any;
  const reconciled = cp?.reconciliation_status === "reconciled";

  const stages: Array<{ label: string; state: "ok" | "missing" | "pending"; detail?: string }> = [
    { label: "Transaction created", state: "ok", detail: new Date(escrow.created_at).toLocaleString() },
    {
      label: "Paystack verified",
      state: paystackVerified === true ? "ok" : paystackVerified === false ? "missing" : "pending",
      detail: paystackVerified === null ? "Click Verify with Paystack" : paystackMessage || (paystackVerified ? "Paystack confirms success" : "Paystack rejects this reference"),
    },
    {
      label: "Escrow finalized",
      state: escrowPaid ? "ok" : "missing",
      detail: `status = ${escrow.status}`,
    },
    {
      label: "Receipt issued",
      state: data.receipt ? "ok" : escrowPaid ? "missing" : "pending",
      detail: data.receipt ? `${(data.receipt as any).receipt_number}` : "No payment_receipts row",
    },
    {
      label: "Splits created",
      state: splitsOk ? "ok" : escrowPaid ? "missing" : "pending",
      detail: `${data.splits?.length ?? 0} active split rows`,
    },
    {
      label: "Case payment recorded",
      state: cp?.payment_status === "paid" ? "ok" : escrowPaid ? "missing" : "pending",
      detail: cp ? `${cp.payment_status}` : "No case_payments row",
    },
    {
      label: "Reconciled",
      state: reconciled ? "ok" : escrowPaid ? "missing" : "pending",
      detail: cp?.reconciliation_status || "—",
    },
  ];

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold capitalize">{String(escrow.payment_type).replace(/_/g, " ")}</h3>
          <span className="font-semibold">{formatGHSDecimal(escrow.total_amount)}</span>
        </div>
        <p className="text-xs font-mono text-muted-foreground break-all">{escrow.reference}</p>
      </div>

      <ul className="space-y-1.5">
        {stages.map((s) => (
          <li key={s.label} className="flex items-start gap-2 p-2 rounded border border-border bg-muted/20 text-sm">
            <div className="mt-0.5">{stageBadge(s.state)}</div>
            <div className="flex-1">
              <div className="font-medium">{s.label}</div>
              {s.detail && <div className="text-xs text-muted-foreground">{s.detail}</div>}
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 pt-2 border-t border-border">
        <Button variant="outline" size="sm" className="w-full" onClick={runPaystackVerify} disabled={verifying}>
          {verifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
          Verify with Paystack
        </Button>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button
                  size="sm"
                  className="w-full"
                  disabled={!canIssueReceipt || issuing}
                  onClick={issueReceipt}
                >
                  {issuing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Receipt className="h-4 w-4 mr-1" />}
                  Manually Issue Receipt
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {!receiptMissing
                ? "Receipt already exists for this transaction."
                : paystackVerified !== true
                  ? "Run Verify with Paystack first. Receipts can only be issued for verified payments."
                  : "Re-run the idempotent finalize pipeline to issue the receipt and rebuild splits."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {!escrowPaid && (
          <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-500/10 border border-amber-500/30 rounded p-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
            <span>Transaction is not in a paid state. Manual receipt issuance is disabled for safety.</span>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default TransactionExplorer;

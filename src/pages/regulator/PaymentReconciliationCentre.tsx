import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  ShieldAlert,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Wallet,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import { LedgerSyncBadge } from "@/components/regulator/LedgerSyncBadge";
import { formatGHSDecimal } from "@/lib/formatters";
import UserProofReviewTab from "@/components/regulator/UserProofReviewTab";
import ReceiptDriftTile from "@/components/regulator/ReceiptDriftTile";
import TransactionExplorer from "@/components/regulator/TransactionExplorer";

/**
 * Payment Reconciliation & Recovery Centre
 *
 * - Lists Paystack-completed transactions missing receipts/splits (the "gap").
 * - Lets an authorised admin paste any Paystack reference, verify with Paystack,
 *   choose the handling officer, and trigger the idempotent finalize pipeline.
 * - Shows the audit trail of every reconciliation action.
 */
const PaymentReconciliationCentre = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const qc = useQueryClient();

  const [tab, setTab] = useState("gaps");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [officerId, setOfficerId] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Officers (admin staff who can be marked as handling officer)
  const { data: officers } = useQuery({
    queryKey: ["reconcile-officers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_staff")
        .select("user_id, full_name, admin_type, office_id")
        .order("full_name", { ascending: true });
      return data || [];
    },
    enabled: !!profile?.isMainAdmin || !!profile?.isSuperAdmin,
  });

  // Gap: escrow_transactions completed but no receipt or no splits
  const { data: gaps, isLoading: gapsLoading } = useQuery({
    queryKey: ["reconcile-gaps"],
    queryFn: async () => {
      const { data: completed } = await supabase
        .from("escrow_transactions")
        .select("id, reference, payment_type, total_amount, status, user_id, created_at, office_id")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(500);
      if (!completed || completed.length === 0) return [];

      const ids = completed.map((r) => r.id);
      const refs = completed.map((r) => r.reference).filter(Boolean) as string[];

      const [{ data: receipts }, { data: splits }] = await Promise.all([
        supabase
          .from("payment_receipts")
          .select("escrow_transaction_id, platform_reference, paystack_reference")
          .in("escrow_transaction_id", ids),
        supabase
          .from("escrow_splits")
          .select("escrow_transaction_id, status")
          .in("escrow_transaction_id", ids)
          .eq("status", "active"),
      ]);

      const haveReceipt = new Set(
        (receipts || []).map((r: any) => r.escrow_transaction_id).filter(Boolean)
      );
      const haveSplits = new Set(
        (splits || []).map((s: any) => s.escrow_transaction_id)
      );

      return completed
        .map((c) => {
          const missingReceipt = !haveReceipt.has(c.id);
          const missingSplits = !haveSplits.has(c.id);
          if (!missingReceipt && !missingSplits) return null;
          return { ...c, missingReceipt, missingSplits };
        })
        .filter(Boolean) as any[];
    },
    enabled: !!profile?.isMainAdmin || !!profile?.isSuperAdmin,
  });

  // Audit log
  const { data: auditRows } = useQuery({
    queryKey: ["reconcile-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_reconciliation_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!profile?.isMainAdmin || !!profile?.isSuperAdmin,
  });

  const officerMap = useMemo(() => {
    const m = new Map<string, string>();
    (officers || []).forEach((o: any) => m.set(o.user_id, o.full_name || "Unknown"));
    return m;
  }, [officers]);

  const runVerify = async () => {
    if (!reference.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-payment", {
        body: { action: "dry_run", reference: reference.trim() },
      });
      if (error) throw error;
      setVerifyResult(data);
      if ((data as any)?.verified === false) {
        toast({
          title: "Paystack did not confirm success",
          description: (data as any)?.message || "Reference is not paid.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Verified with Paystack", description: "Review and reconcile below." });
      }
    } catch (e: any) {
      toast({ title: "Verify failed", description: e.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const runReconcile = async () => {
    if (!reference.trim()) return;
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("reconcile-payment", {
        body: {
          action: "reconcile",
          reference: reference.trim(),
          officer_id: officerId || null,
          notes: notes.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Payment reconciled",
        description: "Receipt, splits, ledger and dashboards are now in sync.",
      });
      setReference("");
      setNotes("");
      setOfficerId("");
      setVerifyResult(null);
      qc.invalidateQueries({ queryKey: ["reconcile-gaps"] });
      qc.invalidateQueries({ queryKey: ["reconcile-audit"] });
    } catch (e: any) {
      toast({ title: "Reconcile failed", description: e.message, variant: "destructive" });
    } finally {
      setReconciling(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const allowed = profile?.isMainAdmin || profile?.isSuperAdmin;
  if (!allowed) {
    return (
      <div className="max-w-md mx-auto mt-20 p-8 text-center space-y-3 bg-card border border-border rounded-2xl">
        <ShieldAlert className="h-8 w-8 mx-auto text-destructive" />
        <h2 className="text-lg font-bold">Restricted</h2>
        <p className="text-sm text-muted-foreground">
          The Payment Reconciliation Centre is available to main and super admins.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="h-6 w-6" /> Payment Reconciliation & Recovery
          </h1>
          <p className="text-sm text-muted-foreground">
            Recover Paystack payments that did not finalise, manually reconcile receipts, splits,
            and dashboards. Every action is idempotent and fully audited.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LedgerSyncBadge />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["reconcile-gaps"] });
              qc.invalidateQueries({ queryKey: ["reconcile-audit"] });
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ReceiptDriftTile />

      <Card className="p-4 space-y-3 border-amber-500/40">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Reconcile a Paystack Reference</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 space-y-1">
            <Label>Paystack Reference</Label>
            <Input
              value={reference}
              onChange={(e) => {
                setReference(e.target.value);
                setVerifyResult(null);
              }}
              placeholder="e.g. T123456abc or platform reference"
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label>Handling Officer</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select officer (optional)" />
              </SelectTrigger>
              <SelectContent>
                {(officers || []).map((o: any) => (
                  <SelectItem key={o.user_id} value={o.user_id}>
                    {o.full_name} {o.admin_type ? `· ${o.admin_type}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Reconciliation Notes (audit log)</Label>
          <Textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why is this being manually reconciled?"
          />
        </div>

        {verifyResult && verifyResult.verified && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Paystack confirms success
            </div>
            <p>
              Amount: <strong>{formatGHSDecimal(verifyResult.paystack.amount)}</strong> · Fee:{" "}
              {formatGHSDecimal(verifyResult.paystack.fee)} · Paid:{" "}
              {verifyResult.paystack.paid_at
                ? new Date(verifyResult.paystack.paid_at).toLocaleString()
                : "—"}
            </p>
            <p className="text-xs">
              Escrow row: {verifyResult.escrow ? "✓ found" : "✗ MISSING"} · Receipt:{" "}
              {verifyResult.receipt ? "✓ exists" : "✗ missing"} · Fulfillment:{" "}
              {verifyResult.fulfillment ? "✓ recorded" : "✗ none"}
            </p>
          </div>
        )}

        {verifyResult && verifyResult.verified === false && (
          <div className="bg-destructive/10 border border-destructive/40 rounded-lg p-3 text-sm">
            <div className="flex items-center gap-2 font-semibold text-destructive">
              <AlertTriangle className="h-4 w-4" /> Paystack rejects this reference
            </div>
            <p>{verifyResult.message}</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={runVerify} disabled={verifying || !reference.trim()}>
            {verifying ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
            Verify with Paystack
          </Button>
          <Button
            onClick={runReconcile}
            disabled={reconciling || !reference.trim() || (verifyResult && verifyResult.verified === false)}
          >
            {reconciling ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Reconcile Payment
          </Button>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="transactions">
            <Search className="h-4 w-4 mr-1" /> Transactions
          </TabsTrigger>
          <TabsTrigger value="gaps">
            <AlertTriangle className="h-4 w-4 mr-1" /> Reconciliation Gaps ({gaps?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="user_proofs">
            <FileText className="h-4 w-4 mr-1" /> User-Submitted Proofs
          </TabsTrigger>
          <TabsTrigger value="audit">
            <History className="h-4 w-4 mr-1" /> Audit Trail
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="mt-3">
          <TransactionExplorer />
        </TabsContent>

        <TabsContent value="user_proofs" className="mt-3">
          <UserProofReviewTab />
        </TabsContent>

        <TabsContent value="gaps" className="mt-3">
          <Card className="p-3">
            {gapsLoading ? (
              <div className="p-6 flex justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : gaps && gaps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-2">Reference</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-right py-2 px-2">Amount</th>
                      <th className="text-left py-2 px-2">Gap</th>
                      <th className="text-left py-2 px-2">Created</th>
                      <th className="py-2 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gaps.map((g: any) => (
                      <tr key={g.id} className="border-b border-border/50">
                        <td className="py-2 px-2 font-mono">{g.reference}</td>
                        <td className="py-2 px-2 capitalize">
                          {String(g.payment_type).replace(/_/g, " ")}
                        </td>
                        <td className="py-2 px-2 text-right font-semibold">
                          {formatGHSDecimal(g.total_amount)}
                        </td>
                        <td className="py-2 px-2 space-x-1">
                          {g.missingReceipt && (
                            <Badge variant="destructive">No Receipt</Badge>
                          )}
                          {g.missingSplits && (
                            <Badge className="bg-amber-500/20 text-amber-700">No Splits</Badge>
                          )}
                        </td>
                        <td className="py-2 px-2">{new Date(g.created_at).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReference(g.reference);
                              setVerifyResult(null);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            Load
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                No reconciliation gaps. Every completed payment has receipts and splits.
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-3">
          <Card className="p-3">
            {auditRows && auditRows.length > 0 ? (
              <ul className="space-y-2">
                {auditRows.map((a: any) => (
                  <li
                    key={a.id}
                    className="p-3 rounded-lg border border-border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {a.actor_type}
                        </Badge>
                        <span className="font-semibold">{a.action}</span>
                        {a.actor_id && officerMap.get(a.actor_id) && (
                          <span className="text-muted-foreground">
                            · by {officerMap.get(a.actor_id)}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {a.paystack_reference && (
                        <span className="font-mono">PS: {a.paystack_reference}</span>
                      )}
                      {a.amount && (
                        <span>Amount: <strong>{formatGHSDecimal(a.amount)}</strong></span>
                      )}
                      {a.officer_id && officerMap.get(a.officer_id) && (
                        <span>Officer: {officerMap.get(a.officer_id)}</span>
                      )}
                      {a.new_status && (
                        <span>
                          Status: {a.old_status ? `${a.old_status} → ` : ""}
                          <strong>{a.new_status}</strong>
                        </span>
                      )}
                    </div>
                    {a.notes && (
                      <p className="mt-1 text-muted-foreground">{a.notes}</p>
                    )}
                    {a.failure_reason && (
                      <p className="mt-1 text-destructive">{a.failure_reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-center text-sm text-muted-foreground">
                <FileText className="h-6 w-6 mx-auto mb-2 opacity-50" /> No audit entries yet.
              </p>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentReconciliationCentre;

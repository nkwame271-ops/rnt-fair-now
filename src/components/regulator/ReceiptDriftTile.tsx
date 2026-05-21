import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";

type Drift = {
  missing_receipts: number;
  missing_receipt_numbers: number;
  unreconciled: number;
  open_failures_24h: number;
  checked_at: string;
};

const ReceiptDriftTile = () => {
  const qc = useQueryClient();
  const [repairing, setRepairing] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["receipt-drift"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("detect_receipt_drift");
      if (error) throw error;
      return data as Drift;
    },
    refetchInterval: 60_000,
  });

  const runRepair = async () => {
    setRepairing(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("receipt-drift-monitor");
      if (error) throw error;
      const r: any = res;
      toast({
        title: "Drift monitor finished",
        description: `Repaired ${r.repaired_escrows} escrows · ${r.repaired_case_payments} receipt links · ${r.repaired_reconciliations} reconciliations`,
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["reconcile-gaps"] });
    } catch (e: any) {
      toast({ title: "Repair failed", description: e.message, variant: "destructive" });
    } finally {
      setRepairing(false);
    }
  };

  const totalDrift =
    (data?.missing_receipts ?? 0) +
    (data?.missing_receipt_numbers ?? 0) +
    (data?.unreconciled ?? 0);
  const healthy = !isLoading && totalDrift === 0 && (data?.open_failures_24h ?? 0) === 0;

  return (
    <Card className={`p-4 space-y-3 ${healthy ? "border-emerald-500/40" : "border-destructive/50"}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {healthy ? (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
          <h2 className="font-semibold">
            Receipt & Ledger Drift
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {data?.checked_at ? `checked ${new Date(data.checked_at).toLocaleTimeString()}` : ""}
            </span>
          </h2>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={runRepair} disabled={repairing}>
            {repairing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Repair Now
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Metric label="Paid escrows missing receipts" value={data?.missing_receipts ?? 0} />
          <Metric label="Paid payments missing receipt #" value={data?.missing_receipt_numbers ?? 0} />
          <Metric label="Unreconciled paid payments" value={data?.unreconciled ?? 0} />
          <Metric label="Open failures (24h)" value={data?.open_failures_24h ?? 0} />
        </div>
      )}

      {healthy && (
        <p className="text-xs text-emerald-700">
          Ledger, escrow, and receipts are fully synchronized.
        </p>
      )}
    </Card>
  );
};

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-lg border border-border p-3">
    <div className={`text-2xl font-bold ${value > 0 ? "text-destructive" : "text-emerald-600"}`}>
      {value}
    </div>
    <div className="text-xs text-muted-foreground leading-tight">{label}</div>
  </div>
);

export default ReceiptDriftTile;

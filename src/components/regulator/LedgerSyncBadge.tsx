import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Health {
  in_sync: boolean;
  total_drift: number;
  missing_receipts?: number;
  missing_receipt_numbers?: number;
  unreconciled?: number;
  checked_at?: string;
}

export const LedgerSyncBadge = () => {
  const [h, setH] = useState<Health | null>(null);
  const [repairing, setRepairing] = useState(false);

  const load = async () => {
    try {
      const { data } = await supabase.functions.invoke("ledger-health");
      if (data) setH(data as Health);
    } catch { /* noop */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  const resync = async () => {
    setRepairing(true);
    try {
      await supabase.functions.invoke("receipt-drift-monitor");
      toast.success("Resync triggered");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Resync failed");
    } finally {
      setRepairing(false);
    }
  };

  if (!h) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking ledger…
      </div>
    );
  }

  if (h.in_sync) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
        <CheckCircle2 className="h-3.5 w-3.5" /> Ledger in sync with Paystack
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
      <AlertTriangle className="h-3.5 w-3.5" />
      <span>
        Ledger drift: {h.total_drift}
        {(h.missing_receipts ?? 0) > 0 && ` · ${h.missing_receipts} receipts`}
        {(h.unreconciled ?? 0) > 0 && ` · ${h.unreconciled} unreconciled`}
      </span>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-destructive hover:text-destructive"
        onClick={resync}
        disabled={repairing}
      >
        {repairing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        <span className="ml-1">Resync now</span>
      </Button>
    </div>
  );
};

export default LedgerSyncBadge;

import { useState, useEffect, useMemo } from "react";
import { Loader2, GraduationCap, Wallet, Receipt, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import PageTransition from "@/components/PageTransition";
import AnimatedCounter from "@/components/AnimatedCounter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

interface StudentTxn {
  id: string;
  reference: string;
  payment_type: string;
  total_amount: number;
  status: string;
  payer_user_id: string | null;
  created_at: string;
  metadata: any;
}

interface StudentSplit {
  id: string;
  escrow_transaction_id: string;
  recipient: string;
  amount: number;
  status: string;
  released_at: string | null;
}

const RECIPIENT_LABELS: Record<string, string> = {
  igf: "IGF",
  nugs: "NUGS",
  cm: "CM",
  platform: "Platform",
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  student_registration: "Student Registration",
  student_complaint_fee: "Student Complaint Fee",
  student_safety_report_fee: "Student Safety Report Fee",
};

const StudentRevenue = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const [loading, setLoading] = useState(true);
  const [txns, setTxns] = useState<StudentTxn[]>([]);
  const [splits, setSplits] = useState<StudentSplit[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (profileLoading) return;
    // Student Revenue ledger is reserved for top-tier admins (main + super).
    if (!profile?.isSuperAdmin && !profile?.isMainAdmin) {
      setLoading(false);
      return;
    }
    void load();
  }, [profile, profileLoading]);

  const load = async () => {
    setLoading(true);
    try {
      // Source of truth: unified case_payments tagged as student revenue
      // (student_id IS NOT NULL OR office is NUGS OR payment_type starts with student_).
      const { data: cpRows } = await (supabase.from("case_payments") as any)
        .select("id, escrow_transaction_id, payment_reference, payment_type, amount_paid, payment_status, reconciliation_status, payer_user_id, paid_at, created_at, office_id, student_id, metadata")
        .or("student_id.not.is.null,payment_type.like.student_%,office_id.ilike.nugs%")
        .order("created_at", { ascending: false })
        .limit(500);

      const escrowIds = ((cpRows as any[]) || [])
        .map((r: any) => r.escrow_transaction_id)
        .filter(Boolean);

      // Map case_payments → the legacy StudentTxn shape so the existing UI keeps working
      const mapped: StudentTxn[] = ((cpRows as any[]) || []).map((cp: any) => ({
        id: cp.escrow_transaction_id || cp.id,
        reference: cp.payment_reference,
        payment_type: cp.payment_type,
        total_amount: Number(cp.amount_paid || 0),
        status: cp.payment_status === "paid" ? "completed" : cp.payment_status,
        payer_user_id: cp.payer_user_id || null,
        created_at: cp.paid_at || cp.created_at,
        metadata: cp.metadata || {},
      }));
      setTxns(mapped);

      if (escrowIds.length > 0) {
        const { data: splitData } = await supabase
          .from("escrow_splits")
          .select("id, escrow_transaction_id, recipient, amount, status, released_at")
          .in("escrow_transaction_id", escrowIds);
        setSplits((splitData as any[]) || []);
      } else {
        setSplits([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const isSuperAdmin = !!profile?.isSuperAdmin;
  const visibleRecipients = useMemo<readonly ("igf" | "nugs" | "cm" | "platform")[]>(
    () => (isSuperAdmin ? ["igf", "nugs", "cm", "platform"] : ["igf", "nugs", "cm"]),
    [isSuperAdmin]
  );

  const stats = useMemo(() => {
    const completed = txns.filter(t => t.status === "completed");
    const grossTotal = completed.reduce((s, t) => s + Number(t.total_amount || 0), 0);
    const byRecipient: Record<string, number> = { igf: 0, nugs: 0, cm: 0, platform: 0 };
    splits
      .filter(sp => completed.some(t => t.id === sp.escrow_transaction_id))
      .forEach(sp => {
        byRecipient[sp.recipient] = (byRecipient[sp.recipient] || 0) + Number(sp.amount || 0);
      });
    // Visibility & calculation must match — exclude platform from the total when it's hidden.
    const total = isSuperAdmin
      ? grossTotal
      : Math.max(0, grossTotal - (byRecipient.platform || 0));
    const byType: Record<string, { count: number; total: number }> = {};
    completed.forEach(t => {
      if (!byType[t.payment_type]) byType[t.payment_type] = { count: 0, total: 0 };
      byType[t.payment_type].count += 1;
      byType[t.payment_type].total += Number(t.total_amount || 0);
    });
    return { total, count: completed.length, byRecipient, byType };
  }, [txns, splits, isSuperAdmin]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return txns;
    return txns.filter(t =>
      t.reference?.toLowerCase().includes(q) ||
      t.payment_type?.toLowerCase().includes(q)
    );
  }, [txns, search]);

  const exportCsv = () => {
    const header = ["Reference", "Type", "Amount (GHS)", "Status", "Date"].join(",");
    const rows = filtered.map(t =>
      [t.reference, t.payment_type, Number(t.total_amount).toFixed(2), t.status, format(new Date(t.created_at), "yyyy-MM-dd HH:mm")].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-revenue-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (profileLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile?.isSuperAdmin && !profile?.isMainAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-card rounded-xl border border-border text-center">
        <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Restricted Area</h2>
        <p className="text-sm text-muted-foreground">
          Student Revenue is reserved for Main and Super Admins. Contact a top-tier admin if you need access.
        </p>
      </div>
    );
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-7 w-7 text-primary" /> Student Revenue
            </h1>
            <p className="text-muted-foreground mt-1">
              Isolated student-related financial flows. Visible to Super Admins only.
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border shadow-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Wallet className="h-4 w-4" /> Total Collected
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">
              GHS <AnimatedCounter value={stats.total} />
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stats.count} completed transactions</p>
          </div>
          {visibleRecipients.map(rec => (
            <div key={rec} className="bg-card rounded-xl border border-border shadow-card p-5">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Receipt className="h-4 w-4" /> {RECIPIENT_LABELS[rec]} Share
              </div>
              <p className="text-2xl font-bold text-foreground mt-2">
                GHS <AnimatedCounter value={stats.byRecipient[rec] || 0} />
              </p>
            </div>
          ))}
        </div>

        {/* By type */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-card-foreground">Breakdown by Type</h2>
          </div>
          <div className="divide-y divide-border">
            {Object.entries(stats.byType).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No completed student revenue yet.</p>
            ) : (
              Object.entries(stats.byType).map(([type, v]) => (
                <div key={type} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{PAYMENT_TYPE_LABELS[type] || type}</p>
                    <p className="text-xs text-muted-foreground">{v.count} transactions</p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">GHS {v.total.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
            <h2 className="font-semibold text-card-foreground flex-1">Student Transactions</h2>
            <Input
              placeholder="Search reference or type..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs h-9"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Reference</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-right px-4 py-2">Amount</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No transactions found.</td></tr>
                ) : (
                  filtered.map(t => (
                    <tr key={t.id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-mono text-xs">{t.reference}</td>
                      <td className="px-4 py-2">{PAYMENT_TYPE_LABELS[t.payment_type] || t.payment_type}</td>
                      <td className="px-4 py-2 text-right font-medium">GHS {Number(t.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "outline" : "destructive"} className="text-xs capitalize">
                          {t.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground text-xs">
                        {format(new Date(t.created_at), "MMM d, yyyy HH:mm")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default StudentRevenue;

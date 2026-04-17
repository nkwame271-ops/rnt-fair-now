import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, Search, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LogoLoader from "@/components/LogoLoader";
import PaymentReceipt from "@/components/PaymentReceipt";
import OfficeReconciliationReport from "@/components/OfficeReconciliationReport";
import { useAdminScope } from "@/hooks/useAdminScope";
import { formatGHSDecimal } from "@/lib/formatters";

interface ReceiptRow {
  id: string;
  receipt_number: string;
  created_at: string;
  payer_name: string | null;
  payer_email: string | null;
  payment_type: string;
  total_amount: number;
  status: string;
  description: string | null;
  qr_code_data: string | null;
  office_id: string | null;
  user_id: string;
  escrow_transaction_id: string | null;
  _txn?: any;
  _splits?: { recipient: string; amount: number }[];
  _ticketNumber?: string | null;
  _officeName?: string | null;
  _payerProfile?: { full_name: string; phone: string; email: string } | null;
}

const PAYMENT_TYPES = [
  "all",
  "tenant_registration",
  "landlord_registration",
  "rent_tax",
  "complaint_fee",
  "rent_card",
  "viewing_fee",
  "rent_assessment",
  "renewal_fee",
  "termination_fee",
];

const RegulatorReceipts = () => {
  const { scopeOfficeId, isUnscoped } = useAdminScope();
  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [officeFilter, setOfficeFilter] = useState<string>("all");
  const [allOffices, setAllOffices] = useState<{ id: string; name: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lock office filter when scoped
  useEffect(() => {
    if (!isUnscoped && scopeOfficeId) setOfficeFilter(scopeOfficeId);
  }, [isUnscoped, scopeOfficeId]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("offices").select("id, name").order("name");
      if (data) setAllOffices(data);
    })();
  }, []);

  const fetchReceipts = async () => {
    setLoading(true);

    // Step 1: receipts (with optional office scoping via the txn join below)
    let q = supabase
      .from("payment_receipts")
      .select("id, receipt_number, created_at, payer_name, payer_email, payment_type, total_amount, status, description, qr_code_data, office_id, user_id, escrow_transaction_id")
      .order("created_at", { ascending: false })
      .limit(500);

    if (scopeOfficeId) q = q.eq("office_id", scopeOfficeId);
    const { data: receipts, error } = await q;
    if (error || !receipts) { setRows([]); setLoading(false); return; }

    // Step 2: parallel fetch txns, splits, payer profiles, complaint ticket numbers
    const txnIds = receipts.map(r => r.escrow_transaction_id).filter(Boolean) as string[];
    const userIds = [...new Set(receipts.map(r => r.user_id))];

    const [txnRes, splitRes, profRes] = await Promise.all([
      txnIds.length
        ? supabase.from("escrow_transactions").select("id, paystack_transaction_id, reference, related_complaint_id, office_id").in("id", txnIds)
        : Promise.resolve({ data: [] as any[] }),
      txnIds.length
        ? supabase.from("escrow_splits").select("escrow_transaction_id, recipient, amount, status").in("escrow_transaction_id", txnIds).eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
      userIds.length
        ? supabase.from("profiles").select("user_id, full_name, phone, email").in("user_id", userIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const txnMap = new Map((txnRes.data || []).map((t: any) => [t.id, t]));
    const splitsByTxn = new Map<string, any[]>();
    (splitRes.data || []).forEach((s: any) => {
      const arr = splitsByTxn.get(s.escrow_transaction_id) || [];
      arr.push({ recipient: s.recipient, amount: Number(s.amount) });
      splitsByTxn.set(s.escrow_transaction_id, arr);
    });
    const profMap = new Map((profRes.data || []).map((p: any) => [p.user_id, p]));

    // Complaint ticket numbers (for complaint_fee receipts)
    const complaintIds = (txnRes.data || []).map((t: any) => t.related_complaint_id).filter(Boolean);
    let ticketMap = new Map<string, string>();
    let complaintOfficeMap = new Map<string, string>();
    if (complaintIds.length) {
      const [tCompRes, lCompRes] = await Promise.all([
        supabase.from("complaints").select("id, ticket_number, office_id").in("id", complaintIds),
        supabase.from("landlord_complaints").select("id, ticket_number, office_id").in("id", complaintIds),
      ]);
      [...(tCompRes.data || []), ...(lCompRes.data || [])].forEach((c: any) => {
        if (c.ticket_number) ticketMap.set(c.id, c.ticket_number);
        if (c.office_id) complaintOfficeMap.set(c.id, c.office_id);
      });
    }

    const officeNameMap = new Map(allOffices.map(o => [o.id, o.name]));

    const enriched: ReceiptRow[] = receipts.map((r: any) => {
      const txn = r.escrow_transaction_id ? txnMap.get(r.escrow_transaction_id) : null;
      const officeId = r.office_id || (txn as any)?.office_id || (txn && (txn as any).related_complaint_id ? complaintOfficeMap.get((txn as any).related_complaint_id) : null);
      return {
        ...r,
        _txn: txn,
        _splits: r.escrow_transaction_id ? splitsByTxn.get(r.escrow_transaction_id) || [] : [],
        _ticketNumber: txn && (txn as any).related_complaint_id ? ticketMap.get((txn as any).related_complaint_id) || null : null,
        _officeName: officeId ? officeNameMap.get(officeId) || officeId : null,
        _payerProfile: profMap.get(r.user_id) || null,
      };
    });

    setRows(enriched);
    setLoading(false);
  };

  useEffect(() => { fetchReceipts(); }, [scopeOfficeId, allOffices.length]);

  const filtered = useMemo(() => rows.filter(r => {
    if (typeFilter !== "all" && r.payment_type !== typeFilter) return false;
    if (officeFilter !== "all" && r.office_id !== officeFilter && r._txn?.office_id !== officeFilter) return false;
    if (from && new Date(r.created_at) < new Date(from)) return false;
    if (to && new Date(r.created_at) > new Date(to + "T23:59:59")) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = [
        r.receipt_number,
        r._ticketNumber || "",
        r.payer_name || "",
        r.payer_email || "",
        r._payerProfile?.full_name || "",
        r._payerProfile?.email || "",
        r.payment_type,
      ].join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  }), [rows, typeFilter, officeFilter, from, to, search]);

  const exportCSV = () => {
    const headers = ["Receipt", "Date", "Payer", "Type", "Amount (GHS)", "Office", "Ticket #", "Paystack Ref"];
    const csv = [headers, ...filtered.map(r => [
      r.receipt_number,
      new Date(r.created_at).toLocaleString(),
      r._payerProfile?.full_name || r.payer_name || "",
      r.payment_type,
      r.total_amount,
      r._officeName || "",
      r._ticketNumber || "",
      r._txn?.paystack_transaction_id || r._txn?.reference || "",
    ])].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `receipts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  if (loading) return <LogoLoader message="Loading receipts..." />;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Receipt className="h-7 w-7 text-primary" /> Receipts
          </h1>
          <p className="text-muted-foreground mt-1">
            {filtered.length} receipt{filtered.length === 1 ? "" : "s"}
            {!isUnscoped && " • Scoped to your office"}
          </p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      <OfficeReconciliationReport
        offices={allOffices}
        defaultOfficeId={scopeOfficeId || (allOffices[0]?.id ?? null)}
        isUnscoped={isUnscoped}
      />

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search receipt #, ticket #, payer..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Payment type" /></SelectTrigger>
          <SelectContent>
            {PAYMENT_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t === "all" ? "All Types" : t.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={officeFilter} onValueChange={setOfficeFilter} disabled={!isUnscoped}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Office" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Offices</SelectItem>
            {allOffices.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" placeholder="From" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" placeholder="To" />
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No receipts found</div>
        ) : filtered.map(r => {
          const expanded = expandedId === r.id;
          return (
            <div key={r.id} className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-2 items-center text-sm">
                  <div className="font-mono font-bold text-primary text-xs">{r.receipt_number}</div>
                  <div className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="text-foreground">{r._payerProfile?.full_name || r.payer_name || "—"}</div>
                  <div className="text-muted-foreground capitalize text-xs">{r.payment_type.replace(/_/g, " ")}</div>
                  <div className="text-muted-foreground text-xs">{r._officeName || "—"}</div>
                  <div className="font-bold text-foreground">{formatGHSDecimal(Number(r.total_amount))}</div>
                </div>
                {r._ticketNumber && (
                  <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded mr-2">{r._ticketNumber}</span>
                )}
                {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
              </button>

              {expanded && (
                <div className="border-t border-border p-5 bg-muted/10 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground text-xs">Paystack Reference</div>
                      <div className="font-mono text-xs text-foreground break-all">
                        {r._txn?.paystack_transaction_id || r._txn?.reference || "—"}
                      </div>
                    </div>
                    {r._ticketNumber && (
                      <div>
                        <div className="text-muted-foreground text-xs">Complaint Ticket</div>
                        <div className="font-mono text-xs text-foreground">{r._ticketNumber}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-muted-foreground text-xs">Payer Email</div>
                      <div className="text-foreground">{r._payerProfile?.email || r.payer_email || "—"}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Payer Phone</div>
                      <div className="text-foreground">{r._payerProfile?.phone || "—"}</div>
                    </div>
                  </div>

                  <PaymentReceipt
                    receiptNumber={r.receipt_number}
                    date={r.created_at}
                    payerName={r._payerProfile?.full_name || r.payer_name || "—"}
                    totalAmount={Number(r.total_amount)}
                    paymentType={r.payment_type}
                    description={r.description || r.payment_type.replace(/_/g, " ")}
                    splits={r._splits || []}
                    status={r.status}
                    qrCodeData={r.qr_code_data || r.receipt_number}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegulatorReceipts;

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Wallet, Send, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

interface FundRequest {
  id: string;
  office_id: string;
  requested_by: string;
  amount: number;
  purpose: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  payout_reference: string | null;
  created_at: string;
  requesterName?: string;
  officeName?: string;
}

const OfficeFundRequests = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const isMainAdmin = profile?.isMainAdmin ?? false;
  const officeId = profile?.officeId ?? null;

  const [requests, setRequests] = useState<FundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [balance, setBalance] = useState(0);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const fetchData = async () => {
    if (!user) return;

    // Fetch requests
    const { data: reqs } = await supabase
      .from("office_fund_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Fetch profiles for requester names
    const enriched: FundRequest[] = [];
    for (const r of (reqs || []) as any[]) {
      const { data: prof } = await supabase.from("profiles").select("full_name").eq("user_id", r.requested_by).single();
      const { data: office } = await supabase.from("offices").select("name").eq("id", r.office_id).single();
      enriched.push({
        ...r,
        requesterName: prof?.full_name || "Unknown",
        officeName: office?.name || r.office_id,
      });
    }

    // Filter for sub admins
    if (!isMainAdmin && officeId) {
      setRequests(enriched.filter(r => r.office_id === officeId));
    } else {
      setRequests(enriched);
    }

    // Calculate balance for the relevant office
    const targetOfficeId = isMainAdmin ? null : officeId;
    if (targetOfficeId) {
      await calculateBalance(targetOfficeId);
    }

    setLoading(false);
  };

  const calculateBalance = async (oid: string) => {
    const { data: splits } = await supabase
      .from("escrow_splits")
      .select("amount")
      .eq("office_id", oid)
      .eq("recipient", "admin");

    const totalEarned = (splits || []).reduce((sum, s: any) => sum + Number(s.amount), 0);

    const { data: approved } = await supabase
      .from("office_fund_requests")
      .select("amount")
      .eq("office_id", oid)
      .eq("status", "approved");

    const totalWithdrawn = (approved || []).reduce((sum, r: any) => sum + Number(r.amount), 0);
    setBalance(totalEarned - totalWithdrawn);
  };

  useEffect(() => { fetchData(); }, [user, profile]);

  const handleSubmit = async () => {
    if (!user || !officeId) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    if (amt > balance) { toast.error("Amount exceeds available balance"); return; }
    if (!purpose.trim()) { toast.error("Enter a purpose"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("office_fund_requests").insert({
      office_id: officeId,
      requested_by: user.id,
      amount: amt,
      purpose: purpose.trim(),
    });

    if (error) {
      toast.error("Failed to submit request");
    } else {
      toast.success("Fund request submitted for review");
      setAmount("");
      setPurpose("");
      await fetchData();
    }
    setSubmitting(false);
  };

  const handleReview = async (action: "approve" | "reject") => {
    if (!confirmAction) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("process-office-payout", {
      body: { action, requestId: confirmAction.id, notes: reviewNotes },
    });
    if (error || data?.error) {
      toast.error(data?.error || "Action failed");
    } else {
      toast.success(action === "approve" ? "Request approved & payout initiated" : "Request rejected");
      setReviewingId(null);
      setReviewNotes("");
      setConfirmAction(null);
      await fetchData();
    }
    setSubmitting(false);
  };

  const statusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-600/20 text-green-400 border-green-600/30"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
    if (status === "rejected") return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2"><Wallet className="h-7 w-7" /> Office Fund Requests</h1>
        <p className="text-muted-foreground mt-1">
          {isMainAdmin ? "Review and process office withdrawal requests" : "Submit withdrawal requests from your office escrow balance"}
        </p>
      </div>

      {/* Sub admin: show balance & submit form */}
      {!isMainAdmin && officeId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Office Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-bold text-primary">GH₵ {balance.toFixed(2)}</div>
            <p className="text-sm text-muted-foreground">Available for withdrawal requests</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <label className="text-sm font-medium text-foreground">Amount (GH₵)</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" min="0" step="0.01" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground">Purpose</label>
                <Textarea value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g., Office supplies, inspection travel costs..." rows={2} />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Submit Request
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isMainAdmin ? "All Office Requests" : "Your Requests"}</CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No fund requests yet</p>
          ) : (
            <div className="space-y-3">
              {requests.map(r => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="border border-border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <span className="font-semibold text-foreground">GH₵ {Number(r.amount).toFixed(2)}</span>
                      {isMainAdmin && <span className="ml-2 text-sm text-muted-foreground">— {r.officeName}</span>}
                    </div>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.purpose}</p>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-4">
                    <span>By: {r.requesterName}</span>
                    <span>Date: {new Date(r.created_at).toLocaleDateString()}</span>
                    {r.payout_reference && <span>Ref: {r.payout_reference}</span>}
                    {r.reviewer_notes && <span>Notes: {r.reviewer_notes}</span>}
                  </div>

                  {/* Main admin review actions */}
                  {isMainAdmin && r.status === "pending" && (
                    <div className="pt-2 border-t border-border space-y-2">
                      {reviewingId === r.id ? (
                        <>
                          <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Review notes (optional)" rows={2} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => setConfirmAction({ id: r.id, action: "approve" })} disabled={submitting}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => setConfirmAction({ id: r.id, action: "reject" })} disabled={submitting}>
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setReviewingId(null); setReviewNotes(""); }}>Cancel</Button>
                          </div>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setReviewingId(r.id)}>Review</Button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Password confirm dialog for approvals */}
      {confirmAction && (
        <AdminPasswordConfirm
          open={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleReview(confirmAction.action)}
          actionLabel={confirmAction.action === "approve" ? "Approve Payout" : "Reject Request"}
        />
      )}
    </div>
  );
};

export default OfficeFundRequests;

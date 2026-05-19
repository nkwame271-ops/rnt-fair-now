import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock, MessageSquare, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { formatGHSDecimal } from "@/lib/formatters";

const verdictMeta: Record<string, { label: string; tone: string; icon: any }> = {
  pending: { label: "Awaiting AI", tone: "bg-muted text-muted-foreground", icon: Clock },
  ai_verified_high_confidence: { label: "AI verified ✓", tone: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
  needs_admin_review: { label: "Needs review", tone: "bg-amber-500/15 text-amber-700", icon: AlertCircle },
  ai_rejected_paystack_says_unpaid: { label: "Paystack unpaid", tone: "bg-red-500/15 text-red-700", icon: XCircle },
  ai_rejected_appears_fake: { label: "Looks edited", tone: "bg-red-500/15 text-red-700", icon: XCircle },
};

const REJECT_REASONS = [
  "Paystack says unpaid",
  "Receipt appears edited or fake",
  "Duplicate submission",
  "Wrong service / not on platform",
  "Other",
];

export default function UserProofReviewTab() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"approve" | "reject" | "info" | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["proof-submissions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_proof_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data || [];
    },
    refetchInterval: 30000,
  });

  const openRow = async (r: any) => {
    setSelected(r);
    setReviewMode(null);
    setRejectReason("");
    setReviewNotes("");
    setSignedUrl(null);
    const { data } = await supabase.storage.from("payment-proofs").createSignedUrl(r.proof_file_path, 600);
    setSignedUrl(data?.signedUrl || null);
  };

  const userIds = Array.from(new Set((rows || []).map((r: any) => r.user_id)));
  const { data: profileMap } = useQuery({
    queryKey: ["proof-user-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase.from("profiles").select("user_id, full_name, phone, email").in("user_id", userIds);
      const m: Record<string, any> = {};
      (data || []).forEach((p: any) => { m[p.user_id] = p; });
      return m;
    },
    enabled: userIds.length > 0,
  });

  const submitDecision = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (reviewMode === "approve") {
        // Run idempotent reconcile via existing edge function
        const refForReconcile = selected.claimed_reference || selected.ai_extracted_fields?.reference;
        if (!refForReconcile) throw new Error("No Paystack reference to reconcile. Use 'Request info' to get one.");
        const { data, error } = await supabase.functions.invoke("reconcile-payment", {
          body: { action: "reconcile", reference: refForReconcile, notes: `User proof ${selected.id}. ${reviewNotes}`.trim() },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);

        await supabase.from("payment_proof_submissions").update({
          submission_status: "approved",
          reviewed_at: new Date().toISOString(),
          review_decision: "approved",
          review_notes: reviewNotes,
          resulting_fulfillment_id: (data as any)?.fulfillment_id || null,
        }).eq("id", selected.id);

        await supabase.from("notifications").insert({
          user_id: selected.user_id,
          title: "Payment confirmed",
          body: `Your payment for ${String(selected.service_type).replace(/_/g, " ")} has been credited. Thank you for your patience.`,
          link: "/",
        });
        toast({ title: "Approved & reconciled" });
      } else if (reviewMode === "reject") {
        if (!rejectReason) throw new Error("Choose a rejection reason");
        await supabase.from("payment_proof_submissions").update({
          submission_status: "rejected",
          reviewed_at: new Date().toISOString(),
          review_decision: rejectReason,
          review_notes: reviewNotes,
        }).eq("id", selected.id);
        await supabase.from("notifications").insert({
          user_id: selected.user_id,
          title: "Payment proof not accepted",
          body: `Your submitted receipt was reviewed and could not be approved. Reason: ${rejectReason}.${reviewNotes ? " " + reviewNotes : ""}`,
          link: "/",
        });
        toast({ title: "Rejected" });
      } else if (reviewMode === "info") {
        await supabase.from("payment_proof_submissions").update({
          submission_status: "info_requested",
          reviewed_at: new Date().toISOString(),
          review_decision: "info_requested",
          review_notes: reviewNotes,
        }).eq("id", selected.id);
        await supabase.from("notifications").insert({
          user_id: selected.user_id,
          title: "More info needed for your payment",
          body: reviewNotes || "Please send us your Paystack reference number or a clearer screenshot.",
          link: "/",
        });
        toast({ title: "Info requested" });
      }
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["proof-submissions"] });
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3">
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-3 text-xs">
        AI assists with verification but never approves payments. Every credit on this page is your decision.
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : !rows || rows.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No user-submitted payment proofs yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left py-2 px-2">User</th>
                <th className="text-left py-2 px-2">Service</th>
                <th className="text-right py-2 px-2">Amount</th>
                <th className="text-left py-2 px-2">AI Verdict</th>
                <th className="text-left py-2 px-2">Status</th>
                <th className="text-left py-2 px-2">When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: any) => {
                const vm = verdictMeta[r.ai_verdict] || verdictMeta.pending;
                const Icon = vm.icon;
                const prof = profileMap?.[r.user_id];
                return (
                  <tr key={r.id} className="border-b border-border/50">
                    <td className="py-2 px-2">
                      <div className="font-medium">{prof?.full_name || "Unknown"}</div>
                      <div className="text-muted-foreground">{prof?.phone || prof?.email || ""}</div>
                    </td>
                    <td className="py-2 px-2 capitalize">{String(r.service_type).replace(/_/g, " ")}</td>
                    <td className="py-2 px-2 text-right">{r.claimed_amount ? formatGHSDecimal(r.claimed_amount) : "—"}</td>
                    <td className="py-2 px-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${vm.tone}`}>
                        <Icon className="h-3 w-3" />{vm.label}
                      </span>
                    </td>
                    <td className="py-2 px-2 capitalize">{String(r.submission_status).replace(/_/g, " ")}</td>
                    <td className="py-2 px-2">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="py-2 px-2 text-right">
                      <Button size="sm" variant="outline" onClick={() => openRow(r)}>Review</Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review payment proof</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase">Receipt uploaded</p>
                {signedUrl ? (
                  signedUrl.toLowerCase().includes(".pdf") ? (
                    <a href={signedUrl} target="_blank" rel="noreferrer" className="text-primary underline inline-flex items-center gap-1">
                      Open PDF <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <a href={signedUrl} target="_blank" rel="noreferrer">
                      <img src={signedUrl} alt="proof" className="max-h-72 rounded border" />
                    </a>
                  )
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </div>
              <div className="space-y-2 text-xs">
                <div><span className="text-muted-foreground">Service:</span> {String(selected.service_type).replace(/_/g, " ")}</div>
                <div><span className="text-muted-foreground">User claim:</span> {selected.claimed_amount ? formatGHSDecimal(selected.claimed_amount) : "—"} · ref {selected.claimed_reference || "—"}</div>
                {selected.notes && <div className="italic">"{selected.notes}"</div>}
                <hr />
                <div className="font-semibold">AI verdict</div>
                <div>Verdict: <strong>{String(selected.ai_verdict).replace(/_/g, " ")}</strong> {typeof selected.ai_confidence === "number" && `(${Math.round(selected.ai_confidence * 100)}%)`}</div>
                {selected.ai_reasoning && <div className="text-muted-foreground">{selected.ai_reasoning}</div>}
                {selected.ai_extracted_fields && (
                  <pre className="bg-muted/40 p-2 rounded text-[10px] overflow-x-auto">{JSON.stringify(selected.ai_extracted_fields, null, 2)}</pre>
                )}
                <hr />
                <div className="font-semibold">Paystack cross-check</div>
                <div>Status: <strong>{selected.paystack_lookup_status || "—"}</strong></div>
                {selected.paystack_lookup_response?.data?.amount && (
                  <div>Amount on Paystack: {formatGHSDecimal(selected.paystack_lookup_response.data.amount / 100)}</div>
                )}
              </div>

              <div className="md:col-span-2 space-y-3 border-t pt-3">
                {!reviewMode && (
                  <div className="flex gap-2 flex-wrap">
                    <Button onClick={() => setReviewMode("approve")} className="bg-emerald-600 hover:bg-emerald-700">
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Approve & Reconcile
                    </Button>
                    <Button variant="destructive" onClick={() => setReviewMode("reject")}>
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                    <Button variant="outline" onClick={() => setReviewMode("info")}>
                      <MessageSquare className="h-4 w-4 mr-1" /> Request more info
                    </Button>
                  </div>
                )}

                {reviewMode === "reject" && (
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Select value={rejectReason} onValueChange={setRejectReason}>
                      <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>{REJECT_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}

                {reviewMode && (
                  <div className="space-y-2">
                    <Label>{reviewMode === "info" ? "Message to user" : "Notes"}</Label>
                    <Textarea rows={3} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}
          {reviewMode && (
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReviewMode(null)}>Back</Button>
              <Button onClick={submitDecision} disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Confirm {reviewMode}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

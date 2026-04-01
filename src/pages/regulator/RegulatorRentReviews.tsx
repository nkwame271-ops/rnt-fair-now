import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { TrendingUp, Loader2, CheckCircle2, XCircle, Eye, Trash2 } from "lucide-react";
import LogoLoader from "@/components/LogoLoader";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

const RegulatorRentReviews = () => {
  const { user } = useAuth();
  const { profile } = useAdminProfile();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (password: string, reason: string) => {
    if (!deletingId) return;
    const { data, error } = await supabase.functions.invoke("admin-action", {
      body: { action: "delete_rent_review", target_id: deletingId, reason, password },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    setRequests(prev => prev.filter(r => r.id !== deletingId));
    toast.success("Rent review permanently deleted");
  };

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("rent_increase_requests")
        .select("*")
        .order("created_at", { ascending: false });
      setRequests(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const handleDecision = async (requestId: string, decision: "approved" | "rejected") => {
    if (!user) return;
    setProcessing(true);
    try {
      const req = requests.find(r => r.id === requestId);

      const { error } = await supabase.from("rent_increase_requests").update({
        status: decision,
        reviewer_user_id: user.id,
        reviewer_notes: reviewerNotes,
        reviewed_at: new Date().toISOString(),
      } as any).eq("id", requestId);

      if (error) throw error;

      // If approved, update the unit/property approved rent
      if (decision === "approved" && req) {
        if (req.unit_id) {
          await supabase.from("units").update({ monthly_rent: req.proposed_rent }).eq("id", req.unit_id);
        }
        if (req.property_id) {
          await supabase.from("properties").update({ approved_rent: req.proposed_rent } as any).eq("id", req.property_id);

          // Log event
          await supabase.from("property_events").insert({
            property_id: req.property_id,
            event_type: "rent_update",
            old_value: { rent: req.current_approved_rent },
            new_value: { rent: req.proposed_rent },
            performed_by: user.id,
            reason: `Rent increase ${decision}: ${reviewerNotes || "No notes"}`,
          } as any);
        }
      }

      setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: decision, reviewer_notes: reviewerNotes, reviewed_at: new Date().toISOString() } : r));
      toast.success(`Rent increase request ${decision}`);
      setReviewing(null);
      setReviewerNotes("");
    } catch (err: any) {
      toast.error(err.message || "Failed to process request");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <LogoLoader message="Loading rent reviews..." />;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" /> Rent Increase Reviews
        </h1>
        <p className="text-muted-foreground mt-1">{requests.filter(r => r.status === "pending").length} pending reviews</p>
      </div>

      <div className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current Rent</TableHead>
              <TableHead>Proposed Rent</TableHead>
              <TableHead>Increase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No rent increase requests</TableCell></TableRow>
            ) : (
              requests.map(req => {
                const increase = req.current_approved_rent > 0
                  ? Math.round(((req.proposed_rent - req.current_approved_rent) / req.current_approved_rent) * 100)
                  : 0;
                return (
                  <TableRow key={req.id}>
                    <TableCell className="text-sm">{new Date(req.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm capitalize">{req.request_type?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="font-medium">GH₵ {Number(req.current_approved_rent).toLocaleString()}</TableCell>
                    <TableCell className="font-medium">GH₵ {Number(req.proposed_rent).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-semibold ${increase > 25 ? "text-destructive" : increase > 10 ? "text-warning" : "text-success"}`}>
                        +{increase}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${
                        req.status === "approved" ? "bg-success/10 text-success" :
                        req.status === "rejected" ? "bg-destructive/10 text-destructive" :
                        "bg-warning/10 text-warning"
                      }`}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setReviewing(req); setReviewerNotes(req.reviewer_notes || ""); }}>
                          <Eye className="h-3.5 w-3.5 mr-1" /> Review
                        </Button>
                        {profile?.isMainAdmin && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeletingId(req.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!reviewing} onOpenChange={(open) => { if (!open) setReviewing(null); }}>
        <DialogContent className="max-w-lg">
          {reviewing && (
            <>
              <DialogHeader>
                <DialogTitle>Review Rent Increase Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Request Type:</span> <span className="font-medium capitalize">{reviewing.request_type?.replace(/_/g, " ")}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <span className="font-medium capitalize">{reviewing.status}</span></div>
                  <div><span className="text-muted-foreground">Current Rent:</span> <span className="font-semibold">GH₵ {Number(reviewing.current_approved_rent).toLocaleString()}</span></div>
                  <div><span className="text-muted-foreground">Proposed Rent:</span> <span className="font-semibold">GH₵ {Number(reviewing.proposed_rent).toLocaleString()}</span></div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Landlord's Reason</Label>
                  <p className="text-sm mt-1 bg-muted/50 p-3 rounded-lg">{reviewing.reason || "No reason provided"}</p>
                </div>

                {reviewing.evidence_urls?.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Evidence</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {reviewing.evidence_urls.map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">
                          Evidence {i + 1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {reviewing.status === "pending" && (
                  <>
                    <div className="space-y-2">
                      <Label>Reviewer Notes</Label>
                      <Textarea value={reviewerNotes} onChange={(e) => setReviewerNotes(e.target.value)} placeholder="Add your review notes..." rows={3} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleDecision(reviewing.id, "approved")} disabled={processing} className="flex-1 bg-success hover:bg-success/90 text-success-foreground">
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button onClick={() => handleDecision(reviewing.id, "rejected")} disabled={processing} variant="destructive" className="flex-1">
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </>
                )}

                {reviewing.status !== "pending" && reviewing.reviewer_notes && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Reviewer Notes</Label>
                    <p className="text-sm mt-1 bg-muted/50 p-3 rounded-lg">{reviewing.reviewer_notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AdminPasswordConfirm
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
        title="Delete Rent Review Permanently"
        description="This will permanently delete this rent increase review. This cannot be undone."
        actionLabel="Delete Permanently"
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default RegulatorRentReviews;

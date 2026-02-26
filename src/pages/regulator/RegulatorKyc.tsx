import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Clock, Eye, IdCard, User } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface KycRecord {
  id: string;
  user_id: string;
  ghana_card_number: string;
  ghana_card_front_url: string | null;
  ghana_card_back_url: string | null;
  selfie_url: string | null;
  status: string;
  ai_match_score: number | null;
  ai_match_result: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  profileName?: string;
  profileEmail?: string;
  role?: string;
}

const RegulatorKyc = () => {
  const [records, setRecords] = useState<KycRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("pending");
  const [selectedRecord, setSelectedRecord] = useState<KycRecord | null>(null);
  const [notes, setNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [signedUrls, setSignedUrls] = useState<{ front: string; back: string; selfie: string }>({ front: "", back: "", selfie: "" });
  const [loadingUrls, setLoadingUrls] = useState(false);

  const generateSignedUrls = async (record: KycRecord) => {
    setLoadingUrls(true);
    const urls = { front: "", back: "", selfie: "" };
    const paths = [
      { key: "front" as const, path: record.ghana_card_front_url },
      { key: "back" as const, path: record.ghana_card_back_url },
      { key: "selfie" as const, path: record.selfie_url },
    ];
    await Promise.all(
      paths.map(async ({ key, path }) => {
        if (path) {
          const { data } = await supabase.storage.from("identity-documents").createSignedUrl(path, 600);
          if (data?.signedUrl) urls[key] = data.signedUrl;
        }
      })
    );
    setSignedUrls(urls);
    setLoadingUrls(false);
  };

  const fetchRecords = async () => {
    setLoading(true);
    let query = supabase.from("kyc_verifications").select("*").order("created_at", { ascending: false });
    if (filter !== "all") query = query.eq("status", filter);
    
    const { data } = await query;
    
    if (data && data.length > 0) {
      const userIds = data.map((r: any) => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      
      // Get roles
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").in("user_id", userIds);

      const enriched = data.map((r: any) => {
        const profile = profiles?.find((p: any) => p.user_id === r.user_id);
        const userRole = roles?.find((ro: any) => ro.user_id === r.user_id);
        return {
          ...r,
          profileName: profile?.full_name || "Unknown",
          profileEmail: profile?.email || "",
          role: userRole?.role || "unknown",
        };
      });
      setRecords(enriched as KycRecord[]);
    } else {
      setRecords([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [filter]);

  const handleDecision = async (decision: "verified" | "rejected") => {
    if (!selectedRecord) return;
    setProcessing(true);
    try {
      const { error } = await supabase.from("kyc_verifications").update({
        status: decision,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
      }).eq("id", selectedRecord.id);

      if (error) throw error;
      toast.success(`KYC ${decision === "verified" ? "approved" : "rejected"} successfully`);
      setSelectedRecord(null);
      setNotes("");
      fetchRecords();
    } catch (err: any) {
      toast.error(err.message || "Failed to update KYC status");
    } finally {
      setProcessing(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "verified": return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>;
      case "rejected": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default: return <Badge className="bg-warning text-warning-foreground"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const aiMatchBadge = (result: string | null, score: number | null) => {
    if (!result || result === "pending") return <Badge variant="outline">AI: Pending</Badge>;
    if (result === "match") return <Badge className="bg-success/10 text-success">AI: Match ({score}%)</Badge>;
    if (result === "no_match") return <Badge variant="destructive">AI: No Match ({score}%)</Badge>;
    return <Badge variant="outline">AI: Unclear ({score}%)</Badge>;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">KYC Verification</h1>
        <p className="text-muted-foreground text-sm mt-1">Review Ghana Card verification submissions</p>
      </div>

      <div className="flex gap-2">
        {(["pending", "all", "verified", "rejected"] as const).map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)}>
            {f === "pending" ? "Pending" : f === "all" ? "All" : f === "verified" ? "Verified" : "Rejected"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <IdCard className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>No {filter !== "all" ? filter : ""} KYC submissions found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <Card key={r.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{r.profileName}</p>
                      <p className="text-xs text-muted-foreground">{r.ghana_card_number} · {r.role} · {r.profileEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {aiMatchBadge(r.ai_match_result, r.ai_match_score)}
                    {statusBadge(r.status)}
                    <Button variant="outline" size="sm" onClick={() => { setSelectedRecord(r); setNotes(r.reviewer_notes || ""); generateSignedUrls(r); }}>
                      <Eye className="h-4 w-4 mr-1" /> Review
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review KYC — {selectedRecord?.profileName}</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Ghana Card:</span> <span className="font-semibold">{selectedRecord.ghana_card_number}</span></div>
                <div><span className="text-muted-foreground">Role:</span> <span className="font-semibold capitalize">{selectedRecord.role}</span></div>
                <div><span className="text-muted-foreground">Submitted:</span> <span className="font-semibold">{new Date(selectedRecord.created_at).toLocaleDateString()}</span></div>
              </div>

              <div className="flex items-center gap-2">
                {aiMatchBadge(selectedRecord.ai_match_result, selectedRecord.ai_match_score)}
                {statusBadge(selectedRecord.status)}
              </div>

              {loadingUrls ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">Ghana Card Front</p>
                    {signedUrls.front ? (
                      <img src={signedUrls.front} alt="Front" className="rounded-lg border border-border w-full h-40 object-cover" />
                    ) : <div className="bg-muted rounded-lg h-40 flex items-center justify-center text-xs text-muted-foreground">Not uploaded</div>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">Ghana Card Back</p>
                    {signedUrls.back ? (
                      <img src={signedUrls.back} alt="Back" className="rounded-lg border border-border w-full h-40 object-cover" />
                    ) : <div className="bg-muted rounded-lg h-40 flex items-center justify-center text-xs text-muted-foreground">Not uploaded</div>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">Live Selfie</p>
                    {signedUrls.selfie ? (
                      <img src={signedUrls.selfie} alt="Selfie" className="rounded-lg border border-border w-full h-40 object-cover" />
                    ) : <div className="bg-muted rounded-lg h-40 flex items-center justify-center text-xs text-muted-foreground">Not captured</div>}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Reviewer Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add notes (required for rejection)..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleDecision("rejected")} disabled={processing || !notes}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
              Reject
            </Button>
            <Button onClick={() => handleDecision("verified")} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RegulatorKyc;

import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function ApiAccessRequests() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["regulator-access-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_access_requests" as any)
        .select("*, developer_organizations!inner(name, contact_email, contact_phone)")
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const decide = async (id: string, action: "approved" | "denied" | "changes_requested") => {
    setBusy(id);
    try {
      // For approval, we record the decision. Live-key issuance is handled by the regulator
      // through the existing AgencyApiKeys "Issue key" flow, with the org_id pre-filled.
      const { error } = await supabase.from("api_access_requests" as any)
        .update({
          status: action,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_notes: notes[id] ?? null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(`Request ${action}`);
      qc.invalidateQueries({ queryKey: ["regulator-access-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(""); }
  };

  return (
    <div className="space-y-4">
      <Helmet><title>API Access Requests</title></Helmet>
      <div>
        <h1 className="text-2xl font-semibold">API Access Requests</h1>
        <p className="text-sm text-muted-foreground">Developer requests for live API access.</p>
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No requests.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r: any) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>{r.developer_organizations?.name}</span>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "denied" ? "destructive" : "secondary"}>{r.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p><strong>Contact:</strong> {r.contact_email ?? r.developer_organizations?.contact_email} · {r.contact_phone ?? r.developer_organizations?.contact_phone ?? "—"}</p>
                <p><strong>Type:</strong> {r.agency_type ?? "—"}</p>
                <p><strong>Volume:</strong> {r.intended_volume_monthly?.toLocaleString() ?? "—"} calls/mo</p>
                <p><strong>Scopes:</strong> {(r.requested_scopes ?? []).join(", ")}</p>
                <p><strong>Justification:</strong> {r.justification}</p>
                <p className="text-xs text-muted-foreground">Submitted {new Date(r.created_at).toLocaleString()}</p>
                {r.status === "pending" && (
                  <div className="pt-2 space-y-2">
                    <Textarea
                      placeholder="Review notes (optional)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r.id, "approved")} disabled={busy === r.id}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => decide(r.id, "changes_requested")} disabled={busy === r.id}>
                        Request changes
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(r.id, "denied")} disabled={busy === r.id}>
                        <XCircle className="h-4 w-4 mr-1" />Deny
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After approving, go to <a href="/regulator/agency-api" className="text-primary underline">Agency API → Keys</a> and issue a live key for this organization.
                    </p>
                  </div>
                )}
                {r.status !== "pending" && r.review_notes && (
                  <p className="text-xs"><strong>Review notes:</strong> {r.review_notes}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

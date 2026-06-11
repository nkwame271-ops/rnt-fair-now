import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Loader2, CheckCircle2, XCircle, KeyRound, Inbox } from "lucide-react";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, any> = {
  pending: "secondary", approved: "default", denied: "destructive",
  changes_requested: "outline", cancelled: "outline",
};

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
        .select("*, developer_organizations!inner(name, contact_email, contact_phone, agency_type)")
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const pending = rows.filter((r: any) => r.status === "pending");
  const decided = rows.filter((r: any) => r.status !== "pending");

  const decide = async (
    r: any,
    action: "approved" | "denied" | "changes_requested",
  ) => {
    const note = notes[r.id] ?? "";
    if ((action === "denied" || action === "changes_requested") && note.trim().length < 5) {
      return toast.error("Please add review notes explaining your decision.");
    }
    setBusy(r.id);
    try {
      const { error } = await supabase.from("api_access_requests" as any)
        .update({
          status: action,
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          review_notes: note || null,
        })
        .eq("id", r.id);
      if (error) throw error;

      // Audit log (best-effort; regulator role can insert per policy)
      await supabase.from("admin_audit_log" as any).insert({
        admin_user_id: user?.id ?? null,
        action: `api_access_request_${action}`,
        target_type: "api_access_request",
        target_id: r.id,
        reason: note || `Decision: ${action}`,
        new_state: { status: action, org_id: r.org_id, scopes: r.requested_scopes },
      });

      // Note: in-app notification + email are dispatched server-side by the
      // agency-api-admin edge function on the next sweep (it watches
      // api_access_requests for status changes where notified_at IS NULL).

      toast.success(`Request ${action.replace("_", " ")}`);
      qc.invalidateQueries({ queryKey: ["regulator-access-requests"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally { setBusy(""); }
  };

  const buildIssueLink = (r: any) => {
    const params = new URLSearchParams({
      issueForOrg: r.org_id,
      agency: r.developer_organizations?.name ?? "",
      scopes: (r.requested_scopes ?? []).join(","),
      email: r.contact_email ?? r.developer_organizations?.contact_email ?? "",
      phone: r.contact_phone ?? r.developer_organizations?.contact_phone ?? "",
    });
    return `/regulator/api-keys?${params.toString()}`;
  };

  const renderRow = (r: any) => (
    <Card key={r.id}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2 text-base">
          <span>{r.developer_organizations?.name}</span>
          <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>{r.status.replace("_", " ")}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p><strong>Contact:</strong> {r.contact_email ?? r.developer_organizations?.contact_email} · {r.contact_phone ?? r.developer_organizations?.contact_phone ?? "—"}</p>
        <p><strong>Type:</strong> {r.agency_type ?? r.developer_organizations?.agency_type ?? "—"}</p>
        <p><strong>Volume:</strong> {r.intended_volume_monthly?.toLocaleString() ?? "—"} calls/mo</p>
        <p><strong>Scopes:</strong> {(r.requested_scopes ?? []).join(", ")}</p>
        <p><strong>Justification:</strong> {r.justification}</p>
        <p className="text-xs text-muted-foreground">Submitted {new Date(r.created_at).toLocaleString()}</p>

        {r.status === "pending" && (
          <div className="pt-2 space-y-2">
            <Textarea
              placeholder="Review notes (required for deny / changes-requested)"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
            />
            <div className="flex flex-wrap gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={busy === r.id}>
                    {busy === r.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Approve
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve access request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This records the decision. To actually start issuing data, click <strong>Issue live key</strong> on the approved row to open the Keys tab with the org's details pre-filled. The developer will be notified by email.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => decide(r, "approved")}>Approve</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" variant="outline" onClick={() => decide(r, "changes_requested")} disabled={busy === r.id}>
                Request changes
              </Button>
              <Button size="sm" variant="destructive" onClick={() => decide(r, "denied")} disabled={busy === r.id}>
                <XCircle className="h-4 w-4 mr-1" />Deny
              </Button>
            </div>
          </div>
        )}

        {r.status === "approved" && (
          <div className="pt-2">
            <Link to={buildIssueLink(r)}>
              <Button size="sm"><KeyRound className="h-4 w-4 mr-1" />Issue live key now</Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-1">
              Opens the Keys tab with the org's name, scopes, and contact info pre-filled.
            </p>
          </div>
        )}

        {r.status !== "pending" && r.review_notes && (
          <p className="text-xs"><strong>Review notes:</strong> {r.review_notes}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Helmet><title>API Access Requests</title></Helmet>
      <div>
        <h1 className="text-2xl font-semibold">API Access Requests</h1>
        <p className="text-sm text-muted-foreground">Developer requests for live API access. Sandbox is auto-issued — only live needs your approval.</p>
      </div>

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <>
          <section>
            <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
              Pending ({pending.length})
            </h2>
            {pending.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Inbox className="h-6 w-6" /> No pending requests.
              </CardContent></Card>
            ) : (
              <div className="space-y-3">{pending.map(renderRow)}</div>
            )}
          </section>

          {decided.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-2">
                History ({decided.length})
              </h2>
              <div className="space-y-3">{decided.map(renderRow)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

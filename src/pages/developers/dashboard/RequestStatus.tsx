import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useDeveloperOrg } from "@/hooks/useDeveloperOrg";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Clock, CheckCircle2, XCircle, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";

const STATUS_CFG: Record<string, { label: string; variant: any; Icon: any; cls: string }> = {
  pending: { label: "Pending review", variant: "secondary", Icon: Clock, cls: "text-amber-700" },
  approved: { label: "Approved", variant: "default", Icon: CheckCircle2, cls: "text-emerald-700" },
  denied: { label: "Denied", variant: "destructive", Icon: XCircle, cls: "text-destructive" },
  changes_requested: { label: "Changes requested", variant: "outline", Icon: AlertCircle, cls: "text-amber-700" },
};

export default function RequestStatus() {
  const qc = useQueryClient();
  const { data: org } = useDeveloperOrg();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["my-access-requests", org?.id],
    enabled: !!org?.id,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_access_requests" as any)
        .select("*")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false });
      return (data as any[]) || [];
    },
  });

  const latest = requests[0];
  const cfg = latest ? STATUS_CFG[latest.status] ?? STATUS_CFG.pending : null;

  const cancel = async (id: string) => {
    if (!confirm("Withdraw this access request?")) return;
    const { error } = await supabase.from("api_access_requests" as any)
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Request withdrawn");
    qc.invalidateQueries({ queryKey: ["my-access-requests"] });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!latest) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Live access request</h1>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">You haven't submitted a live access request yet.</p>
            <Link to="/developers/request-access"><Button>Start a request</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold">Live access request</h1>
        <p className="text-sm text-muted-foreground">We update this page as soon as an admin reviews your request.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {cfg && <cfg.Icon className={`h-5 w-5 ${cfg.cls}`} />}
            Your request is {cfg?.label.toLowerCase()}
          </CardTitle>
          <CardDescription>Submitted {new Date(latest.created_at).toLocaleString()}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={cfg?.variant}>{cfg?.label}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground">Requested scopes</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {(latest.requested_scopes ?? []).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
            </div>
          </div>
          <p><span className="text-muted-foreground">Contact:</span> {latest.contact_email ?? org?.contact_email}</p>
          <p><span className="text-muted-foreground">Agency type:</span> {latest.agency_type ?? "—"}</p>
          <p><span className="text-muted-foreground">Expected volume:</span> {latest.intended_volume_monthly?.toLocaleString() ?? "—"} calls/mo</p>
          {latest.review_notes && (
            <Alert>
              <AlertTitle>Reviewer notes</AlertTitle>
              <AlertDescription>{latest.review_notes}</AlertDescription>
            </Alert>
          )}
          {latest.reviewed_at && (
            <p className="text-xs text-muted-foreground">Reviewed {new Date(latest.reviewed_at).toLocaleString()}</p>
          )}

          {latest.status === "pending" && (
            <Button variant="outline" size="sm" onClick={() => cancel(latest.id)}>
              Withdraw request
            </Button>
          )}
          {latest.status === "changes_requested" && (
            <Link to="/developers/request-access"><Button size="sm">Submit a new request</Button></Link>
          )}
          {latest.status === "approved" && (
            <Link to="/developers/dashboard/keys"><Button size="sm">View your live key</Button></Link>
          )}
          {latest.status === "denied" && (
            <Link to="/developers/dashboard/sandbox"><Button size="sm" variant="outline">Continue with sandbox</Button></Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">What happens next</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="space-y-2 list-decimal pl-5">
            <li><strong>An admin reviews your request</strong> — typically within 1–3 business days.</li>
            <li className="flex items-start gap-1.5"><Mail className="h-4 w-4 mt-0.5 shrink-0" /> <span><strong>You receive an email + in-app notification</strong> the moment a decision is made.</span></li>
            <li><strong>Your live key appears in the Keys tab</strong> if approved. You can start using it immediately.</li>
          </ol>
        </CardContent>
      </Card>

      {requests.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Past requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {requests.slice(1).map((r: any) => (
              <div key={r.id} className="border rounded-md p-2 flex items-center justify-between text-sm">
                <span>{new Date(r.created_at).toLocaleDateString()} — {(r.requested_scopes ?? []).join(", ")}</span>
                <Badge variant={STATUS_CFG[r.status]?.variant ?? "outline"}>{STATUS_CFG[r.status]?.label ?? r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

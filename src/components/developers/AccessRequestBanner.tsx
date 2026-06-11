import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useDeveloperOrg } from "@/hooks/useDeveloperOrg";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Inline banner that shows the latest access-request status on Keys and Overview.
 * Returns null when there's nothing to show.
 */
export default function AccessRequestBanner(): ReactNode {
  const { data: org } = useDeveloperOrg();
  const { data: latest } = useQuery({
    queryKey: ["latest-access-request", org?.id],
    enabled: !!org?.id,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("api_access_requests" as any)
        .select("status, created_at, reviewed_at, review_notes")
        .eq("org_id", org!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any | null;
    },
  });

  if (!latest) return null;

  if (latest.status === "pending") {
    return (
      <Alert className="border-amber-300 bg-amber-50/50">
        <Clock className="h-4 w-4 text-amber-700" />
        <AlertTitle>Live access — pending admin review</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span>Submitted {new Date(latest.created_at).toLocaleDateString()}. We typically review within 1–3 business days.</span>
          <Link to="/developers/dashboard/request-status"><Button variant="outline" size="sm">View status</Button></Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (latest.status === "changes_requested") {
    return (
      <Alert className="border-amber-300 bg-amber-50/50">
        <AlertCircle className="h-4 w-4 text-amber-700" />
        <AlertTitle>Changes requested on your live access request</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
          <span>{latest.review_notes ?? "An admin asked for more information."}</span>
          <Link to="/developers/dashboard/request-status"><Button variant="outline" size="sm">View details</Button></Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (latest.status === "denied") {
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>Live access request denied</AlertTitle>
        <AlertDescription>
          {latest.review_notes ?? "Contact api@rentcontrolghana.com for details."}{" "}
          <Link to="/developers/dashboard/request-status" className="underline">View details</Link>
        </AlertDescription>
      </Alert>
    );
  }
  if (latest.status === "approved") {
    return (
      <Alert className="border-emerald-300 bg-emerald-50/50">
        <CheckCircle2 className="h-4 w-4 text-emerald-700" />
        <AlertTitle>Live access approved</AlertTitle>
        <AlertDescription>Your live key appears in the Keys tab. You can start calling production data.</AlertDescription>
      </Alert>
    );
  }
  return null;
}

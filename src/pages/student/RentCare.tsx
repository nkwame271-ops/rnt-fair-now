import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeeConfig, useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, HandCoins, Plus } from "lucide-react";
import { toast } from "sonner";
import { RENTCARE_PROGRAMME_NAME, RENTCARE_STATUS_LABELS } from "@/lib/rentcare/legalNotice";

interface App {
  id: string;
  reference: string;
  status: string;
  payment_status: string;
  amount_requested: number | null;
  created_at: string;
  submitted_at: string | null;
  umb_account_number: string | null;
}

export default function RentCare() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { amount: feeAmount } = useFeeConfig("rentcare_assistance");
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("rentcare_applications")
      .select("id, reference, status, payment_status, amount_requested, created_at, submitted_at, umb_account_number")
      .eq("applicant_user_id", user.id)
      .order("created_at", { ascending: false });
    setApps((data as App[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (params.get("status") === "success") {
      toast.success("Payment confirmed. Your application has been submitted.");
    }
  }, [params]);

  const startApplication = () => navigate("/nugs/rentcare/new");

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <HandCoins className="h-6 w-6 text-primary" />
            RentCare Assistance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{RENTCARE_PROGRAMME_NAME}</p>
        </div>
        <Button onClick={startApplication}>
          <Plus className="h-4 w-4 mr-1" /> Start New Application
        </Button>
      </div>

      {apps.length === 0 ? (
        <Card>
          <CardHeader><CardTitle>About this programme</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              The {RENTCARE_PROGRAMME_NAME} provides application-based rental support for students in financial need.
              Applications are reviewed by CFLED and NUGS, then forwarded to UMB for disbursement once approved.
            </p>
            <p>
              A non-refundable application processing fee of <strong>GHS {feeAmount.toLocaleString()}</strong> applies.
              Submission does not guarantee approval.
            </p>
            <Button onClick={startApplication} className="mt-2">Start Application</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {apps.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:border-primary" onClick={() => navigate(`/nugs/rentcare/${a.id}`)}>
              <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-mono text-sm">{a.reference}</div>
                  <div className="text-xs text-muted-foreground">
                    Created {new Date(a.created_at).toLocaleDateString()}
                    {a.amount_requested ? ` · Requested GHS ${Number(a.amount_requested).toLocaleString()}` : ""}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">{a.payment_status}</Badge>
                  <Badge>{RENTCARE_STATUS_LABELS[a.status] || a.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

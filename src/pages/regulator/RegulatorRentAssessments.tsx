import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, CheckCircle2, XCircle, Loader2, Clock, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import LogoLoader from "@/components/LogoLoader";

interface RentAssessment {
  id: string;
  tenancy_id: string;
  landlord_user_id: string;
  current_rent: number;
  proposed_rent: number;
  reason: string | null;
  status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  landlordName: string;
  tenantName: string;
  propertyName: string;
  unitName: string;
}

const RegulatorRentAssessments = () => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<RentAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from("rent_assessments")
        .select("*")
        .order("created_at", { ascending: false });

      if (!data) { setLoading(false); return; }

      const results: RentAssessment[] = [];
      for (const a of data as any[]) {
        const { data: tenancy } = await supabase
          .from("tenancies")
          .select("*, unit:units(unit_name, property_id)")
          .eq("id", a.tenancy_id)
          .single();

        let landlordName = "Unknown";
        let tenantName = "Unknown";
        let propertyName = "Property";
        let unitName = "";

        if (tenancy) {
          const [ll, tn, prop] = await Promise.all([
            supabase.from("profiles").select("full_name").eq("user_id", a.landlord_user_id).single(),
            supabase.from("profiles").select("full_name").eq("user_id", (tenancy as any).tenant_user_id).single(),
            supabase.from("properties").select("property_name").eq("id", (tenancy as any).unit?.property_id).single(),
          ]);
          landlordName = ll.data?.full_name || "Unknown";
          tenantName = tn.data?.full_name || "Unknown";
          propertyName = prop.data?.property_name || "Property";
          unitName = (tenancy as any).unit?.unit_name || "";
        }

        results.push({ ...a, landlordName, tenantName, propertyName, unitName });
      }
      setAssessments(results);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleDecision = async (id: string, decision: "approved" | "rejected") => {
    setSubmitting(true);
    const { error } = await supabase
      .from("rent_assessments")
      .update({
        status: decision,
        reviewer_user_id: user?.id,
        reviewer_notes: reviewNotes || null,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      // If approved, update the tenancy agreed_rent
      if (decision === "approved") {
        const assessment = assessments.find((a) => a.id === id);
        if (assessment) {
          await supabase
            .from("tenancies")
            .update({ agreed_rent: assessment.proposed_rent })
            .eq("id", assessment.tenancy_id);
        }
      }
      toast.success(`Rent assessment ${decision}`);
      setAssessments((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, status: decision, reviewer_notes: reviewNotes, reviewed_at: new Date().toISOString() } : a
        )
      );
      setReviewingId(null);
      setReviewNotes("");
    }
    setSubmitting(false);
  };

  if (loading) return <LogoLoader message="Loading rent assessments..." />;

  const pending = assessments.filter((a) => a.status === "pending");
  const reviewed = assessments.filter((a) => a.status !== "pending");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-primary" /> Rent Assessments
        </h1>
        <p className="text-muted-foreground mt-1">
          Review and approve/reject landlord rent increase applications
        </p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
        <Info className="h-4 w-4 text-info shrink-0 mt-0.5" />
        <span>Per the Rent Act 220, landlords must submit rent increase requests for Rent Control assessment before raising rent. Approved increases are automatically applied to the tenancy.</span>
      </div>

      {/* Pending */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" /> Pending Review ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <div className="bg-card rounded-xl p-8 text-center border border-border">
            <p className="text-muted-foreground">No pending rent assessments</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pending.map((a) => (
              <div key={a.id} className="bg-card rounded-xl p-5 border border-border shadow-card space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-card-foreground">{a.propertyName} — {a.unitName}</h3>
                    <p className="text-sm text-muted-foreground">
                      Landlord: {a.landlordName} • Tenant: {a.tenantName}
                    </p>
                  </div>
                  <span className="text-xs bg-warning/10 text-warning px-2.5 py-1 rounded-full font-semibold">Pending</span>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="text-muted-foreground">Current Rent:</span>
                    <span className="ml-2 font-semibold text-card-foreground">GH₵ {a.current_rent.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Proposed Rent:</span>
                    <span className="ml-2 font-semibold text-primary">GH₵ {a.proposed_rent.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Increase:</span>
                    <span className="ml-2 font-semibold text-warning">
                      +{((a.proposed_rent - a.current_rent) / a.current_rent * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                {a.reason && (
                  <div className="text-sm bg-muted/50 rounded-lg p-3">
                    <span className="font-medium text-card-foreground">Reason: </span>
                    <span className="text-muted-foreground">{a.reason}</span>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Submitted: {new Date(a.created_at).toLocaleDateString("en-GB")}
                </div>

                {reviewingId === a.id ? (
                  <div className="space-y-3 border-t border-border pt-3">
                    <Textarea
                      placeholder="Add review notes (optional)..."
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      className="min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleDecision(a.id, "approved")}
                        disabled={submitting}
                        className="bg-success hover:bg-success/90 text-success-foreground"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        {submitting ? "..." : "Approve"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => handleDecision(a.id, "rejected")}
                        disabled={submitting}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        {submitting ? "..." : "Reject"}
                      </Button>
                      <Button variant="ghost" onClick={() => { setReviewingId(null); setReviewNotes(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" onClick={() => setReviewingId(a.id)}>
                    Review Application
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Reviewed ({reviewed.length})</h2>
          <div className="space-y-3">
            {reviewed.map((a) => (
              <div key={a.id} className="bg-card rounded-xl p-4 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-card-foreground">{a.propertyName} — {a.unitName}</span>
                    <span className="text-sm text-muted-foreground ml-2">({a.landlordName})</span>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    a.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>
                    {a.status === "approved" ? "Approved" : "Rejected"}
                  </span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>GH₵ {a.current_rent.toLocaleString()} → GH₵ {a.proposed_rent.toLocaleString()}</span>
                  {a.reviewed_at && <span>Reviewed: {new Date(a.reviewed_at).toLocaleDateString("en-GB")}</span>}
                </div>
                {a.reviewer_notes && (
                  <p className="text-xs text-muted-foreground italic">Notes: {a.reviewer_notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegulatorRentAssessments;

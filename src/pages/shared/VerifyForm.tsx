import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Loader2, FileSignature } from "lucide-react";

const FORM_LABELS: Record<string, string> = {
  form_7: "Form 7 — Complaint",
  form_33: "Form 33 — Summons",
  form_32a: "Form 32A — Order / Decision",
};

export default function VerifyForm() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [caseCtx, setCaseCtx] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!code) { setError("No verification code provided"); setLoading(false); return; }
      const { data, error } = await supabase.functions.invoke("verify-form", {
        body: { code: code.toUpperCase() },
      });
      if (error) {
        // functions.invoke surfaces non-2xx as error; try to surface its body message
        const msg = (error as any)?.context?.error || error.message || "Verification failed";
        setError(msg === "Document not found" ? "Document not found or verification code is invalid" : msg);
        setLoading(false);
        return;
      }
      if (!data?.doc) {
        setError("Document not found or verification code is invalid");
        setLoading(false);
        return;
      }
      setDoc(data.doc);
      if (data.caseCtx) setCaseCtx(data.caseCtx);
      setLoading(false);
    })();
  }, [code]);

  const partiesLine = (() => {
    if (!caseCtx) return null;
    if (caseCtx.table === "landlord_complaints") {
      const complainant = caseCtx.placeholder_landlord_name || "Landlord";
      const respondent = caseCtx.tenant_name || "Tenant";
      return `${complainant} vs ${respondent}`;
    }
    const complainant = caseCtx.placeholder_complainant_name || "Tenant";
    const respondent = caseCtx.landlord_name || "Landlord";
    return `${complainant} vs ${respondent}`;
  })();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-center">
            <FileSignature className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-center">Document Verification</h1>

          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="font-semibold">Verification failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          )}

          {!loading && doc && (
            <>
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="h-10 w-10 text-primary" />
                <p className="font-semibold text-primary">Authentic document</p>
                <p className="text-xs text-muted-foreground text-center">
                  Issued by the Rent Control Department platform.
                </p>
              </div>

              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <Row k="Document" v={FORM_LABELS[doc.form_type] || doc.title || doc.form_type} />
                <Row k="Version" v={`v${doc.version_number}`} />
                <Row k="Status" v={
                  <Badge variant={doc.status === "finalized" ? "default" : "secondary"}>
                    {doc.status}
                  </Badge>
                } />
                <Row k="Generated" v={new Date(doc.generated_at).toLocaleString("en-GB")} />
                {doc.finalized_at && (
                  <Row k="Finalized" v={new Date(doc.finalized_at).toLocaleString("en-GB")} />
                )}
                <Row k="Verification code" v={
                  <span className="font-mono text-xs">{doc.verification_code}</span>
                } />
              </div>

              {caseCtx && (
                <div className="rounded-lg border p-4 space-y-2 text-sm">
                  <p className="font-semibold text-foreground">Case details</p>
                  <Row k="Ticket" v={caseCtx.ticket_number || "—"} />
                  <Row k="Complaint #" v={caseCtx.complaint_code || "—"} />
                  {caseCtx.case_number && <Row k="Case #" v={caseCtx.case_number} />}
                  <Row k="Type" v={(caseCtx.complaint_type || "—").replace(/_/g, " ")} />
                  <Row k="Status" v={
                    <Badge variant="outline" className="capitalize">
                      {(caseCtx.current_stage || caseCtx.status || "—").replace(/_/g, " ")}
                    </Badge>
                  } />
                  <Row k="Parties" v={partiesLine || "—"} />
                  <Row k="Filed" v={caseCtx.created_at ? new Date(caseCtx.created_at).toLocaleDateString("en-GB") : "—"} />
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center">
                If the printed document you hold does not match these details, report it to Rent Control immediately.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium text-right">{v ?? "—"}</span>
    </div>
  );
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Seo from "@/components/Seo";

const AgentApplications = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("agent_applications")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setProcessing(id);
    try {
      const { data, error } = await supabase.functions.invoke("approve-agent-application", {
        body: { application_id: id, decision, reviewer_notes: notes[id] || "" },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(decision === "approved" ? "Agent approved" : "Application rejected");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Action failed");
    } finally {
      setProcessing(null);
    }
  };

  const pending = rows.filter((r) => r.status === "pending");
  const reviewed = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8 p-4 md:p-6">
      <Seo title="Agent Applications | Regulator" description="Review Premium Service Agent applications." canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> Agent Applications
        </h1>
        <p className="text-muted-foreground mt-1">Approve verified applicants to give them Premium Service Agent Portal access.</p>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Loading...</div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Pending ({pending.length})</h2>
            {pending.length === 0 && <p className="text-sm text-muted-foreground">No pending applications.</p>}
            {pending.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border bg-card p-5 space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="w-16 h-16 rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0">
                    {r.professional_photo_url
                      ? <img src={r.professional_photo_url} alt="" className="w-full h-full object-cover" />
                      : <ShieldCheck className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg">{r.full_name}</p>
                    <p className="text-sm text-muted-foreground">{r.email} · {r.phone}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-xs">
                      <div><span className="text-muted-foreground">ID:</span> {r.id_type} · {r.id_number}</div>
                      <div><span className="text-muted-foreground">Region:</span> {r.region}</div>
                      <div><span className="text-muted-foreground">Area:</span> {r.operating_area || "—"}</div>
                      <div><span className="text-muted-foreground">DOB:</span> {r.date_of_birth || "—"}</div>
                      <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {r.residential_address || "—"}</div>
                      <div><span className="text-muted-foreground">Emergency:</span> {r.emergency_contact_name || "—"} {r.emergency_contact_phone ? `(${r.emergency_contact_phone})` : ""}</div>
                    </div>
                    {Array.isArray(r.supporting_documents) && r.supporting_documents.length > 0 && (
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Docs:</span>{" "}
                        {r.supporting_documents.map((d: any, i: number) => (
                          <a key={i} href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mr-2">
                            {d.name || `doc-${i + 1}`} <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <Textarea
                  placeholder="Reviewer notes (shown to applicant on rejection)"
                  value={notes[r.id] || ""}
                  onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                  rows={2}
                />

                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => decide(r.id, "rejected")}
                    disabled={processing === r.id}
                  >
                    {processing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                    Reject
                  </Button>
                  <Button
                    onClick={() => decide(r.id, "approved")}
                    disabled={processing === r.id || !r.applicant_user_id}
                    title={!r.applicant_user_id ? "Applicant has no linked user account — ask them to sign in and re-apply." : undefined}
                  >
                    {processing === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold">Reviewed ({reviewed.length})</h2>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {reviewed.slice(0, 50).map((r) => (
                <div key={r.id} className="p-3 text-sm flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.status} · {new Date(r.reviewed_at || r.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full font-semibold uppercase ${
                    r.status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default AgentApplications;

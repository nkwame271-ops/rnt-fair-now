import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ClipboardList, Search, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, Loader2, Download, User, Image, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const applicationTypes: Record<string, string> = {
  rent_increase: "Rent Increase",
  tenant_ejection: "Tenant Ejection",
  regulatory_request: "Regulatory Request",
  other: "Other",
};

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  under_review: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

const RegulatorApplications = () => {
  const { user } = useAuth();
  const [applications, setApplications] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});

  const fetchApplications = async () => {
    const { data } = await supabase
      .from("landlord_applications")
      .select("*")
      .order("created_at", { ascending: false });

    if (data && data.length > 0) {
      const landlordIds = [...new Set(data.map((a: any) => a.landlord_user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, phone, email")
        .in("user_id", landlordIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      setApplications(data.map((a: any) => ({ ...a, _landlordProfile: profileMap.get(a.landlord_user_id) })));
    } else {
      setApplications([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchApplications(); }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    const notes = reviewNotes[id] || null;
    const { error } = await supabase
      .from("landlord_applications")
      .update({
        status: newStatus,
        reviewer_notes: notes,
        reviewer_user_id: user?.id,
        reviewed_at: new Date().toISOString(),
      } as any)
      .eq("id", id);

    if (error) { toast.error(error.message); return; }
    toast.success(`Application ${newStatus}`);
    fetchApplications();
  };

  const filtered = applications.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return a.subject?.toLowerCase().includes(s) || a._landlordProfile?.full_name?.toLowerCase().includes(s) || a.application_type?.toLowerCase().includes(s);
  });

  const statusCounts = applications.reduce((acc, a) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  const exportCSV = () => {
    const headers = ["Type", "Subject", "Landlord", "Phone", "Status", "Submitted"];
    const rows = filtered.map((a: any) => [
      applicationTypes[a.application_type] || a.application_type, `"${a.subject}"`,
      a._landlordProfile?.full_name || "", a._landlordProfile?.phone || "",
      a.status, new Date(a.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "applications_export.csv"; a.click();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-7 w-7 text-primary" /> Landlord Applications
          </h1>
          <p className="text-muted-foreground mt-1">{filtered.length} applications total</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" /> Export CSV</Button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {["pending", "under_review", "approved", "rejected"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className={`rounded-xl p-3 border text-left transition-all ${statusFilter === s ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card hover:border-primary/40"}`}
          >
            <div className="text-2xl font-bold text-foreground">{statusCounts[s] || 0}</div>
            <div className="text-xs text-muted-foreground capitalize">{s.replace("_", " ")}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by subject, landlord name, type..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl p-12 text-center text-muted-foreground border border-border">No applications found</div>
        ) : filtered.map((a: any) => {
          const isExpanded = expandedId === a.id;
          return (
            <div key={a.id} className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : a.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 items-center">
                  <div>
                    <div className="font-medium text-sm text-foreground">{a.subject}</div>
                    <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-sm text-foreground">{applicationTypes[a.application_type] || a.application_type}</div>
                  <div>
                    <div className="font-medium text-sm text-foreground">{a._landlordProfile?.full_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{a._landlordProfile?.phone}</div>
                  </div>
                  <div>
                    <Badge className={`${statusColors[a.status] || ""} text-xs`}>{a.status.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {a.evidence_urls?.length > 0 && <><Image className="h-3 w-3" />{a.evidence_urls.length}</>}
                    {a.audio_url && <Mic className="h-3 w-3 ml-2" />}
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-muted/10 space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    {/* Application details */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground">Application Details</h3>
                      <div className="text-sm space-y-2">
                        <div><span className="text-muted-foreground">Type:</span> <span className="font-medium">{applicationTypes[a.application_type]}</span></div>
                        <div><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{a.subject}</span></div>
                        <div><span className="text-muted-foreground">Filed:</span> {new Date(a.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">DESCRIPTION</div>
                        <div className="text-sm text-foreground bg-background rounded-lg p-3 border border-border whitespace-pre-wrap">{a.description}</div>
                      </div>
                    </div>

                    {/* Landlord info */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Landlord</h3>
                      <div className="text-sm space-y-2">
                        <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{a._landlordProfile?.full_name || "—"}</span></div>
                        <div><span className="text-muted-foreground">Phone:</span> {a._landlordProfile?.phone || "—"}</div>
                        <div><span className="text-muted-foreground">Email:</span> {a._landlordProfile?.email || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Evidence images */}
                  {a.evidence_urls?.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">EVIDENCE IMAGES</div>
                      <div className="grid grid-cols-3 gap-2">
                        {a.evidence_urls.map((url: string, i: number) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Evidence ${i + 1}`} className="rounded-lg w-full h-32 object-cover border border-border hover:opacity-80 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Audio */}
                  {a.audio_url && (
                    <div>
                      <div className="text-xs font-semibold text-muted-foreground mb-2">VOICE MESSAGE</div>
                      <audio controls src={a.audio_url} className="w-full" />
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Reviewer Notes</label>
                      <Textarea
                        value={reviewNotes[a.id] ?? a.reviewer_notes ?? ""}
                        onChange={(e) => setReviewNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                        placeholder="Add notes about this application..."
                        className="min-h-[60px]"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground gap-1" onClick={() => updateStatus(a.id, "approved")}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => updateStatus(a.id, "rejected")}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => updateStatus(a.id, "under_review")}>
                        <Clock className="h-3.5 w-3.5" /> Mark Under Review
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegulatorApplications;

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Download, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import { RENTCARE_STATUS_LABELS, RENTCARE_PROGRAMME_NAME } from "@/lib/rentcare/legalNotice";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/hooks/useAuth";
import { logRentCareAudit } from "@/lib/rentcare/audit";

const STATUS_OPTIONS = Object.keys(RENTCARE_STATUS_LABELS);

const EXPORT_COLS = [
  "reference", "full_name", "phone", "email", "institution", "student_id_code",
  "provider_name", "amount_requested", "payment_status", "payment_reference",
  "umb_account_name", "umb_account_number", "umb_branch",
  "status", "submitted_at", "created_at",
] as const;

export default function RentCareManagement() {
  const { user } = useAuth();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selected, setSelected] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [working, setWorking] = useState(false);
  const { flags } = useAllFeatureFlags();
  const exportEnabled = flags.find((f) => f.feature_key === "rentcare_admin_export_enabled")?.is_enabled ?? false;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("rentcare_applications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);
    setApps(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openDetail = async (a: any) => {
    setSelected(a);
    setDecisionReason(a.decision_reason || "");
    const [{ data: d }, { data: m }, { data: h }] = await Promise.all([
      supabase.from("rentcare_documents" as any).select("*").eq("application_id", a.id).order("created_at", { ascending: false }),
      supabase.from("rentcare_messages" as any).select("*").eq("application_id", a.id).order("created_at", { ascending: true }),
      supabase.from("rentcare_status_history").select("*").eq("application_id", a.id).order("created_at", { ascending: false }),
    ]);
    setDocs((d as any[]) || []);
    setMessages((m as any[]) || []);
    setHistory((h as any[]) || []);
  };

  const refreshSelected = async () => {
    if (!selected) return;
    const { data } = await supabase.from("rentcare_applications").select("*").eq("id", selected.id).maybeSingle();
    if (data) await openDetail(data);
    load();
  };

  const updateStatus = async (newStatus: string) => {
    if (!selected) return;
    if ((newStatus === "declined" || newStatus === "disbursed") && !decisionReason.trim()) {
      toast.error("Please add a decision reason / disbursement reference first."); return;
    }
    setWorking(true);
    const patch: Record<string, any> = { status: newStatus };
    if (newStatus === "declined" || newStatus === "disbursed") patch.decision_reason = decisionReason.trim();
    if (newStatus === "disbursed") patch.disbursed_at = new Date().toISOString();
    const { data, error } = await supabase.rpc("rentcare_admin_update", {
      p_application_id: selected.id,
      p_expected_version: selected.version,
      p_patch: patch as any,
    });
    setWorking(false);
    if (error) { toast.error(error.message); return; }
    const result = data as any;
    if (result?.ok === false) {
      toast.error("Someone else updated this application. Refreshing.");
      refreshSelected();
      return;
    }
    toast.success("Status updated.");
    refreshSelected();
  };

  const downloadDoc = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("rentcare-docs").createSignedUrl(filePath, 60);
    if (error || !data?.signedUrl) { toast.error("Cannot generate link"); return; }
    const a = document.createElement("a"); a.href = data.signedUrl; a.target = "_blank"; a.download = fileName; a.click();
  };

  const sendMessage = async () => {
    if (!reply.trim() || !selected || !user) return;
    setSending(true);
    const { error } = await supabase.from("rentcare_messages" as any).insert({
      application_id: selected.id, sender_user_id: user.id, sender_role: "admin",
      subject: "Administrator message", body: reply.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    await logRentCareAudit({ application_id: selected.id, event_type: "admin_message_sent" });
    setReply("");
    refreshSelected();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return apps.filter((a) => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (!q) return true;
      return [a.reference, a.full_name, a.phone, a.institution, a.student_id_code]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [apps, search, statusFilter]);

  const rowsForExport = () =>
    filtered.map((a) => Object.fromEntries(EXPORT_COLS.map((c) => [c, a[c] ?? ""])));

  const exportCsv = () => {
    const rows = rowsForExport();
    const lines = [EXPORT_COLS.join(",")];
    rows.forEach((r) => lines.push(EXPORT_COLS.map((c) => JSON.stringify(r[c] ?? "")).join(",")));
    download(new Blob([lines.join("\n")], { type: "text/csv" }), "csv");
    logRentCareAudit({ event_type: "exported", new_value: { format: "csv", rows: rows.length } });
  };

  const exportXlsx = () => {
    const rows = rowsForExport();
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "RentCare");
    XLSX.writeFile(wb, `rentcare_applications_${Date.now()}.xlsx`);
    logRentCareAudit({ event_type: "exported", new_value: { format: "xlsx", rows: rows.length } });
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("RentCare Assistance Applications", 14, 14);
    doc.setFontSize(9);
    doc.text(RENTCARE_PROGRAMME_NAME, 14, 20);
    let y = 28;
    doc.setFontSize(8);
    doc.text("Ref | Applicant | Institution | Requested (GHS) | Payment | Status", 14, y); y += 5;
    filtered.forEach((a) => {
      if (y > 195) { doc.addPage(); y = 14; }
      const line = `${a.reference} | ${a.full_name || "—"} | ${a.institution || "—"} | ${Number(a.amount_requested || 0).toLocaleString()} | ${a.payment_status} | ${RENTCARE_STATUS_LABELS[a.status] || a.status}`;
      doc.text(line.slice(0, 150), 14, y); y += 5;
    });
    doc.save(`rentcare_applications_${Date.now()}.pdf`);
    logRentCareAudit({ event_type: "exported", new_value: { format: "pdf", rows: filtered.length } });
  };

  const download = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = `rentcare_applications_${Date.now()}.${ext}`;
    link.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = apps.filter((a) => a.status === s).length;
    return acc;
  }, {});

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-4">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">RentCare Assistance Management</h1>
          <p className="text-sm text-muted-foreground">{RENTCARE_PROGRAMME_NAME}</p>
        </div>
        {exportEnabled && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" size="sm" onClick={exportXlsx}><Download className="h-4 w-4 mr-1" />Excel</Button>
            <Button variant="outline" size="sm" onClick={exportPdf}><Download className="h-4 w-4 mr-1" />PDF</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {STATUS_OPTIONS.filter((s) => counts[s] > 0).map((s) => (
          <Card key={s} className="cursor-pointer hover:border-primary" onClick={() => setStatusFilter(statusFilter === s ? "" : s)}>
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground">{RENTCARE_STATUS_LABELS[s]}</div>
              <div className="text-xl font-bold">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <Input placeholder="Search reference, name, phone, institution…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        {statusFilter && (
          <Badge variant="outline" className="cursor-pointer" onClick={() => setStatusFilter("")}>
            Status: {RENTCARE_STATUS_LABELS[statusFilter]} ✕
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Applications ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-1">Reference</th><th>Applicant</th><th>Institution</th><th>Requested</th><th>Payment</th><th>Status</th><th>UMB</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2 font-mono text-xs">{a.reference}</td>
                  <td>{a.full_name || "—"}</td>
                  <td>{a.institution || "—"}</td>
                  <td>GHS {Number(a.amount_requested || 0).toLocaleString()}</td>
                  <td><Badge variant="outline">{a.payment_status}</Badge></td>
                  <td><Badge>{RENTCARE_STATUS_LABELS[a.status] || a.status}</Badge></td>
                  <td className="text-xs">{a.umb_account_number ? "✓" : "—"}</td>
                  <td><Button size="sm" variant="outline" onClick={() => openDetail(a)}>Open</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selected && (
        <Card className="border-primary">
          <CardHeader>
            <div className="flex justify-between items-start gap-2 flex-wrap">
              <CardTitle>{selected.reference} — {selected.full_name}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-2">
              <div>Phone: {selected.phone}</div>
              <div>Email: {selected.email}</div>
              <div>Ghana Card: {selected.ghana_card_no}</div>
              <div>Institution: {selected.institution} ({selected.student_id_code})</div>
              <div>Provider: {selected.provider_name}</div>
              <div>Requested: GHS {Number(selected.amount_requested || 0).toLocaleString()}</div>
              <div>Payment ref: {selected.payment_reference || "—"}</div>
              <div>UMB: {selected.umb_account_name || "—"} / {selected.umb_account_number || "—"}</div>
            </div>

            <div>
              <div className="font-medium mb-1">Documents</div>
              {docs.length === 0 && <div className="text-xs text-muted-foreground">None uploaded.</div>}
              {docs.map((d) => (
                <button key={d.id} onClick={() => downloadDoc(d.file_path, d.file_name)} className="text-xs text-primary underline flex items-center gap-1 block">
                  <FileText className="h-3 w-3 inline" /> {d.doc_type} — {d.file_name}
                </button>
              ))}
            </div>

            <div>
              <div className="font-medium mb-1">Decision Reason / Disbursement Reference</div>
              <Textarea rows={2} value={decisionReason} onChange={(e) => setDecisionReason(e.target.value)} placeholder="Required when declining or marking disbursed" />
            </div>

            <div>
              <div className="font-medium mb-1">Update Status</div>
              <div className="flex flex-wrap gap-1">
                {STATUS_OPTIONS.map((s) => (
                  <Button key={s} size="sm" variant={selected.status === s ? "default" : "outline"} disabled={working} onClick={() => updateStatus(s)}>
                    {RENTCARE_STATUS_LABELS[s]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">Messages</div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {messages.length === 0 && <div className="text-xs text-muted-foreground">No messages yet.</div>}
                {messages.map((m) => (
                  <div key={m.id} className={`text-xs p-2 rounded border ${m.sender_role === "student" ? "bg-muted/30" : "bg-primary/5"}`}>
                    <div className="text-muted-foreground flex justify-between"><span>{m.sender_role}</span><span>{new Date(m.created_at).toLocaleString()}</span></div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2">
                <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Message the student…" />
                <Button onClick={sendMessage} disabled={!reply.trim() || sending}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div>
              <div className="font-medium mb-1">Timeline</div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex justify-between text-xs border-b py-1">
                    <span>{RENTCARE_STATUS_LABELS[h.new_status] || h.new_status}</span>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

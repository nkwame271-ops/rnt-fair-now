import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Save, FileText, History, CheckCircle2, Loader2, Download, Sparkles, BookmarkPlus, RefreshCw } from "lucide-react";
import RichTextEditor from "@/components/regulator/RichTextEditor";
import { logComplaintAction } from "@/lib/complaintAudit";
import { notifyComplaintParties } from "@/lib/complaintNotify";
import { applyTemplatePlaceholders, buildComplaintContext } from "@/lib/templatePlaceholders";

const FORM_TYPES = [
  { value: "summons", label: "Summons" },
  { value: "form_33", label: "Form 33 — Notice" },
  { value: "hearing_notice", label: "Hearing Notice" },
  { value: "ruling", label: "Ruling / Decision" },
  { value: "settlement", label: "Settlement Agreement" },
  { value: "adjournment", label: "Adjournment Notice" },
  { value: "general", label: "General Letter" },
];

const TEMPLATES: Record<string, (ctx: any) => string> = {
  summons: (ctx) => `
<h1 style="text-align:center">SUMMONS</h1>
<p style="text-align:center"><strong>Rent Control Department — Republic of Ghana</strong></p>
<hr/>
<p><strong>Case No:</strong> ${ctx.ticket_number || "____________"}</p>
<p><strong>Date:</strong> ${new Date().toLocaleDateString("en-GB")}</p>
<p><strong>To:</strong> ${ctx.respondent_name || "____________"}</p>
<p>You are hereby summoned to appear before the Rent Control Officer at the date, time, and place specified below in respect of a complaint filed against you.</p>
<p><strong>Complaint:</strong> ${ctx.title || ""}</p>
<p><strong>Description:</strong></p>
<blockquote>${ctx.description || ""}</blockquote>
<p>Failure to appear may result in proceedings being conducted in your absence.</p>
<br/><br/>
<p>__________________________<br/>Issuing Officer</p>`,
  form_33: (ctx) => `
<h1 style="text-align:center">FORM 33</h1>
<p style="text-align:center"><strong>Notice of Hearing — Rent Act 220</strong></p>
<hr/>
<p><strong>Case No:</strong> ${ctx.ticket_number || ""}</p>
<p>Take notice that the matter between the parties listed below has been scheduled for hearing.</p>
<table><tbody>
<tr><th>Complainant</th><td>${ctx.complainant_name || ""}</td></tr>
<tr><th>Respondent</th><td>${ctx.respondent_name || ""}</td></tr>
<tr><th>Property</th><td>${ctx.property_address || ""}</td></tr>
</tbody></table>
<p>You are required to attend and present any evidence relevant to your case.</p>`,
  hearing_notice: (ctx) => `<h2>Hearing Notice</h2><p>Case ${ctx.ticket_number || ""} is scheduled for hearing. Please appear at the assigned office on the date and time communicated to you.</p>`,
  ruling: (ctx) => `<h1 style="text-align:center">RULING</h1><p><strong>Case No:</strong> ${ctx.ticket_number || ""}</p><h3>Background</h3><p></p><h3>Findings of Fact</h3><p></p><h3>Determination</h3><p></p><h3>Order</h3><p></p><br/><p>__________________________<br/>Adjudicating Officer</p>`,
  settlement: (ctx) => `<h1 style="text-align:center">SETTLEMENT AGREEMENT</h1><p>This agreement is entered between ${ctx.complainant_name || ""} and ${ctx.respondent_name || ""} under the auspices of the Rent Control Department.</p><h3>Terms</h3><ol><li></li><li></li></ol>`,
  adjournment: (ctx) => `<h2>Notice of Adjournment</h2><p>The hearing in case ${ctx.ticket_number || ""} has been adjourned. A new date will be communicated.</p>`,
  general: () => `<p></p>`,
};

const ComplaintDocumentEditor = () => {
  const { id, docId } = useParams<{ id: string; docId?: string }>();
  const [search] = useSearchParams();
  const formTypeParam = search.get("form_type");
  const navigate = useNavigate();

  const [complaint, setComplaint] = useState<any>(null);
  const [doc, setDoc] = useState<any>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [globalTemplates, setGlobalTemplates] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [formType, setFormType] = useState(formTypeParam || "summons");
  const [html, setHtml] = useState("");
  const [json, setJson] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [finalOpen, setFinalOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [notifyOnFinalize, setNotifyOnFinalize] = useState(true);
  const [templateOriginId, setTemplateOriginId] = useState<string | null>(null);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplMeta, setTplMeta] = useState({ form_name: "", form_number: "", category: "", description: "" });
  const [savingTpl, setSavingTpl] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [cRes, dRes, tRes] = await Promise.all([
        supabase.from("complaints").select("*").eq("id", id).maybeSingle(),
        supabase.from("complaint_documents").select("*").eq("case_id", id).order("generated_at", { ascending: false }),
        supabase.from("form_templates").select("id, form_name, form_number, body_html, category").eq("status", "active").order("form_name"),
      ]);
      setComplaint(cRes.data);
      setVersions(dRes.data || []);
      setGlobalTemplates(tRes.data || []);

      const target = docId
        ? (dRes.data || []).find((d: any) => d.id === docId)
        : null;

      if (target) {
        setDoc(target);
        setFormType(target.form_type);
        setTitle(target.title || "");
        setHtml(target.body_html || "");
        setJson(target.body_json);
        setTemplateOriginId((target as any).template_origin_id || null);
      } else {
        // Fresh draft from built-in template
        const ctx = {
          ticket_number: cRes.data?.ticket_number,
          title: cRes.data?.complaint_title,
          description: cRes.data?.description,
          complainant_name: cRes.data?.placeholder_complainant_name || "",
          respondent_name: cRes.data?.placeholder_respondent_name || cRes.data?.landlord_name || "",
          property_address: cRes.data?.property_address,
        };
        const tpl = TEMPLATES[formType] || TEMPLATES.general;
        setHtml(tpl(ctx));
        setTitle(`${FORM_TYPES.find(f => f.value === formType)?.label || formType} — ${cRes.data?.ticket_number || ""}`);
      }
    })();
    // eslint-disable-next-line
  }, [id, docId]);

  // Apply a global template (from Form Engine) to the current document
  const applyGlobalTemplate = (templateId: string) => {
    const t = globalTemplates.find((x) => x.id === templateId);
    if (!t) return;
    if (html && !confirm(`Replace current content with the "${t.form_name}" template?`)) return;
    const ctx = buildComplaintContext(complaint);
    setHtml(applyTemplatePlaceholders(t.body_html || "", ctx));
    setFormType(t.form_number || `tpl_${t.id.slice(0, 8)}`);
    setTitle(`${t.form_name} — ${complaint?.ticket_number || ""}`);
    setTemplateOriginId(t.id);
    toast({ title: "Template applied", description: t.form_name });
  };

  const saveAsGlobalTemplate = async () => {
    if (!html.trim()) {
      toast({ title: "Nothing to save", description: "Add content first.", variant: "destructive" });
      return;
    }
    if (!tplMeta.form_name.trim()) {
      toast({ title: "Template name required", variant: "destructive" });
      return;
    }
    setSavingTpl(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("form_templates").insert({
        form_name: tplMeta.form_name,
        form_number: tplMeta.form_number || tplMeta.form_name.toLowerCase().replace(/\W+/g, "_"),
        category: tplMeta.category || null,
        description: tplMeta.description || null,
        status: "active",
        body_html: html,
        created_by: u.user?.id,
      } as any).select().single();
      if (error) throw error;
      setGlobalTemplates((arr) => [...arr, data]);
      setTemplateOriginId(data.id);
      toast({ title: "Saved as global template", description: data.form_name });
      setSaveTplOpen(false);
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSavingTpl(false);
    }
  };

  const updateGlobalTemplate = async () => {
    if (!templateOriginId) return;
    setSavingTpl(true);
    try {
      const { error } = await supabase.from("form_templates")
        .update({ body_html: html } as any)
        .eq("id", templateOriginId);
      if (error) throw error;
      toast({ title: "Global template updated" });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSavingTpl(false);
    }
  };


  const finalized = doc?.status === "finalized";

  const nextVersion = useMemo(() => {
    const sameType = versions.filter((v) => v.form_type === formType);
    if (doc) return doc.version_number;
    return (sameType.reduce((m, v) => Math.max(m, v.version_number || 0), 0) || 0) + 1;
  }, [versions, formType, doc]);

  const applyTemplate = () => {
    if (!complaint) return;
    if (!confirm("Replace current content with the template for this form type?")) return;
    const ctx = {
      ticket_number: complaint.ticket_number,
      title: complaint.complaint_title,
      description: complaint.description,
      complainant_name: complaint.placeholder_complainant_name || "",
      respondent_name: complaint.placeholder_respondent_name || complaint.landlord_name || "",
      property_address: complaint.property_address,
    };
    const tpl = TEMPLATES[formType] || TEMPLATES.general;
    setHtml(tpl(ctx));
  };

  const aiPolish = async (mode: "improve" | "formalize" | "summarize") => {
    if (!html) return;
    setAiBusy(true);
    try {
      const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const prompts: Record<string, string> = {
        improve: "Improve grammar, clarity and flow. Preserve all facts, names, dates, and structure. Return ONLY the rewritten text.",
        formalize: "Rewrite in formal legal-administrative tone suitable for a Rent Control Department document. Preserve all facts. Return ONLY the rewritten text.",
        summarize: "Summarize this document into a 4-6 sentence executive summary. Return ONLY the summary text.",
      };
      const { data, error } = await supabase.functions.invoke("legal-assistant", {
        body: { messages: [{ role: "user", content: `${prompts[mode]}\n\n---\n${plain}` }] },
      });
      if (error) throw error;
      const reply = (data?.reply || data?.message || "").toString().trim();
      if (!reply) throw new Error("Empty AI response");
      if (mode === "summarize") {
        setHtml((h) => `<blockquote><strong>Summary:</strong> ${reply}</blockquote>${h}`);
      } else {
        const lines = reply.split(/\n\n+/).map((p: string) => `<p>${p.replace(/\n/g, "<br/>")}</p>`).join("");
        setHtml(lines);
      }
      toast({ title: "AI applied" });
    } catch (e: any) {
      toast({ title: "AI failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const payload: any = {
        case_id: id,
        case_kind: "complaint",
        form_type: formType,
        title,
        body_html: html,
        body_json: json,
        status: "draft",
        edited_by: u.user?.id,
        template_origin_id: templateOriginId,
      };
      let saved;
      if (doc) {
        const { data, error } = await supabase.from("complaint_documents")
          .update(payload).eq("id", doc.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        payload.version_number = nextVersion;
        payload.generated_by = u.user?.id;
        const { data, error } = await supabase.from("complaint_documents")
          .insert(payload).select().single();
        if (error) throw error;
        saved = data;
        navigate(`/regulator/complaints/${id}/documents/${saved.id}`, { replace: true });
      }
      setDoc(saved);
      await logComplaintAction({
        caseId: id, action: "document_saved",
        newValue: { form_type: formType, version: saved.version_number, title },
      });
      toast({ title: "Draft saved", description: `Version ${saved.version_number}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const newVersion = async () => {
    if (!id || !doc) return;
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const maxVer = versions.filter((v) => v.form_type === formType).reduce((m, v) => Math.max(m, v.version_number || 0), 0);
      const { data, error } = await supabase.from("complaint_documents").insert({
        case_id: id, case_kind: "complaint",
        form_type: formType, title, body_html: html, body_json: json,
        status: "draft", version_number: maxVer + 1,
        change_reason: changeReason || null,
        generated_by: u.user?.id, edited_by: u.user?.id,
      }).select().single();
      if (error) throw error;
      setDoc(data);
      const refreshed = await supabase.from("complaint_documents").select("*").eq("case_id", id).order("generated_at", { ascending: false });
      setVersions(refreshed.data || []);
      navigate(`/regulator/complaints/${id}/documents/${data.id}`, { replace: true });
      toast({ title: "New version created", description: `v${data.version_number}` });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!id || !doc) {
      toast({ title: "Save first", description: "Save the draft before finalizing", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("complaint_documents").update({
        status: "finalized",
        finalized_by: u.user?.id,
        finalized_at: new Date().toISOString(),
        change_reason: changeReason || doc.change_reason,
        title, body_html: html, body_json: json,
      }).eq("id", doc.id);
      if (error) throw error;

      await logComplaintAction({
        caseId: id, action: "document_finalized",
        newValue: { form_type: formType, version: doc.version_number, title },
      });

      if (notifyOnFinalize) {
        await notifyComplaintParties({
          event: formType === "summons" ? "summons_generated" : "document_ready",
          data: { ref: complaint.ticket_number || "", form: FORM_TYPES.find(f => f.value === formType)?.label || formType },
          recipients: [
            { userId: complaint.tenant_user_id, phone: complaint.placeholder_complainant_phone },
            { userId: complaint.respondent_user_id, phone: complaint.placeholder_respondent_phone },
          ],
          link: `/regulator/complaints/${id}`,
        });
      }

      toast({ title: "Document finalized" });
      setFinalOpen(false);
      const fresh = await supabase.from("complaint_documents").select("*").eq("id", doc.id).single();
      setDoc(fresh.data);
    } catch (e: any) {
      toast({ title: "Finalize failed", description: e.message || String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const exportHtml = () => {
    const blob = new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}h1,h2{margin-top:1.4em}blockquote{border-left:3px solid #999;padding-left:12px;color:#444}</style></head><body><h1>${title}</h1>${html}</body></html>`], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "document").replace(/\W+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printDoc = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${title}</title><style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;line-height:1.5}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:8px;text-align:left}h1,h2{margin-top:1.4em}blockquote{border-left:3px solid #999;padding-left:12px;color:#444}</style></head><body><h1>${title}</h1>${html}<script>window.onload=()=>setTimeout(()=>window.print(),300)</script></body></html>`);
    w.document.close();
  };

  if (!complaint) {
    return <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="container max-w-7xl py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/regulator/complaints/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to case
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline">{complaint.ticket_number}</Badge>
          {doc && (
            <Badge variant={finalized ? "default" : "secondary"}>
              v{doc.version_number} {finalized ? "· Finalized" : "· Draft"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={exportHtml}><Download className="h-4 w-4 mr-1" /> Export</Button>
          <Button variant="outline" size="sm" onClick={printDoc}><FileText className="h-4 w-4 mr-1" /> Print / PDF</Button>
          {finalized ? (
            <Button size="sm" onClick={newVersion} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <History className="h-4 w-4 mr-1" />}
              New Version
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save Draft
              </Button>
              <Button size="sm" onClick={() => setFinalOpen(true)}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Finalize
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Card>
            <CardContent className="pt-4 grid gap-3 sm:grid-cols-[200px_1fr]">
              <div className="space-y-1">
                <Label>Form Type</Label>
                <Select value={formType} onValueChange={(v) => setFormType(v)} disabled={finalized}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORM_TYPES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Document Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={finalized} />
              </div>
            </CardContent>
          </Card>

          {!finalized && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={applyTemplate}>
                <FileText className="h-4 w-4 mr-1" /> Reset from template
              </Button>
              <Button variant="outline" size="sm" onClick={() => aiPolish("improve")} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                AI: Improve
              </Button>
              <Button variant="outline" size="sm" onClick={() => aiPolish("formalize")} disabled={aiBusy}>
                <Sparkles className="h-4 w-4 mr-1" /> AI: Formalize
              </Button>
              <Button variant="outline" size="sm" onClick={() => aiPolish("summarize")} disabled={aiBusy}>
                <Sparkles className="h-4 w-4 mr-1" /> AI: Add Summary
              </Button>
            </div>
          )}

          <RichTextEditor
            value={html}
            onChange={(h, j) => { setHtml(h); setJson(j); }}
            editable={!finalized}
            placeholder="Compose the document…"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Version History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {versions.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
            {versions.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/regulator/complaints/${id}/documents/${v.id}`)}
                className={`w-full text-left rounded border p-2 hover:bg-accent ${doc?.id === v.id ? "border-primary bg-accent" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{v.title || v.form_type}</span>
                  <Badge variant={v.status === "finalized" ? "default" : "secondary"} className="text-xs">v{v.version_number}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {FORM_TYPES.find(f => f.value === v.form_type)?.label || v.form_type} · {new Date(v.generated_at).toLocaleString()}
                </p>
                {v.change_reason && <p className="text-xs italic text-muted-foreground mt-1">"{v.change_reason}"</p>}
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Finalize Document</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Once finalized, this document is locked. Edits will create a new version.
            </p>
            <div className="space-y-1">
              <Label>Change Reason (optional)</Label>
              <Textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} rows={2} placeholder="What changed in this version?" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={notifyOnFinalize} onChange={(e) => setNotifyOnFinalize(e.target.checked)} />
              Notify parties (SMS + in-app)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalOpen(false)}>Cancel</Button>
            <Button onClick={finalize} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm Finalize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplaintDocumentEditor;

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Save, Download, Paperclip, Eye, Loader2, ArrowLeft } from "lucide-react";
import { buildAutofillContext, resolveAutofill } from "@/lib/formAutofill";
import { generateDynamicFormPdf, FormSchema, FormLayout } from "@/lib/generateDynamicFormPdf";

const FormFill = () => {
  const { id } = useParams();
  const [search] = useSearchParams();
  const complaintId = search.get("complaint");
  const navigate = useNavigate();

  const [tpl, setTpl] = useState<any>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: t, error } = await supabase.from("form_templates").select("*").eq("id", id).single();
      if (error) return toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setTpl(t);

      const ctx = await buildAutofillContext(complaintId);
      const filled: Record<string, any> = {};
      const sections = (t.schema?.sections || []) as any[];
      for (const sec of sections) {
        for (const f of sec.fields || []) {
          if (f.autofill?.source && f.autofill?.path) {
            const v = resolveAutofill(ctx, f.autofill.source, f.autofill.path);
            if (v) filled[f.id] = v;
          }
        }
      }
      setData(filled);
    })();
  }, [id, complaintId]);

  const schema: FormSchema = useMemo(() => tpl?.schema || { sections: [] }, [tpl]);
  const layout: FormLayout = useMemo(() => tpl?.layout || {}, [tpl]);

  const setField = (fid: string, v: any) => setData((d) => ({ ...d, [fid]: v }));

  const saveDraft = async () => {
    if (!tpl) return;
    setBusy(true);
    const payload = { template_id: tpl.id, complaint_id: complaintId, data, status: "draft" };
    const res = submissionId
      ? await supabase.from("form_submissions").update(payload).eq("id", submissionId).select("id").single()
      : await supabase.from("form_submissions").insert(payload).select("id").single();
    setBusy(false);
    if (res.error) return toast({ title: "Save failed", description: res.error.message, variant: "destructive" });
    setSubmissionId(res.data!.id);
    toast({ title: "Draft saved" });
  };

  const buildPdf = () => generateDynamicFormPdf({
    formName: tpl.form_name,
    formNumber: tpl.form_number,
    regulationRef: tpl.regulation_ref,
    schema, layout, data,
  });

  const download = () => {
    const blob = buildPdf();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tpl.form_number || tpl.form_name}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const preview = () => {
    const blob = buildPdf();
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  const generateAndAttach = async () => {
    if (!tpl) return;
    setBusy(true);
    try {
      const blob = buildPdf();
      const path = `${tpl.id}/${Date.now()}-${(tpl.form_number || "form").replace(/\W/g, "_")}.pdf`;
      const { error: upErr } = await supabase.storage.from("form-outputs").upload(path, blob, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      const payload = { template_id: tpl.id, complaint_id: complaintId, data, status: "finalized", pdf_url: path };
      const res = submissionId
        ? await supabase.from("form_submissions").update(payload).eq("id", submissionId).select("id").single()
        : await supabase.from("form_submissions").insert(payload).select("id").single();
      if (res.error) throw res.error;
      setSubmissionId(res.data!.id);

      if (complaintId) {
        const { data: c } = await supabase.from("complaints").select("evidence_urls").eq("id", complaintId).single();
        const urls = [...((c?.evidence_urls as string[]) || []), path];
        await supabase.from("complaints").update({ evidence_urls: urls }).eq("id", complaintId);
      }

      toast({ title: "PDF generated", description: complaintId ? "Attached to complaint." : "Saved." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (!tpl) return <p className="container py-6 text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="container max-w-4xl py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={busy}><Save className="h-4 w-4 mr-1" /> Save Draft</Button>
          <Button variant="outline" size="sm" onClick={preview}><Eye className="h-4 w-4 mr-1" /> Preview</Button>
          <Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
          <Button size="sm" onClick={generateAndAttach} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Paperclip className="h-4 w-4 mr-1" />}
            Generate {complaintId ? "& Attach" : ""}
          </Button>
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">{tpl.form_name}</h1>
        <p className="text-sm text-muted-foreground">{tpl.form_number}{tpl.regulation_ref && ` · ${tpl.regulation_ref}`}</p>
      </div>

      {[...(schema.sections || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((sec) => (
        <Card key={sec.id}>
          <CardHeader><CardTitle className="text-base">{sec.title}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {sec.fields.map((f: any) => {
              const colSpan = ["long_text", "table", "signature", "stamp"].includes(f.type) ? "sm:col-span-2" : "";
              const v = data[f.id] ?? "";
              return (
                <div key={f.id} className={`space-y-1 ${colSpan}`}>
                  <Label>{f.label}{f.required && " *"}</Label>
                  {f.type === "long_text" ? (
                    <Textarea value={v} onChange={(e) => setField(f.id, e.target.value)} rows={3} />
                  ) : f.type === "checkbox" ? (
                    <Checkbox checked={!!v} onCheckedChange={(c) => setField(f.id, !!c)} />
                  ) : f.type === "date" ? (
                    <Input type="date" value={v} onChange={(e) => setField(f.id, e.target.value)} />
                  ) : f.type === "number" ? (
                    <Input type="number" value={v} onChange={(e) => setField(f.id, e.target.value)} />
                  ) : f.type === "signature" || f.type === "stamp" ? (
                    <Input placeholder="(paste a data:image PNG to embed in PDF)" value={v} onChange={(e) => setField(f.id, e.target.value)} />
                  ) : (
                    <Input value={v} onChange={(e) => setField(f.id, e.target.value)} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default FormFill;

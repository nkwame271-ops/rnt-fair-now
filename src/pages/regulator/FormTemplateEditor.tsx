import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Save, ArrowLeft, Trash2, Eye } from "lucide-react";
import RichTextEditor from "@/components/regulator/RichTextEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DOMPurify from "dompurify";

const FormTemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<any>(null);
  const [bodyHtml, setBodyHtml] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("form_templates").select("*").eq("id", id).single();
      if (error) return toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setTpl(data);
      // Backwards-compat: pull body_html from new column, else fall back to legacy schema.body_html if migrated
      const initial = (data as any).body_html
        || (data as any)?.schema?.body_html
        || "";
      setBodyHtml(initial);
    })();
  }, [id]);

  const save = async () => {
    if (!tpl) return;
    setSaving(true);
    const { error } = await supabase.from("form_templates").update({
      form_name: tpl.form_name,
      form_number: tpl.form_number,
      regulation_ref: tpl.regulation_ref,
      department: tpl.department,
      version: tpl.version,
      effective_date: tpl.effective_date,
      status: tpl.status,
      description: tpl.description,
      category: tpl.category,
      body_html: bodyHtml,
    } as any).eq("id", tpl.id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Template saved" });
  };

  const remove = async () => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("form_templates").delete().eq("id", id);
    if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    navigate("/regulator/form-engine");
  };

  if (!tpl) return <p className="container py-6 text-sm text-muted-foreground">Loading…</p>;

  const set = (k: string, v: any) => setTpl({ ...tpl, [k]: v });

  return (
    <div className="container max-w-6xl py-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/regulator/form-engine")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-1" /> Preview
          </Button>
          <Button variant="destructive" size="sm" onClick={remove}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Metadata</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Form Name</Label><Input value={tpl.form_name || ""} onChange={(e) => set("form_name", e.target.value)} /></div>
          <div><Label>Form Number / Code</Label><Input value={tpl.form_number || ""} onChange={(e) => set("form_number", e.target.value)} placeholder="e.g. hearing_notice or FORM-14" /></div>
          <div><Label>Regulation Ref</Label><Input value={tpl.regulation_ref || ""} onChange={(e) => set("regulation_ref", e.target.value)} /></div>
          <div><Label>Category</Label><Input value={tpl.category || ""} onChange={(e) => set("category", e.target.value)} placeholder="Summons, Ruling, Notice…" /></div>
          <div><Label>Version</Label><Input value={tpl.version || ""} onChange={(e) => set("version", e.target.value)} /></div>
          <div><Label>Effective Date</Label><Input type="date" value={tpl.effective_date || ""} onChange={(e) => set("effective_date", e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Description (internal)</Label><Textarea rows={2} value={tpl.description || ""} onChange={(e) => set("description", e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={tpl.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active (available in complaints)</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Document Body</CardTitle>
          <p className="text-xs text-muted-foreground">
            Use the rich editor below. Placeholders like <code>{"{{ticket_number}}"}</code>,{" "}
            <code>{"{{complainant_name}}"}</code>, <code>{"{{respondent_name}}"}</code>,{" "}
            <code>{"{{property_address}}"}</code>, <code>{"{{title}}"}</code>,{" "}
            <code>{"{{description}}"}</code>, <code>{"{{today}}"}</code> are auto-filled when used in a complaint.
          </p>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            value={bodyHtml}
            onChange={(html) => setBodyHtml(html)}
            placeholder="Compose the reusable document template…"
          />
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{tpl.form_name} — Preview</DialogTitle></DialogHeader>
          <div
            className="prose prose-sm max-w-none p-6 border rounded-md bg-background"
            dangerouslySetInnerHTML={{ __html: bodyHtml || "<p class='text-muted-foreground'>Empty template</p>" }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormTemplateEditor;

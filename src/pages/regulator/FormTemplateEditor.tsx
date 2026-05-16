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
import { Save, ArrowLeft, Trash2 } from "lucide-react";

const FormTemplateEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tpl, setTpl] = useState<any>(null);
  const [schemaText, setSchemaText] = useState("");
  const [layoutText, setLayoutText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error } = await supabase.from("form_templates").select("*").eq("id", id).single();
      if (error) return toast({ title: "Load failed", description: error.message, variant: "destructive" });
      setTpl(data);
      setSchemaText(JSON.stringify(data.schema, null, 2));
      setLayoutText(JSON.stringify(data.layout, null, 2));
    })();
  }, [id]);

  const save = async () => {
    if (!tpl) return;
    let schema, layout;
    try { schema = JSON.parse(schemaText); } catch (e: any) { return toast({ title: "Invalid schema JSON", description: e.message, variant: "destructive" }); }
    try { layout = JSON.parse(layoutText); } catch (e: any) { return toast({ title: "Invalid layout JSON", description: e.message, variant: "destructive" }); }
    setSaving(true);
    const { error } = await supabase.from("form_templates").update({
      form_name: tpl.form_name, form_number: tpl.form_number,
      regulation_ref: tpl.regulation_ref, department: tpl.department,
      version: tpl.version, effective_date: tpl.effective_date,
      status: tpl.status, schema, layout,
    }).eq("id", tpl.id);
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved" });
  };

  const remove = async () => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("form_templates").delete().eq("id", id);
    navigate("/regulator/form-engine");
  };

  if (!tpl) return <p className="container py-6 text-sm text-muted-foreground">Loading…</p>;

  const set = (k: string, v: any) => setTpl({ ...tpl, [k]: v });

  return (
    <div className="container max-w-5xl py-6 space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/regulator/form-engine")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>
          <Button onClick={save} disabled={saving}><Save className="h-4 w-4 mr-1" /> Save</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Metadata</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div><Label>Form Name</Label><Input value={tpl.form_name || ""} onChange={(e) => set("form_name", e.target.value)} /></div>
          <div><Label>Form Number</Label><Input value={tpl.form_number || ""} onChange={(e) => set("form_number", e.target.value)} /></div>
          <div><Label>Regulation Ref</Label><Input value={tpl.regulation_ref || ""} onChange={(e) => set("regulation_ref", e.target.value)} /></div>
          <div><Label>Department</Label><Input value={tpl.department || ""} onChange={(e) => set("department", e.target.value)} /></div>
          <div><Label>Version</Label><Input value={tpl.version || ""} onChange={(e) => set("version", e.target.value)} /></div>
          <div><Label>Effective Date</Label><Input type="date" value={tpl.effective_date || ""} onChange={(e) => set("effective_date", e.target.value)} /></div>
          <div>
            <Label>Status</Label>
            <Select value={tpl.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="retired">Retired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schema (sections + fields)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Edit the JSON structure. Field types: text, number, date, dropdown, checkbox, long_text, file, signature, stamp, table, autofill.
            Auto-fill sources: complaint, complainant_profile, respondent_profile, property, tenancy, appointment, office, officer.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea value={schemaText} onChange={(e) => setSchemaText(e.target.value)} rows={20} className="font-mono text-xs" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Layout (PDF rendering)</CardTitle>
          <p className="text-xs text-muted-foreground">page_size, title_position, header, footer, signature_area, stamp_area, include_qr.</p>
        </CardHeader>
        <CardContent>
          <Textarea value={layoutText} onChange={(e) => setLayoutText(e.target.value)} rows={8} className="font-mono text-xs" />
        </CardContent>
      </Card>
    </div>
  );
};

export default FormTemplateEditor;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FileText, Edit, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const FormEngine = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("form_templates").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setTemplates(data || []);
    setLoading(false);
  };

  const createBlank = async () => {
    const { data, error } = await supabase.from("form_templates").insert({
      form_name: "New Form",
      version: "1.0",
      status: "draft",
      schema: { sections: [] },
      layout: { page_size: "A4", title_position: "center" },
    }).select("id").single();
    if (error) return toast({ title: "Create failed", description: error.message, variant: "destructive" });
    navigate(`/regulator/form-engine/${data.id}`);
  };

  const remove = async () => {
    if (!confirmId) return;
    setDeleting(true);
    const { data, error, count } = await supabase
      .from("form_templates")
      .delete({ count: "exact" })
      .eq("id", confirmId)
      .select("id");
    setDeleting(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    if (!data || data.length === 0 || count === 0) {
      toast({
        title: "Not deleted",
        description:
          "You don't have permission to delete this template, or it's still referenced by an existing form submission.",
        variant: "destructive",
      });
      return;
    }
    setTemplates((t) => t.filter((x) => x.id !== confirmId));
    setConfirmId(null);
    toast({ title: "Template deleted" });
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Form Engine</h1>
          <p className="text-sm text-muted-foreground">Reusable Rent Control form templates with auto-fill and PDF generation.</p>
        </div>
        <Button onClick={createBlank}><Plus className="h-4 w-4 mr-2" /> New Template</Button>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{t.form_name}</CardTitle>
                  <Badge variant={t.status === "active" ? "default" : "outline"}>{t.status}</Badge>
                </div>
                {t.form_number && <p className="text-xs text-muted-foreground">{t.form_number}{t.regulation_ref && ` · ${t.regulation_ref}`}</p>}
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link to={`/regulator/form-engine/${t.id}`}><Edit className="h-3 w-3 mr-1" /> Edit</Link></Button>
                <Button asChild size="sm"><Link to={`/regulator/form-engine/${t.id}/fill`}>Fill</Link></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmId(t.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              </CardContent>
            </Card>
          ))}
          {templates.length === 0 && <p className="text-sm text-muted-foreground col-span-full">No templates yet.</p>}
        </div>
      )}

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete form template?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the template. Submissions already generated from it will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FormEngine;

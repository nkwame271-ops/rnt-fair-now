import { useState, useEffect } from "react";
import { FileText, Settings, Info, Loader2, Plus, Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CustomField {
  label: string;
  type: "text" | "number" | "date";
  required: boolean;
}

interface TemplateConfig {
  id: string;
  max_advance_months: number;
  min_lease_duration: number;
  max_lease_duration: number;
  tax_rate: number;
  registration_deadline_days: number;
  terms: string[];
  custom_fields: CustomField[];
}

const SYSTEM_FIELDS = [
  "Registration Code", "Date of Agreement", "Landlord Name", "Tenant Name",
  "Tenant ID", "Property Name", "Property Address", "Unit Name & Type",
  "Region", "Monthly Rent", "Advance Period", "Total Advance Amount",
  "Government Tax", "Amount to Landlord", "Tenancy Start Date",
  "Tenancy End Date", "Landlord Signature", "Tenant Signature",
];

const RegulatorAgreementTemplates = () => {
  const [config, setConfig] = useState<TemplateConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTermIndex, setEditingTermIndex] = useState<number | null>(null);
  const [editingTermValue, setEditingTermValue] = useState("");
  const [newTerm, setNewTerm] = useState("");
  // Custom fields
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<"text" | "number" | "date">("text");
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [editingField, setEditingField] = useState<CustomField>({ label: "", type: "text", required: false });

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("agreement_template_config")
        .select("*")
        .limit(1)
        .single();
      if (data) {
        setConfig({
          ...data,
          custom_fields: (data as any).custom_fields || [],
        } as TemplateConfig);
      }
      if (error) toast.error("Failed to load template config");
      setLoading(false);
    };
    load();
  }, []);

  const updateField = (field: keyof TemplateConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  // Term management
  const startEditTerm = (index: number) => {
    if (!config) return;
    setEditingTermIndex(index);
    setEditingTermValue(config.terms[index]);
  };
  const saveEditTerm = () => {
    if (!config || editingTermIndex === null) return;
    const updated = [...config.terms];
    updated[editingTermIndex] = editingTermValue;
    setConfig({ ...config, terms: updated });
    setEditingTermIndex(null);
  };
  const removeTerm = (index: number) => {
    if (!config) return;
    setConfig({ ...config, terms: config.terms.filter((_, i) => i !== index) });
  };
  const addTerm = () => {
    if (!config || !newTerm.trim()) return;
    setConfig({ ...config, terms: [...config.terms, newTerm.trim()] });
    setNewTerm("");
  };

  // Custom field management
  const addCustomField = () => {
    if (!config || !newFieldLabel.trim()) return;
    setConfig({ ...config, custom_fields: [...config.custom_fields, { label: newFieldLabel.trim(), type: newFieldType, required: newFieldRequired }] });
    setNewFieldLabel("");
    setNewFieldType("text");
    setNewFieldRequired(false);
  };
  const removeCustomField = (index: number) => {
    if (!config) return;
    setConfig({ ...config, custom_fields: config.custom_fields.filter((_, i) => i !== index) });
  };
  const startEditField = (index: number) => {
    if (!config) return;
    setEditingFieldIndex(index);
    setEditingField({ ...config.custom_fields[index] });
  };
  const saveEditField = () => {
    if (!config || editingFieldIndex === null) return;
    const updated = [...config.custom_fields];
    updated[editingFieldIndex] = editingField;
    setConfig({ ...config, custom_fields: updated });
    setEditingFieldIndex(null);
  };
  const moveField = (index: number, direction: -1 | 1) => {
    if (!config) return;
    const newIdx = index + direction;
    if (newIdx < 0 || newIdx >= config.custom_fields.length) return;
    const updated = [...config.custom_fields];
    [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
    setConfig({ ...config, custom_fields: updated });
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("agreement_template_config")
      .update({
        max_advance_months: config.max_advance_months,
        min_lease_duration: config.min_lease_duration,
        max_lease_duration: config.max_lease_duration,
        tax_rate: config.tax_rate,
        registration_deadline_days: config.registration_deadline_days,
        terms: config.terms,
        custom_fields: config.custom_fields as any,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", config.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Template configuration saved. Changes will apply to all new agreements.");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!config) return <div className="text-center py-20 text-muted-foreground">No template configuration found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7 text-primary" /> Agreement Template Configuration
        </h1>
        <p className="text-muted-foreground mt-1">Configure the standardized tenancy agreement. Changes here apply to all new agreements generated by landlords.</p>
      </div>

      {/* Statutory Limits */}
      <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-6">
        <div className="flex items-center gap-2 text-sm text-info bg-info/10 rounded-lg p-3">
          <Info className="h-4 w-4 shrink-0" />
          <span>These settings define the rules enforced across all tenancy agreements, in compliance with the Rent Act 220.</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Maximum Advance Rent (months)</Label>
            <Input type="number" min={1} max={12} value={config.max_advance_months} onChange={e => updateField("max_advance_months", parseInt(e.target.value) || 6)} />
            <p className="text-xs text-muted-foreground">Act 220 mandates a maximum of 6 months advance rent</p>
          </div>
          <div className="space-y-2">
            <Label>Government Tax Rate (%)</Label>
            <Input type="number" min={0} max={50} step={0.1} value={config.tax_rate} onChange={e => updateField("tax_rate", parseFloat(e.target.value) || 8)} />
            <p className="text-xs text-muted-foreground">Statutory tax collected on monthly rent</p>
          </div>
          <div className="space-y-2">
            <Label>Minimum Lease Duration (months)</Label>
            <Input type="number" min={1} max={60} value={config.min_lease_duration} onChange={e => updateField("min_lease_duration", parseInt(e.target.value) || 1)} />
          </div>
          <div className="space-y-2">
            <Label>Maximum Lease Duration (months)</Label>
            <Input type="number" min={1} max={120} value={config.max_lease_duration} onChange={e => updateField("max_lease_duration", parseInt(e.target.value) || 24)} />
          </div>
          <div className="space-y-2">
            <Label>Registration Deadline (days after signing)</Label>
            <Input type="number" min={1} max={90} value={config.registration_deadline_days} onChange={e => updateField("registration_deadline_days", parseInt(e.target.value) || 14)} />
            <p className="text-xs text-muted-foreground">Number of days allowed to register a new agreement</p>
          </div>
        </div>
      </div>

      {/* Agreement Data Fields */}
      <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Agreement Data Fields
        </h2>
        <p className="text-sm text-muted-foreground">Define what information appears in the tenancy agreement. System fields are auto-populated. Custom fields are filled by landlords when creating agreements.</p>

        {/* System fields (locked) */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">System Fields (auto-populated)</h3>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {SYSTEM_FIELDS.map(field => (
              <div key={field} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-muted/50">
                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-foreground">{field}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Custom fields */}
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Custom Fields (filled by landlord)</h3>
          {config.custom_fields.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No custom fields defined. Add fields below.</p>
          )}
          <div className="space-y-2">
            {config.custom_fields.map((field, index) => (
              <div key={index} className="flex gap-2 items-center group bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
                {editingFieldIndex === index ? (
                  <div className="flex-1 space-y-2">
                    <div className="grid sm:grid-cols-3 gap-2">
                      <Input value={editingField.label} onChange={e => setEditingField({ ...editingField, label: e.target.value })} placeholder="Field label" />
                      <Select value={editingField.type} onValueChange={(v: "text" | "number" | "date") => setEditingField({ ...editingField, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2">
                        <Switch checked={editingField.required} onCheckedChange={c => setEditingField({ ...editingField, required: c })} />
                        <span className="text-xs text-muted-foreground">Required</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEditField}><Check className="h-3 w-3 mr-1" /> Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingFieldIndex(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-foreground">{field.label}</span>
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{field.type}</span>
                        {field.required && <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">Required</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveField(index, 1)} disabled={index === config.custom_fields.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditField(index)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeCustomField(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new custom field */}
          <div className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-border mt-3">
            <Input placeholder="Field label (e.g. Occupation of Tenant)" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} className="flex-1" />
            <Select value={newFieldType} onValueChange={(v: "text" | "number" | "date") => setNewFieldType(v)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={newFieldRequired} onCheckedChange={setNewFieldRequired} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">Required</span>
            </div>
            <Button onClick={addCustomField} disabled={!newFieldLabel.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>
      </div>

      {/* Terms & Conditions */}
      <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Standard Terms & Conditions
        </h2>
        <p className="text-sm text-muted-foreground">These terms appear in every generated tenancy agreement PDF. Add, edit, or remove clauses as needed.</p>
        <div className="space-y-2">
          {config.terms.map((term, index) => (
            <div key={index} className="flex gap-2 items-start group bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors">
              <span className="text-xs font-mono text-muted-foreground pt-1 shrink-0 w-6">{index + 1}.</span>
              {editingTermIndex === index ? (
                <div className="flex-1 space-y-2">
                  <Textarea value={editingTermValue} onChange={e => setEditingTermValue(e.target.value)} className="min-h-[60px]" autoFocus />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEditTerm}><Check className="h-3 w-3 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTermIndex(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-start gap-2">
                  <p className="text-sm text-foreground flex-1">{term}</p>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditTerm(index)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeTerm(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t border-border">
          <Input placeholder="Add a new term or condition..." value={newTerm} onChange={e => setNewTerm(e.target.value)} onKeyDown={e => e.key === "Enter" && addTerm()} className="flex-1" />
          <Button onClick={addTerm} disabled={!newTerm.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Add Term
          </Button>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave} disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Save Configuration"}
        </Button>
      </div>
    </div>
  );
};

export default RegulatorAgreementTemplates;

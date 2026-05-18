import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Loader2, FileText, ChevronLeft, ChevronRight, Save, CheckCircle2,
  Users, Home, AlignLeft, Paperclip, UserCheck, FileSignature, ListChecks, Sparkles, Trash2, Plus,
} from "lucide-react";
import PartySearchCombobox, { PartyMatch } from "@/components/PartySearchCombobox";
import LinkedPropertyPicker, { LinkedPropertySelection } from "@/components/LinkedPropertyPicker";
import { transitionStage } from "@/lib/complaintAudit";

type Role = "tenant" | "landlord" | "interested_person";

interface WitnessRow {
  id?: string;
  side: "complainant" | "respondent";
  name: string;
  phone: string;
  address: string;
  expected_testimony: string;
}

const STEPS = [
  { key: "type", label: "Type", icon: FileText },
  { key: "parties", label: "Parties", icon: Users },
  { key: "property", label: "Property", icon: Home },
  { key: "details", label: "Details", icon: AlignLeft },
  { key: "evidence", label: "Evidence", icon: Paperclip },
  { key: "witnesses", label: "Witnesses", icon: UserCheck },
  { key: "forms", label: "Forms", icon: FileSignature },
  { key: "review", label: "Review", icon: ListChecks },
] as const;

const ComplaintWizard = () => {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const draftId = sp.get("draft");

  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [draftPk, setDraftPk] = useState<string | null>(draftId);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);

  // Step 1 — Type
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [complaintTypeId, setComplaintTypeId] = useState("");

  // Step 2 — Parties
  const [complainantRole, setComplainantRole] = useState<Role>("tenant");
  const [respondentRole, setRespondentRole] = useState<Role>("landlord");
  const [complainant, setComplainant] = useState<PartyMatch | null>(null);
  const [respondent, setRespondent] = useState<PartyMatch | null>(null);
  const [phName, setPhName] = useState({ c: "", r: "" });
  const [phPhone, setPhPhone] = useState({ c: "", r: "" });

  // Step 3 — Property
  const [linkedProperty, setLinkedProperty] = useState<LinkedPropertySelection | null>(null);
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [rentAmount, setRentAmount] = useState("");
  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [docketRef, setDocketRef] = useState("");

  // Step 4 — Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // Step 5 — Evidence
  const [files, setFiles] = useState<File[]>([]);
  const [existingEvidence, setExistingEvidence] = useState<string[]>([]);

  // Step 6 — Witnesses
  const [witnesses, setWitnesses] = useState<WitnessRow[]>([]);

  // Step 7 — Forms
  const [formTemplates, setFormTemplates] = useState<any[]>([]);
  const [selectedForms, setSelectedForms] = useState<string[]>([]);

  // Load lookups + draft
  useEffect(() => {
    (async () => {
      const { data: types } = await supabase.from("complaint_types").select("*").eq("active", true).order("display_order");
      const { data: offs } = await supabase.from("offices").select("*").order("name");
      const { data: forms } = await supabase
        .from("form_templates")
        .select("id, form_number, form_name")
        .eq("status", "active")
        .order("form_number");
      setComplaintTypes(types || []);
      setOffices(offs || []);
      setFormTemplates(forms || []);
    })();
  }, []);

  // Hydrate from draft
  useEffect(() => {
    if (!draftId) return;
    (async () => {
      const { data } = await supabase.from("complaints").select("*").eq("id", draftId).maybeSingle();
      if (!data) return;
      setTicketNumber((data as any).ticket_number || null);
      setComplaintTypeId(data.complaint_type_id || "");
      setComplainantRole((data.complainant_role as Role) || "tenant");
      setRespondentRole((data.respondent_role as Role) || "landlord");
      setPhName({
        c: (data as any).placeholder_complainant_name || "",
        r: (data as any).placeholder_respondent_name || "",
      });
      setPhPhone({
        c: (data as any).placeholder_complainant_phone || "",
        r: (data as any).placeholder_respondent_phone || "",
      });
      setAddress(data.property_address || "");
      setRegion(data.region || "");
      setRentAmount((data as any).rent_amount ? String((data as any).rent_amount) : "");
      setOfficeId(data.office_id || "");
      setDocketRef((data as any).physical_docket_ref || "");
      setTitle((data as any).complaint_title || "");
      setDescription(data.description || "");
      setExistingEvidence((data.evidence_urls as any) || []);

      const { data: ws } = await supabase.from("complaint_witnesses").select("*").eq("case_id", draftId);
      setWitnesses((ws || []).map((w: any) => ({
        id: w.id, side: w.side, name: w.name, phone: w.phone || "",
        address: w.address || "", expected_testimony: w.expected_testimony || "",
      })));
    })();
  }, [draftId]);

  // Auto-link property
  useEffect(() => {
    if (linkedProperty) {
      setAddress(linkedProperty.address);
      setRegion(linkedProperty.region);
      if (linkedProperty.rent != null) setRentAmount(String(linkedProperty.rent));
      const matchOffice = offices.find((o) => o.region.toLowerCase() === linkedProperty.region.toLowerCase());
      if (matchOffice && !officeId) setOfficeId(matchOffice.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedProperty]);

  const partyRole = (r: Role): "tenant" | "landlord" | null =>
    r === "interested_person" ? null : r;

  const buildPayload = () => {
    const cName = complainant?.full_name || phName.c;
    const cPhone = complainant?.phone || phPhone.c;
    const rName = respondent?.full_name || phName.r;
    const rPhone = respondent?.phone || phPhone.r;
    const ct = complaintTypes.find((t) => t.id === complaintTypeId);
    const payload: any = {
      complaint_type: ct?.label || "Draft",
      complaint_type_id: complaintTypeId || null,
      complaint_title: title || null,
      landlord_name: respondentRole === "landlord" ? rName : (rName || "—"),
      property_address: address || "—",
      region: region || "—",
      description: description || "",
      office_id: officeId || null,
      complainant_role: complainantRole,
      respondent_role: respondentRole,
      physical_docket_ref: docketRef || null,
      rent_amount: rentAmount ? Number(rentAmount) : null,
      linked_property_id: linkedProperty?.property_id || null,
      linked_unit_id: linkedProperty?.unit_id || null,
      filed_by_admin: true,
      gps_confirmed: false,
    };
    if (complainant?.user_id) payload.tenant_user_id = complainant.user_id;
    else {
      payload.placeholder_complainant_name = cName || null;
      payload.placeholder_complainant_phone = cPhone || null;
    }
    if (respondent?.user_id) payload.respondent_user_id = respondent.user_id;
    else {
      payload.placeholder_respondent_name = rName || null;
      payload.placeholder_respondent_phone = rPhone || null;
    }
    return payload;
  };

  const uploadNewEvidence = async (): Promise<string[]> => {
    const urls: string[] = [];
    for (const f of files) {
      const path = `admin-filed/${Date.now()}-${f.name}`;
      const { error } = await supabase.storage.from("application-evidence").upload(path, f);
      if (!error) urls.push(path);
    }
    return urls;
  };

  const saveDraft = async (silent = false) => {
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminId = auth.user?.id;
      const newUrls = await uploadNewEvidence();
      const allEvidence = [...existingEvidence, ...newUrls];

      const base = buildPayload();
      let pk = draftPk;
      if (!pk) {
        const code = `CMP-${Date.now().toString(36).toUpperCase()}`;
        const { data: created, error } = await supabase
          .from("complaints")
          .insert({
            ...base,
            complaint_code: code,
            status: "draft",
            current_stage: "draft",
            payment_status: "awaiting",
            admin_filer_user_id: adminId,
            evidence_urls: allEvidence,
          })
          .select("id, ticket_number")
          .single();
        if (error) throw error;
        pk = created.id;
        setDraftPk(pk);
        setTicketNumber(created.ticket_number);
      } else {
        const { error } = await supabase
          .from("complaints")
          .update({ ...base, evidence_urls: allEvidence })
          .eq("id", pk);
        if (error) throw error;
      }

      // Sync witnesses (delete + re-insert simple strategy)
      if (pk) {
        await supabase.from("complaint_witnesses").delete().eq("case_id", pk);
        if (witnesses.length) {
          await supabase.from("complaint_witnesses").insert(
            witnesses
              .filter((w) => w.name.trim())
              .map((w) => ({
                case_id: pk, case_kind: "complaint", side: w.side,
                name: w.name, phone: w.phone || null, address: w.address || null,
                expected_testimony: w.expected_testimony || null, created_by: adminId,
              }))
          );
        }
      }

      setFiles([]);
      setExistingEvidence(allEvidence);
      if (!silent) toast({ title: "Draft saved", description: ticketNumber || "Draft persisted" });
      return pk;
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setSaving(false);
    }
  };

  const submitForReview = async () => {
    const missing: string[] = [];
    if (!complaintTypeId) missing.push("Complaint type");
    if (!address) missing.push("Property address");
    if (!description) missing.push("Description");
    if (!officeId) missing.push("Office");
    if (!(complainant?.full_name || phName.c)) missing.push("Complainant");
    if (!(respondent?.full_name || phName.r)) missing.push("Respondent");
    if (missing.length) {
      toast({
        title: "Can't submit — missing fields",
        description: missing.join(", "),
        variant: "destructive",
      });
      // Jump to first relevant step
      if (missing.includes("Complaint type")) setStepIdx(0);
      else if (missing.includes("Complainant") || missing.includes("Respondent")) setStepIdx(1);
      else if (missing.includes("Property address") || missing.includes("Office")) setStepIdx(2);
      else if (missing.includes("Description")) setStepIdx(3);
      return;
    }

    setSubmitting(true);
    try {
      const pk = await saveDraft(true);
      if (!pk) {
        toast({ title: "Could not save draft", description: "Submission aborted.", variant: "destructive" });
        return;
      }
      const { error } = await supabase
        .from("complaints")
        .update({ status: "submitted" })
        .eq("id", pk);
      if (error) throw error;
      try {
        await transitionStage({ caseId: pk, toStage: "submitted", reason: "Submitted via wizard" });
      } catch (te: any) {
        console.warn("transitionStage failed (non-fatal)", te);
      }
      toast({ title: "Submitted for review", description: ticketNumber || "Complaint sent to office" });
      navigate("/regulator/complaints/command-center");
    } catch (e: any) {
      console.error("Submit for Review failed", e);
      toast({
        title: "Submission failed",
        description: e?.message || e?.details || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const aiRewrite = async (mode: "improve" | "formalize" | "summary") => {
    if (!description.trim()) return toast({ title: "Add a description first" });
    setAiBusy(true);
    try {
      const prompt =
        mode === "improve" ? "Improve grammar and clarity without changing facts. Reply with the improved text only." :
        mode === "formalize" ? "Rewrite in formal legal-administrative tone suitable for a Rent Control Ghana case file. Reply with the rewritten text only." :
        "Produce a concise 2-sentence summary headline suitable as a case title. Reply with the title only.";
      const { data, error } = await supabase.functions.invoke("legal-assistant", {
        body: { messages: [{ role: "user", content: `${prompt}\n\n---\n${description}` }] },
      });
      if (error) throw error;
      const text = (data as any)?.message || (data as any)?.content || (data as any)?.text;
      if (!text) throw new Error("AI returned no text");
      if (mode === "summary") setTitle(text.trim().replace(/^["']|["']$/g, ""));
      else setDescription(text.trim());
    } catch (e: any) {
      toast({ title: "AI assist unavailable", description: e.message, variant: "destructive" });
    } finally {
      setAiBusy(false);
    }
  };

  const addWitness = (side: WitnessRow["side"]) =>
    setWitnesses((w) => [...w, { side, name: "", phone: "", address: "", expected_testimony: "" }]);
  const updateWitness = (i: number, patch: Partial<WitnessRow>) =>
    setWitnesses((w) => w.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeWitness = (i: number) =>
    setWitnesses((w) => w.filter((_, idx) => idx !== i));

  const canNext = useMemo(() => {
    const step = STEPS[stepIdx].key;
    if (step === "type") return !!complaintTypeId;
    if (step === "parties") return !!(complainant?.full_name || phName.c) && !!(respondent?.full_name || phName.r);
    if (step === "property") return !!address && !!region && !!officeId;
    if (step === "details") return !!description;
    return true;
  }, [stepIdx, complaintTypeId, complainant, respondent, phName, address, region, officeId, description]);

  const step = STEPS[stepIdx];

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> Complaint Wizard</h1>
          <p className="text-sm text-muted-foreground">
            Step {stepIdx + 1} of {STEPS.length} — {step.label}
            {ticketNumber && <span className="ml-2"><Badge variant="outline">{ticketNumber}</Badge></span>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveDraft()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save draft
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <button
              key={s.key}
              onClick={() => setStepIdx(i)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs whitespace-nowrap transition ${
                active ? "bg-primary text-primary-foreground border-primary" :
                done ? "bg-muted text-foreground border-border" :
                "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              <span>{i + 1}. {s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step bodies */}
      {step.key === "type" && (
        <Card><CardHeader><CardTitle>Complaint Type</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Label>Type</Label>
            <Select value={complaintTypeId} onValueChange={setComplaintTypeId}>
              <SelectTrigger><SelectValue placeholder="Select complaint type" /></SelectTrigger>
              <SelectContent>{complaintTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick the primary issue. Additional facts can be added in Details.
            </p>
          </CardContent>
        </Card>
      )}

      {step.key === "parties" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Complainant</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Role</Label>
              <Select value={complainantRole} onValueChange={(v) => setComplainantRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="interested_person">Interested Person</SelectItem>
                </SelectContent>
              </Select>
              <PartySearchCombobox label="Search existing user" value={complainant} onChange={setComplainant} roleFilter={partyRole(complainantRole)} />
              {!complainant && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Full name</Label><Input value={phName.c} onChange={(e) => setPhName({ ...phName, c: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={phPhone.c} onChange={(e) => setPhPhone({ ...phPhone, c: e.target.value })} placeholder="0XXXXXXXXX" /></div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>Respondent</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Label>Role</Label>
              <Select value={respondentRole} onValueChange={(v) => setRespondentRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="interested_person">Interested Person</SelectItem>
                </SelectContent>
              </Select>
              <PartySearchCombobox label="Search existing user" value={respondent} onChange={setRespondent} roleFilter={partyRole(respondentRole)} />
              {!respondent && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>Full name</Label><Input value={phName.r} onChange={(e) => setPhName({ ...phName, r: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={phPhone.r} onChange={(e) => setPhPhone({ ...phPhone, r: e.target.value })} placeholder="0XXXXXXXXX" /></div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step.key === "property" && (
        <Card><CardHeader><CardTitle>Property / Premises & Office</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {(complainant || respondent) && (
              <LinkedPropertyPicker
                partyUserId={complainant?.user_id || respondent?.user_id || null}
                partyRole={partyRole(complainant ? complainantRole : respondentRole)}
                onChange={setLinkedProperty}
              />
            )}
            <div className="space-y-1"><Label>Address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Region</Label><Input value={region} onChange={(e) => setRegion(e.target.value)} /></div>
              <div><Label>Monthly Rent (GHS)</Label><Input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} /></div>
            </div>
            <div className="space-y-1">
              <Label>Office Handling Complaint</Label>
              <Select value={officeId} onValueChange={setOfficeId}>
                <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} ({o.region})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Docket / Physical Reference (optional)</Label>
              <Input value={docketRef} onChange={(e) => setDocketRef(e.target.value)} placeholder="For reconciliation with paper records" />
            </div>
          </CardContent>
        </Card>
      )}

      {step.key === "details" && (
        <Card><CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Case Title (optional)</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short summary, e.g. 'Unlawful eviction at 12 Spintex Rd'" />
            </div>
            <div className="space-y-1">
              <Label>Narrative</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={10} placeholder="Describe what happened, dates, amounts, witnesses present, requested remedy." />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => aiRewrite("improve")} disabled={aiBusy}>
                <Sparkles className="h-4 w-4 mr-1" /> Improve grammar
              </Button>
              <Button size="sm" variant="outline" onClick={() => aiRewrite("formalize")} disabled={aiBusy}>
                <Sparkles className="h-4 w-4 mr-1" /> Formalize tone
              </Button>
              <Button size="sm" variant="outline" onClick={() => aiRewrite("summary")} disabled={aiBusy}>
                <Sparkles className="h-4 w-4 mr-1" /> Generate title
              </Button>
              {aiBusy && <span className="text-xs text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" /> Working…</span>}
            </div>
          </CardContent>
        </Card>
      )}

      {step.key === "evidence" && (
        <Card><CardHeader><CardTitle>Evidence & Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {existingEvidence.length > 0 && (
              <div className="space-y-1">
                <Label>Already uploaded</Label>
                <ul className="text-sm space-y-1">
                  {existingEvidence.map((p) => (
                    <li key={p} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
                      <span className="truncate">{p.split("/").pop()}</span>
                      <Button size="sm" variant="ghost" onClick={() => setExistingEvidence((arr) => arr.filter((x) => x !== p))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-1">
              <Label>Add files (saved on next Save Draft)</Label>
              <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              {files.length > 0 && (
                <p className="text-xs text-muted-foreground">{files.length} new file(s) queued</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step.key === "witnesses" && (
        <Card><CardHeader><CardTitle>Witnesses</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => addWitness("complainant")}><Plus className="h-4 w-4 mr-1" /> Complainant witness</Button>
              <Button size="sm" variant="outline" onClick={() => addWitness("respondent")}><Plus className="h-4 w-4 mr-1" /> Respondent witness</Button>
            </div>
            {witnesses.length === 0 && <p className="text-sm text-muted-foreground">No witnesses added.</p>}
            {witnesses.map((w, i) => (
              <div key={i} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={w.side === "complainant" ? "default" : "secondary"}>{w.side}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => removeWitness(i)}><Trash2 className="h-3 w-3" /></Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><Label>Name</Label><Input value={w.name} onChange={(e) => updateWitness(i, { name: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={w.phone} onChange={(e) => updateWitness(i, { phone: e.target.value })} /></div>
                </div>
                <div><Label>Address</Label><Input value={w.address} onChange={(e) => updateWitness(i, { address: e.target.value })} /></div>
                <div><Label>Expected testimony</Label><Textarea rows={2} value={w.expected_testimony} onChange={(e) => updateWitness(i, { expected_testimony: e.target.value })} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step.key === "forms" && (
        <Card><CardHeader><CardTitle>Forms to generate later</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Select forms that should be generated after submission. The Case Admin can still add or change forms at any time.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {formTemplates.map((f) => {
                const checked = selectedForms.includes(f.id);
                return (
                  <label key={f.id} className={`flex items-center gap-2 rounded border p-2 cursor-pointer ${checked ? "border-primary bg-primary/5" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() =>
                      setSelectedForms((arr) => arr.includes(f.id) ? arr.filter((x) => x !== f.id) : [...arr, f.id])
                    } />
                    <span className="text-sm"><strong>{f.form_number}</strong> — {f.form_name}</span>
                  </label>
                );
              })}
              {formTemplates.length === 0 && <p className="text-sm text-muted-foreground">No active form templates.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {step.key === "review" && (
        <Card><CardHeader><CardTitle>Review & Submit</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row k="Type" v={complaintTypes.find((t) => t.id === complaintTypeId)?.label} />
            <Row k="Title" v={title} />
            <Row k="Complainant" v={`${complainant?.full_name || phName.c} (${complainantRole})`} />
            <Row k="Respondent" v={`${respondent?.full_name || phName.r} (${respondentRole})`} />
            <Row k="Property" v={`${address}, ${region}`} />
            <Row k="Office" v={offices.find((o) => o.id === officeId)?.name} />
            <Row k="Evidence" v={`${existingEvidence.length + files.length} file(s)`} />
            <Row k="Witnesses" v={String(witnesses.filter((w) => w.name).length)} />
            <Row k="Forms queued" v={String(selectedForms.length)} />
            <p className="text-xs text-muted-foreground pt-2">
              Submitting moves the case from Draft → Submitted and notifies the assigned office.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between gap-2 flex-wrap">
        <Button variant="outline" onClick={() => setStepIdx((i) => Math.max(0, i - 1))} disabled={stepIdx === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex gap-2 flex-wrap">
          {stepIdx >= 3 && stepIdx < STEPS.length - 1 && (
            <Button variant="secondary" onClick={submitForReview} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Submit for Review
            </Button>
          )}
          {stepIdx < STEPS.length - 1 ? (
            <Button onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))} disabled={!canNext}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={submitForReview} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Submit for Review
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v }: { k: string; v?: string | null }) => (
  <div className="flex justify-between gap-3 border-b py-1">
    <span className="text-muted-foreground">{k}</span>
    <span className="text-right font-medium">{v || "—"}</span>
  </div>
);

export default ComplaintWizard;

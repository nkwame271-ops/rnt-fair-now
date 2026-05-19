import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText, Plus, X, MapPin, ChevronDown, CreditCard, CheckCircle2, ArrowLeft } from "lucide-react";
import Form7LivePreview from "@/components/regulator/Form7LivePreview";
import RequestComplaintPaymentDialog from "@/components/RequestComplaintPaymentDialog";
import type { Form7Data, Form7Party } from "@/lib/pdf/form7";

type Role = "tenant" | "landlord" | "interested_person";
type Party = { name: string; phone: string; address?: string; gps_lat?: number; gps_lng?: number };

const DRAFT_KEY = "admin_file_complaint_draft_v2";
const RELIEFS = ["Eject tenants immediately", "Refund deposit", "Repair / restore premises", "Other"];
const INTENTS = ["Renew agreement", "Vacate premises", "Negotiate new terms", "Unclear / silent"];

const AdminFileComplaint = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  // Roles
  const [complainantRole, setComplainantRole] = useState<Role>("tenant");
  const [respondentRole, setRespondentRole] = useState<Role>("landlord");

  // Multiple parties
  const [complainants, setComplainants] = useState<Party[]>([{ name: "", phone: "" }]);
  const [respondents, setRespondents] = useState<Party[]>([{ name: "", phone: "" }]);

  // Premises
  const [premisesHouseNo, setPremisesHouseNo] = useState("");
  const [premisesTown, setPremisesTown] = useState("");
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [rentAmount, setRentAmount] = useState("");

  // Complaint
  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [complaintTypeId, setComplaintTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [reliefSought, setReliefSought] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  // More details
  const [depositAmount, setDepositAmount] = useState("");
  const [agreementExpiry, setAgreementExpiry] = useState("");
  const [occupiedMonths, setOccupiedMonths] = useState("");
  const [tenantsIntent, setTenantsIntent] = useState("");

  // Office
  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [docketRef, setDocketRef] = useState("");

  // Load reference data + draft
  useEffect(() => {
    (async () => {
      const { data: types } = await supabase.from("complaint_types").select("*").eq("active", true).order("display_order");
      setComplaintTypes(types || []);
      const { data: offs } = await supabase.from("offices").select("*").order("name");
      setOffices(offs || []);
    })();
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        Object.entries(d).forEach(([k, v]) => {
          const map: Record<string, (val: any) => void> = {
            complainants: setComplainants, respondents: setRespondents,
            premisesHouseNo: setPremisesHouseNo, premisesTown: setPremisesTown,
            address: setAddress, region: setRegion, rentAmount: setRentAmount,
            complaintTypeId: setComplaintTypeId, description: setDescription,
            reliefSought: setReliefSought, depositAmount: setDepositAmount,
            agreementExpiry: setAgreementExpiry, occupiedMonths: setOccupiedMonths,
            tenantsIntent: setTenantsIntent, officeId: setOfficeId, docketRef: setDocketRef,
            complainantRole: setComplainantRole, respondentRole: setRespondentRole,
          };
          if (map[k]) map[k](v);
        });
      }
    } catch {}
  }, []);

  // Auto-pick office by region
  useEffect(() => {
    if (region && !officeId) {
      const m = offices.find((o) => o.region?.toLowerCase() === region.toLowerCase());
      if (m) setOfficeId(m.id);
    }
  }, [region, offices, officeId]);

  // Autosave draft
  useEffect(() => {
    const t = setTimeout(() => {
      const snapshot = {
        complainants, respondents, premisesHouseNo, premisesTown, address, region,
        rentAmount, complaintTypeId, description, reliefSought, depositAmount,
        agreementExpiry, occupiedMonths, tenantsIntent, officeId, docketRef,
        complainantRole, respondentRole,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
    }, 500);
    return () => clearTimeout(t);
  }, [complainants, respondents, premisesHouseNo, premisesTown, address, region, rentAmount,
      complaintTypeId, description, reliefSought, depositAmount, agreementExpiry, occupiedMonths,
      tenantsIntent, officeId, docketRef, complainantRole, respondentRole]);

  const updateParty = (which: "c" | "r", i: number, patch: Partial<Party>) => {
    const setter = which === "c" ? setComplainants : setRespondents;
    const arr = which === "c" ? complainants : respondents;
    const next = [...arr];
    next[i] = { ...next[i], ...patch };
    setter(next);
  };
  const addParty = (which: "c" | "r") => {
    if (which === "c") setComplainants([...complainants, { name: "", phone: "" }]);
    else setRespondents([...respondents, { name: "", phone: "" }]);
  };
  const removeParty = (which: "c" | "r", i: number) => {
    if (which === "c") setComplainants(complainants.filter((_, idx) => idx !== i));
    else setRespondents(respondents.filter((_, idx) => idx !== i));
  };

  const captureGps = (i: number) => {
    if (!navigator.geolocation) return toast({ title: "GPS unavailable", variant: "destructive" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateParty("c", i, { gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude });
        toast({ title: "GPS captured", description: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}` });
      },
      () => toast({ title: "Could not get GPS", variant: "destructive" })
    );
  };

  // Live preview data
  const previewData: Form7Data = useMemo(() => ({
    ticket_number: "TKT-PREVIEW",
    case_number: undefined,
    complainants: complainants.map((p): Form7Party => ({ name: p.name || "—", phone: p.phone, address: p.address })),
    respondents: respondents.map((p): Form7Party => ({ name: p.name || "—", phone: p.phone })),
    premises_house_no: premisesHouseNo,
    premises_town: premisesTown,
    property_address: address,
    region,
    rent_amount: rentAmount,
    deposit_amount: depositAmount,
    agreement_expiry_date: agreementExpiry,
    occupied_months: occupiedMonths ? Number(occupiedMonths) : undefined,
    tenants_intent: tenantsIntent,
    description,
    relief_sought: reliefSought,
    office_name: offices.find((o) => o.id === officeId)?.name,
  }), [complainants, respondents, premisesHouseNo, premisesTown, address, region, rentAmount,
      depositAmount, agreementExpiry, occupiedMonths, tenantsIntent, description, reliefSought,
      officeId, offices]);

  const errors = useMemo(() => {
    const e: string[] = [];
    if (!complainants[0]?.name) e.push("Complainant name");
    if (!respondents[0]?.name) e.push("Respondent name");
    if (!address) e.push("Premises address");
    if (!region) e.push("Region");
    if (!complaintTypeId) e.push("Complaint type");
    if (!description) e.push("Description");
    if (!officeId) e.push("Office");
    return e;
  }, [complainants, respondents, address, region, complaintTypeId, description, officeId]);

  const submit = async () => {
    if (errors.length) return toast({ title: "Missing required fields", description: errors.join(", "), variant: "destructive" });
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminId = auth.user?.id;

      const evidenceUrls: string[] = [];
      for (const f of files) {
        const path = `admin-filed/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("application-evidence").upload(path, f);
        if (!upErr) evidenceUrls.push(path);
      }

      const ct = complaintTypes.find((t) => t.id === complaintTypeId);
      const code = `CMP-${Date.now().toString(36).toUpperCase()}`;

      const primaryC = complainants[0];
      const primaryR = respondents[0];

      // Resolve complainant phone -> user_id so the complaint appears in their portal.
      const normalizePhone = (raw?: string) => {
        if (!raw) return null;
        let d = raw.replace(/\D/g, "");
        if (d.length === 10 && d.startsWith("0")) d = "233" + d.substring(1);
        else if (d.length === 9) d = "233" + d;
        return d.length >= 9 ? d : null;
      };
      let complainantUserId: string | null = null;
      const cNorm = normalizePhone(primaryC.phone);
      if (cNorm) {
        try {
          const { data: prof } = await supabase
            .from("profiles")
            .select("user_id, phone")
            .or(`phone.eq.${cNorm},phone.eq.0${cNorm.substring(3)},phone.eq.${cNorm.substring(3)}`)
            .limit(1)
            .maybeSingle();
          complainantUserId = prof?.user_id || null;
        } catch (e) { /* ignore */ }
      }

      const payload: any = {
        complaint_code: code,
        complaint_type: ct?.label || "Other",
        complaint_type_id: complaintTypeId,
        landlord_name: respondentRole === "landlord" ? primaryR.name : primaryR.name,
        property_address: address,
        region,
        description,
        evidence_urls: evidenceUrls,
        office_id: officeId,
        status: "submitted",
        payment_status: "awaiting",
        gps_confirmed: false,
        filed_by_admin: true,
        admin_filer_user_id: adminId,
        complainant_role: complainantRole,
        respondent_role: respondentRole,
        physical_docket_ref: docketRef || null,
        rent_amount: rentAmount ? Number(rentAmount) : null,
        placeholder_complainant_name: primaryC.name,
        placeholder_complainant_phone: primaryC.phone || null,
        placeholder_respondent_name: primaryR.name,
        placeholder_respondent_phone: primaryR.phone || null,
        complainant_user_id: complainantUserId,
        tenant_user_id: complainantRole === "tenant" ? complainantUserId : null,
        // New official-form fields
        complainants,
        respondents,
        premises_house_no: premisesHouseNo || null,
        premises_town: premisesTown || null,
        complainant_address: primaryC.address || null,
        complainant_gps_lat: primaryC.gps_lat ?? null,
        complainant_gps_lng: primaryC.gps_lng ?? null,
        deposit_amount: depositAmount ? Number(depositAmount) : null,
        agreement_expiry_date: agreementExpiry || null,
        occupied_months: occupiedMonths ? Number(occupiedMonths) : null,
        tenants_intent: tenantsIntent || null,
        relief_sought: reliefSought || null,
      };


      const { data: created, error } = await supabase
        .from("complaints")
        .insert(payload)
        .select("id, ticket_number, created_at")
        .single();
      if (error) throw error;

      // Auto-generate official Form 7 (non-blocking)
      try {
        const { autoGenerateForm7 } = await import("@/lib/complaintForms");
        await autoGenerateForm7(created.id, { ...payload, id: created.id, ticket_number: created.ticket_number, created_at: created.created_at });
      } catch (e) { console.warn("Form 7 auto-generate failed", e); }

      localStorage.removeItem(DRAFT_KEY);
      toast({ title: "Complaint filed", description: `Ticket ${created.ticket_number}` });
      navigate(`/regulator/complaints/${created.id}`);
    } catch (e: any) {
      const msg = e?.message || e?.details || e?.hint || "Unknown error";
      console.error("File complaint failed", e);
      toast({ title: "Failed to file complaint", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const PartyEditor = ({ which }: { which: "c" | "r" }) => {
    const arr = which === "c" ? complainants : respondents;
    return (
      <div className="space-y-3">
        {arr.map((p, i) => (
          <div key={i} className="rounded-lg border p-3 space-y-2 bg-background/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {which === "c" ? "Complainant" : "Respondent"} #{i + 1}
              </span>
              {arr.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => removeParty(which, i)} className="h-7 px-2">
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input placeholder="Full name" value={p.name} onChange={(e) => updateParty(which, i, { name: e.target.value })} />
              <Input placeholder="Phone (0XXXXXXXXX)" value={p.phone} onChange={(e) => updateParty(which, i, { phone: e.target.value })} />
            </div>
            {which === "c" && (
              <div className="space-y-2">
                <Input placeholder="Address (e.g. H No. 211, James Town – Accra)" value={p.address || ""} onChange={(e) => updateParty(which, i, { address: e.target.value })} />
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => captureGps(i)}>
                    <MapPin className="h-3.5 w-3.5 mr-1" /> Capture GPS
                  </Button>
                  {p.gps_lat && (
                    <Badge variant="secondary" className="text-xs">
                      {p.gps_lat.toFixed(4)}, {p.gps_lng?.toFixed(4)}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => addParty(which)} className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add another {which === "c" ? "complainant" : "respondent"}
        </Button>
      </div>
    );
  };

  return (
    <div className="container max-w-7xl py-4">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-lg font-semibold truncate">File Complaint</h1>
              <p className="text-xs text-muted-foreground truncate">Admin intake — Form 7 generated automatically</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {errors.length > 0 && (
              <Badge variant="outline" className="hidden md:inline-flex text-xs">
                {errors.length} field{errors.length === 1 ? "" : "s"} missing
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => navigate("/regulator/complaints")}>Cancel</Button>
            <Button onClick={submit} disabled={submitting || errors.length > 0} size="sm">
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              File Complaint
            </Button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_440px] gap-4">
        {/* LEFT: form */}
        <div className="space-y-4 min-w-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Parties</span>
                <div className="flex gap-2 text-xs font-normal">
                  <Select value={complainantRole} onValueChange={(v) => setComplainantRole(v as Role)}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tenant">Tenant filing</SelectItem>
                      <SelectItem value="landlord">Landlord filing</SelectItem>
                      <SelectItem value="interested_person">Interested person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Complainant(s)</Label>
                <div className="mt-2"><PartyEditor which="c" /></div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Respondent(s)</Label>
                  <Select value={respondentRole} onValueChange={(v) => setRespondentRole(v as Role)}>
                    <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landlord">Landlord</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                      <SelectItem value="interested_person">Interested person</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-2"><PartyEditor which="r" /></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Premises</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">House No.</Label>
                  <Input value={premisesHouseNo} onChange={(e) => setPremisesHouseNo(e.target.value)} placeholder="Nil if none" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Town / Area</Label>
                  <Input value={premisesTown} onChange={(e) => setPremisesTown(e.target.value)} placeholder="e.g. Kwashieman – Accra" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Full Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Region</Label>
                  <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Greater Accra" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monthly Rent (GHS)</Label>
                  <Input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Complaint</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={complaintTypeId} onValueChange={setComplaintTypeId}>
                  <SelectTrigger><SelectValue placeholder="Select complaint type" /></SelectTrigger>
                  <SelectContent>{complaintTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description / Statement of facts</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Brief narrative of what happened…" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Relief sought</Label>
                <div className="flex flex-wrap gap-1.5">
                  {RELIEFS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReliefSought(r === reliefSought ? "" : r)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        reliefSought === r ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {reliefSought === "Other" && (
                  <Input className="mt-2" placeholder="Describe relief sought" onChange={(e) => setReliefSought(e.target.value)} />
                )}
              </div>

              {/* More details (collapsible — keeps form short by default) */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between border border-dashed">
                    <span className="text-xs">More details (agreement, deposit, occupancy)</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Agreement expired on</Label>
                      <Input type="date" value={agreementExpiry} onChange={(e) => setAgreementExpiry(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Deposit paid (GHS)</Label>
                      <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Months occupied</Label>
                      <Input type="number" value={occupiedMonths} onChange={(e) => setOccupiedMonths(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tenant's stated intent</Label>
                      <Select value={tenantsIntent} onValueChange={setTenantsIntent}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {INTENTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-1">
                <Label className="text-xs">Attachments / Scanned documents</Label>
                <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Office & Reference</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Office handling complaint</Label>
                  <Select value={officeId} onValueChange={setOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Auto-picked by region" /></SelectTrigger>
                    <SelectContent>{offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name} ({o.region})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Docket ref (optional)</Label>
                  <Input value={docketRef} onChange={(e) => setDocketRef(e.target.value)} placeholder="Paper record id" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: live preview */}
        <div className="hidden lg:block">
          <Form7LivePreview data={previewData} />
        </div>
      </div>
    </div>
  );
};

export default AdminFileComplaint;

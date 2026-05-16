import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, FileText } from "lucide-react";
import PartySearchCombobox, { PartyMatch } from "@/components/PartySearchCombobox";
import LinkedPropertyPicker, { LinkedPropertySelection } from "@/components/LinkedPropertyPicker";

type Role = "tenant" | "landlord" | "interested_person";

const roleLabel: Record<Role, string> = {
  tenant: "Tenant",
  landlord: "Landlord",
  interested_person: "Interested Person",
};

const AdminFileComplaint = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [complainantRole, setComplainantRole] = useState<Role>("tenant");
  const [respondentRole, setRespondentRole] = useState<Role>("landlord");

  const [complainant, setComplainant] = useState<PartyMatch | null>(null);
  const [respondent, setRespondent] = useState<PartyMatch | null>(null);

  const [phName, setPhName] = useState({ c: "", r: "" });
  const [phPhone, setPhPhone] = useState({ c: "", r: "" });

  const [linkedProperty, setLinkedProperty] = useState<LinkedPropertySelection | null>(null);
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState("");
  const [rentAmount, setRentAmount] = useState("");

  const [complaintTypes, setComplaintTypes] = useState<any[]>([]);
  const [complaintTypeId, setComplaintTypeId] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [offices, setOffices] = useState<any[]>([]);
  const [officeId, setOfficeId] = useState("");
  const [docketRef, setDocketRef] = useState("");

  useEffect(() => {
    (async () => {
      const { data: types } = await supabase.from("complaint_types").select("*").eq("active", true).order("display_order");
      setComplaintTypes(types || []);
      const { data: offs } = await supabase.from("offices").select("*").order("name");
      setOffices(offs || []);
    })();
  }, []);

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

  const submit = async () => {
    const cName = complainant?.full_name || phName.c;
    const cPhone = complainant?.phone || phPhone.c;
    const rName = respondent?.full_name || phName.r;
    const rPhone = respondent?.phone || phPhone.r;

    if (!cName) return toast({ title: "Complainant name required", variant: "destructive" });
    if (!rName) return toast({ title: "Respondent name required", variant: "destructive" });
    if (!address) return toast({ title: "Property address required", variant: "destructive" });
    if (!region) return toast({ title: "Region required", variant: "destructive" });
    if (!complaintTypeId) return toast({ title: "Complaint type required", variant: "destructive" });
    if (!description) return toast({ title: "Description required", variant: "destructive" });
    if (!officeId) return toast({ title: "Office required", variant: "destructive" });

    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const adminId = auth.user?.id;

      // Upload evidence
      const evidenceUrls: string[] = [];
      for (const f of files) {
        const path = `admin-filed/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("application-evidence").upload(path, f);
        if (!upErr) evidenceUrls.push(path);
      }

      const ct = complaintTypes.find((t) => t.id === complaintTypeId);
      const code = `CMP-${Date.now().toString(36).toUpperCase()}`;

      const insertPayload: any = {
        complaint_code: code,
        complaint_type: ct?.label || "Other",
        complaint_type_id: complaintTypeId,
        landlord_name: respondentRole === "landlord" ? rName : (respondent?.full_name || phName.r || "—"),
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
        linked_property_id: linkedProperty?.property_id || null,
        linked_unit_id: linkedProperty?.unit_id || null,
      };

      if (complainant?.user_id) {
        insertPayload.tenant_user_id = complainant.user_id;
      } else {
        insertPayload.placeholder_complainant_name = cName;
        insertPayload.placeholder_complainant_phone = cPhone || null;
      }
      if (respondent?.user_id) {
        insertPayload.respondent_user_id = respondent.user_id;
      } else {
        insertPayload.placeholder_respondent_name = rName;
        insertPayload.placeholder_respondent_phone = rPhone || null;
      }

      const { data: created, error } = await supabase
        .from("complaints")
        .insert(insertPayload)
        .select("id, ticket_number, complaint_code")
        .single();
      if (error) throw error;

      // SMS — non-blocking
      const sendSms = async (phone: string, message: string) => {
        if (!phone) return;
        try {
          await supabase.functions.invoke("send-sms", { body: { phone, message } });
        } catch (e) { console.warn("SMS failed", e); }
      };
      const ticket = created.ticket_number;
      const officeName = offices.find((o) => o.id === officeId)?.name || "";
      if (cPhone) {
        const isOnPlatform = !!complainant?.user_id;
        await sendSms(
          cPhone,
          isOnPlatform
            ? `RentControl: A complaint (${ticket}) has been filed on your behalf at ${officeName}. Sign in to track it.`
            : `RentControl: A complaint (${ticket}) has been filed on your behalf at ${officeName}. Register at rentcontrolghana.com using ${cPhone} to track it.`
        );
      }
      if (rPhone) {
        const isOnPlatform = !!respondent?.user_id;
        await sendSms(
          rPhone,
          isOnPlatform
            ? `RentControl: A complaint (${ticket}) has been filed against you at ${officeName}. Sign in to respond.`
            : `RentControl: A complaint (${ticket}) has been filed against you at ${officeName}. Register at rentcontrolghana.com using ${rPhone} to respond.`
        );
      }

      toast({ title: "Complaint filed", description: `Ticket ${ticket}` });
      navigate("/regulator/complaints");
    } catch (e: any) {
      toast({ title: "Failed to file complaint", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const RoleSelect = ({ value, onChange }: { value: Role; onChange: (r: Role) => void }) => (
    <Select value={value} onValueChange={(v) => onChange(v as Role)}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {(["tenant", "landlord", "interested_person"] as Role[]).map((r) => (
          <SelectItem key={r} value={r}>{roleLabel[r]}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="h-6 w-6" /> File Complaint on Behalf</h1>
        <p className="text-sm text-muted-foreground">Admin-assisted intake — flows into the standard complaint workflow.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Complainant</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <RoleSelect value={complainantRole} onChange={setComplainantRole} />
          </div>
          <PartySearchCombobox
            label="Search existing user"
            value={complainant}
            onChange={setComplainant}
            roleFilter={partyRole(complainantRole)}
          />
          {!complainant && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Full name</Label><Input value={phName.c} onChange={(e) => setPhName({ ...phName, c: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={phPhone.c} onChange={(e) => setPhPhone({ ...phPhone, c: e.target.value })} placeholder="0XXXXXXXXX" /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Respondent</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <RoleSelect value={respondentRole} onChange={setRespondentRole} />
          </div>
          <PartySearchCombobox
            label="Search existing user"
            value={respondent}
            onChange={setRespondent}
            roleFilter={partyRole(respondentRole)}
          />
          {!respondent && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Full name</Label><Input value={phName.r} onChange={(e) => setPhName({ ...phName, r: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={phPhone.r} onChange={(e) => setPhPhone({ ...phPhone, r: e.target.value })} placeholder="0XXXXXXXXX" /></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Property / Premises</CardTitle></CardHeader>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Complaint</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Type</Label>
            <Select value={complaintTypeId} onValueChange={setComplaintTypeId}>
              <SelectTrigger><SelectValue placeholder="Select complaint type" /></SelectTrigger>
              <SelectContent>{complaintTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} /></div>
          <div className="space-y-1">
            <Label>Attachments / Scanned Documents</Label>
            <Input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Office & Reference</CardTitle></CardHeader>
        <CardContent className="space-y-3">
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

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate("/regulator/complaints")}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          File Complaint
        </Button>
      </div>
    </div>
  );
};

export default AdminFileComplaint;

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  StatutoryFormType,
  generateStatutoryForm,
  prefillForm7,
  prefillForm33,
  prefillForm32A,
} from "@/lib/complaintForms";
import { renderForm7 } from "@/lib/pdf/form7";
import { renderForm33 } from "@/lib/pdf/form33";
import { renderForm32A } from "@/lib/pdf/form32a";
import PdfLivePreview from "./PdfLivePreview";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  complaint: any;
  officeName?: string;
  formType: StatutoryFormType;
  /** Optional starting data — e.g. previous version's form_data_json (regenerate). */
  initialData?: Record<string, any>;
  onGenerated: () => void;
}

const TITLES: Record<StatutoryFormType, string> = {
  form_7: "Form 7 — Complaint",
  form_33: "Form 33 — Summons",
  form_32a: "Form 32A — Order / Decision",
};

const Field = ({ label, value, onChange, type = "text" }: any) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  </div>
);

const Area = ({ label, value, onChange, rows = 6 }: any) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <Textarea rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default function FormEditorDialog({
  open,
  onOpenChange,
  complaint,
  officeName,
  formType,
  initialData,
  onGenerated,
}: Props) {
  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(false);
  const [previewQr, setPreviewQr] = useState<string | undefined>(undefined);

  useEffect(() => {
    QRCode.toDataURL("https://www.rentcontrolghana.com/verify/form/PREVIEW", {
      width: 240, margin: 2, errorCorrectionLevel: "M",
    }).then(setPreviewQr).catch((e) => console.warn("FormEditor preview QR failed", e));
  }, []);


  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setData(initialData);
      return;
    }
    if (formType === "form_7") setData(prefillForm7(complaint, officeName));
    else if (formType === "form_33") setData(prefillForm33(complaint, officeName));
    else setData(prefillForm32A(complaint, officeName));
  }, [open, formType, complaint, officeName, initialData]);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const render = useMemo(() => {
    if (formType === "form_7") return renderForm7;
    if (formType === "form_33") return renderForm33;
    return renderForm32A;
  }, [formType]);

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await generateStatutoryForm(complaint.id, formType, data);
      // Auto-SMS respondents when Form 33 (Summons) is generated
      if (formType === "form_33") {
        try {
          const respondents: any[] = Array.isArray(complaint.respondents) ? complaint.respondents : [];
          const phones = respondents.map((r: any) => r?.phone).filter(Boolean);
          const fallback = complaint.placeholder_respondent_phone || data.respondent_phone;
          const targets = phones.length ? phones : (fallback ? [fallback] : []);
          if (targets.length) {
            const ref = complaint.complaint_code || complaint.case_number || data.case_number || complaint.id?.slice(0, 8);
            const when = data.hearing_date ? `${data.hearing_date}${data.hearing_time ? " " + data.hearing_time : ""}` : "TBA";
            const venue = data.hearing_venue || officeName || "Rent Control Office";
            const message = `Rent Control: You have been summoned for Case ${ref}. Hearing: ${when} at ${venue}. Please attend or contact Rent Control.`;
            for (const to of targets) {
              supabase.functions.invoke("send-sms", { body: { to, message } }).catch(() => {});
            }
            toast({ title: "Form 33 generated", description: `Summons SMS sent to ${targets.length} respondent(s).` });
          } else {
            toast({ title: "Form 33 generated", description: "Saved to Complaint Documents. No respondent phone on file — SMS not sent." });
          }
        } catch (e) {
          console.warn("Form 33 SMS dispatch failed", e);
          toast({ title: "Form 33 generated", description: "Saved, but summons SMS could not be sent." });
        }
      } else {
        toast({ title: `${TITLES[formType].split(" — ")[0]} generated`, description: "Saved to Complaint Documents." });
      }
      onOpenChange(false);
      onGenerated();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[92vh] flex flex-col p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{TITLES[formType]}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 px-5 pb-4 overflow-hidden min-h-0">
          {/* Editor */}
          <div className="overflow-y-auto pr-2 space-y-4">
            {formType === "form_7" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Case reference" value={data.case_reference} onChange={(v: any) => set("case_reference", v)} />
                  <Field label="Case number" value={data.case_number} onChange={(v: any) => set("case_number", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Complainant name" value={data.complainant_name} onChange={(v: any) => set("complainant_name", v)} />
                  <Field label="Telephone" value={data.complainant_telephone} onChange={(v: any) => set("complainant_telephone", v)} />
                </div>
                <Area label="Postal address of complainant" value={data.complainant_postal_address} rows={2} onChange={(v: any) => set("complainant_postal_address", v)} />
                <Area label="Name and address of person complained against" value={data.respondent_name_address} rows={3} onChange={(v: any) => set("respondent_name_address", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="House number" value={data.premises_house_no} onChange={(v: any) => set("premises_house_no", v)} />
                  <Field label="Rent office" value={data.rent_office} onChange={(v: any) => set("rent_office", v)} />
                </div>
                <Area label="Premises address" value={data.premises_address} rows={2} onChange={(v: any) => set("premises_address", v)} />
                <Field label="Complaint category" value={data.complaint_category} onChange={(v: any) => set("complaint_category", v)} />
                <Area label="Complaint statement (editable narrative)" value={data.complaint_statement} rows={10} onChange={(v: any) => set("complaint_statement", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Signature name" value={data.signature_name} onChange={(v: any) => set("signature_name", v)} />
                  <Field label="Signature date" type="date" value={(data.signature_date || "").slice(0, 10)} onChange={(v: any) => set("signature_date", v)} />
                </div>
                <Field label="Stamp text" value={data.stamp_text} onChange={(v: any) => set("stamp_text", v)} />
                <Field label="Footer slogan" value={data.footer_slogan} onChange={(v: any) => set("footer_slogan", v)} />
              </>
            )}

            {formType === "form_33" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Case prefix" value={data.case_prefix} onChange={(v: any) => set("case_prefix", v)} />
                  <Field label="Case number" value={data.case_number} onChange={(v: any) => set("case_number", v)} />
                  <Field label="Complaint category" value={data.complaint_category} onChange={(v: any) => set("complaint_category", v)} />
                </div>
                <Field label="Parties line (Complainant VRS Respondent)" value={data.parties_line} onChange={(v: any) => set("parties_line", v)} />

                {/* Complainant basics (prefilled, editable) */}
                <div className="rounded-md border border-border bg-muted/40 p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Complainant — basic details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Complainant name" value={data.complainant_name} onChange={(v: any) => set("complainant_name", v)} />
                    <Field label="Complainant phone" value={data.complainant_phone} onChange={(v: any) => set("complainant_phone", v)} />
                  </div>
                  <Area label="Complainant address" value={data.complainant_address} rows={2} onChange={(v: any) => set("complainant_address", v)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rent office" value={data.rent_office} onChange={(v: any) => set("rent_office", v)} />
                  <Field label="Rent officer" value={data.rent_officer} onChange={(v: any) => set("rent_officer", v)} />
                </div>
                <Field label="Person summoned (To:)" value={data.person_summoned} onChange={(v: any) => set("person_summoned", v)} />
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Hearing date" type="date" value={(data.hearing_date || "").slice(0, 10)} onChange={(v: any) => set("hearing_date", v)} />
                  <Field label="Hearing time" value={data.hearing_time} onChange={(v: any) => set("hearing_time", v)} />
                  <Field label="Hearing venue" value={data.hearing_venue} onChange={(v: any) => set("hearing_venue", v)} />
                </div>
                {data.hearing_date && (
                  <p className="text-xs text-muted-foreground">
                    Selected day: <span className="font-semibold text-foreground">{
                      (() => {
                        const dt = new Date(data.hearing_date);
                        if (isNaN(dt.getTime())) return "—";
                        const weekday = dt.toLocaleDateString("en-GB", { weekday: "long" });
                        const dd = String(dt.getDate()).padStart(2, "0");
                        const mm = String(dt.getMonth() + 1).padStart(2, "0");
                        const yyyy = dt.getFullYear();
                        return `${weekday}, ${dd}/${mm}/${yyyy}`;
                      })()
                    }</span>
                  </p>
                )}
                <Area label="Summons paragraph (leave blank to use the auto-generated bolded version)" value={data.summons_paragraph} rows={6} onChange={(v: any) => set("summons_paragraph", v)} />

                {/* Body font size */}
                <div className="space-y-1">
                  <Label className="text-xs flex items-center justify-between">
                    <span>Letter body font size</span>
                    <span className="text-muted-foreground">{data.body_font_size || 10}pt</span>
                  </Label>
                  <input
                    type="range"
                    min={9}
                    max={18}
                    step={1}
                    value={data.body_font_size || 10}
                    onChange={(e) => set("body_font_size", parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                  <div className="flex gap-1">
                    {[10, 12, 14, 16].map((sz) => (
                      <Button
                        key={sz}
                        type="button"
                        variant={(data.body_font_size || 10) === sz ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => set("body_font_size", sz)}
                      >
                        {sz}pt
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Issued office" value={data.issued_office} onChange={(v: any) => set("issued_office", v)} />
                  <Field label="Issued date" type="date" value={(data.issued_date || "").slice(0, 10)} onChange={(v: any) => set("issued_date", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Signature name" value={data.signature_name} onChange={(v: any) => set("signature_name", v)} />
                  <Field label="Stamp text" value={data.stamp_text} onChange={(v: any) => set("stamp_text", v)} />
                </div>
              </>
            )}

            {formType === "form_32a" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Case number" value={data.case_number} onChange={(v: any) => set("case_number", v)} />
                  <Field label="Hearing reference" value={data.hearing_reference} onChange={(v: any) => set("hearing_reference", v)} />
                </div>
                <Field label="Parties line" value={data.parties_line} onChange={(v: any) => set("parties_line", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Rent office" value={data.rent_office} onChange={(v: any) => set("rent_office", v)} />
                  <Field label="Rent officer" value={data.rent_officer} onChange={(v: any) => set("rent_officer", v)} />
                </div>
                <Area label="Decision / Order body (editable)" value={data.decision_body} rows={12} onChange={(v: any) => set("decision_body", v)} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Issued office" value={data.issued_office} onChange={(v: any) => set("issued_office", v)} />
                  <Field label="Issued date" type="date" value={(data.issued_date || "").slice(0, 10)} onChange={(v: any) => set("issued_date", v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Signature name" value={data.signature_name} onChange={(v: any) => set("signature_name", v)} />
                  <Field label="Stamp text" value={data.stamp_text} onChange={(v: any) => set("stamp_text", v)} />
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="hidden lg:block overflow-hidden min-h-0">
            <PdfLivePreview
              data={{ ...data, qr_data_url: data.qr_data_url || previewQr, verification_code: data.verification_code || "PREVIEW" }}
              render={render}
              label={`Live ${TITLES[formType].split(" — ")[0]} Preview`}
            />
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

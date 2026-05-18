import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FileSignature,
  FileText,
  Download,
  Eye,
  RefreshCw,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { signStorageUrl } from "@/lib/signStorageUrl";
import FormEditorDialog from "./FormEditorDialog";
import { StatutoryFormType } from "@/lib/complaintForms";
import { generateComplaintPdf } from "@/lib/generateComplaintPdf";

interface Props {
  complaint: any;
  officeName?: string;
  docs: any[];
  onChanged: () => void;
  onOpenGenericNew: () => void;
}

const FORM_LABELS: Record<StatutoryFormType, string> = {
  form_7: "Form 7",
  form_33: "Form 33",
  form_32a: "Form 32A",
};

const FORM_DESCS: Record<StatutoryFormType, string> = {
  form_7: "Complaint against conduct of landlord/tenant/person interested",
  form_33: "Summons to persons against whom complaints have been made",
  form_32a: "Order / Decision of Rent Officer",
};

export default function ComplaintDocumentsHub({
  complaint,
  officeName,
  docs,
  onChanged,
  onOpenGenericNew,
}: Props) {
  const [editor, setEditor] = useState<{
    open: boolean;
    type: StatutoryFormType;
    initial?: any;
  }>({ open: false, type: "form_7" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyProfile, setBusyProfile] = useState(false);

  const openEditor = (type: StatutoryFormType, initial?: any) =>
    setEditor({ open: true, type, initial });

  const openPdf = async (path: string) => {
    const url = await signStorageUrl(
      path.includes("/") ? path : `form-outputs/${path}`
    );
    if (url) window.open(url, "_blank");
  };
  const previewPdf = async (path: string) => {
    const url = await signStorageUrl(
      path.includes("/") ? path : `form-outputs/${path}`
    );
    if (url) setPreviewUrl(url);
  };

  const downloadProfile = async () => {
    setBusyProfile(true);
    try {
      const doc = generateComplaintPdf({
        complaintCode: complaint.complaint_code || complaint.ticket_number || complaint.id,
        ticketNumber: complaint.ticket_number,
        filedAt: complaint.created_at,
        status: complaint.status || complaint.current_stage || "—",
        paymentStatus: complaint.payment_status || "—",
        type: complaint.complaint_type || "—",
        description: complaint.description || "",
        region: complaint.region || "—",
        propertyAddress: complaint.property_address || "—",
        gpsLocation: complaint.gps_location,
        complainant: {
          name:
            complaint.placeholder_complainant_name ||
            complaint.complainant_name ||
            "—",
          phone: complaint.placeholder_complainant_phone,
          email: complaint.complainant_email,
          role: (complaint.complainant_role as any) || "tenant",
        },
        respondentName:
          complaint.placeholder_respondent_name ||
          complaint.landlord_name ||
          "—",
        evidenceUrls: complaint.evidence_urls || [],
        officeName,
      });
      doc.save(
        `complaint-${complaint.ticket_number || complaint.id}-profile.pdf`
      );
    } catch (e: any) {
      toast({
        title: "Could not generate profile",
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setBusyProfile(false);
    }
  };

  // Group docs by form_type
  const byType = (t: string) =>
    docs.filter((d) => d.form_type === t).sort((a, b) => b.version_number - a.version_number);
  const latest = (t: string) => byType(t)[0];

  const FormSection = ({ type }: { type: StatutoryFormType }) => {
    const versions = byType(type);
    const head = versions[0];
    return (
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <FileSignature className="h-4 w-4 text-primary" />
                <strong className="text-sm">{FORM_LABELS[type]}</strong>
                {head && (
                  <Badge variant="outline" className="text-[10px]">
                    v{head.version_number}
                  </Badge>
                )}
                {head && (
                  <Badge variant={head.status === "finalized" ? "default" : "secondary"} className="text-[10px]">
                    {head.status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{FORM_DESCS[type]}</p>
              {head && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Last generated {new Date(head.generated_at).toLocaleString()}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {head?.file_url && (
                <>
                  <Button size="sm" variant="outline" onClick={() => previewPdf(head.file_url)}>
                    <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPdf(head.file_url)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant={head ? "outline" : "default"}
                onClick={() => openEditor(type, head?.form_data_json || undefined)}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                {head ? "Regenerate" : `Generate ${FORM_LABELS[type]}`}
              </Button>
            </div>
          </div>

          {versions.length > 1 && (
            <div className="border-t pt-2 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">Previous versions</p>
              {versions.slice(1).map((v) => (
                <div key={v.id} className="flex items-center justify-between text-xs">
                  <span>
                    v{v.version_number} ·{" "}
                    {new Date(v.generated_at).toLocaleString()}
                  </span>
                  <div className="flex gap-1">
                    {v.file_url && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => previewPdf(v.file_url)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openPdf(v.file_url)}>
                          <Download className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {/* Quick downloads bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium">Complaint Documents</p>
              <p className="text-xs text-muted-foreground">
                Official Rent Control forms — preview, download, regenerate.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadProfile} disabled={busyProfile}>
                {busyProfile ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <FileText className="h-3.5 w-3.5 mr-1" />
                )}
                Download Complaint Profile
              </Button>
              <Button size="sm" onClick={onOpenGenericNew} variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1" /> Other Document
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <FormSection type="form_7" />
      <FormSection type="form_33" />
      <FormSection type="form_32a" />

      {/* Other docs */}
      {docs.some((d) => !["form_7", "form_33", "form_32a"].includes(d.form_type)) && (
        <Card>
          <CardContent className="pt-5 space-y-2">
            <p className="text-sm font-medium">Other documents</p>
            {docs
              .filter((d) => !["form_7", "form_33", "form_32a"].includes(d.form_type))
              .map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4" />
                      <strong>{d.title || d.form_type}</strong>
                      <Badge variant="outline">v{d.version_number}</Badge>
                      <Badge variant={d.status === "finalized" ? "default" : "secondary"}>{d.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {d.form_type} · {new Date(d.generated_at).toLocaleString()}
                    </p>
                  </div>
                  {d.file_url && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => previewPdf(d.file_url)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openPdf(d.file_url)}>
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      <FormEditorDialog
        open={editor.open}
        onOpenChange={(v) => setEditor((s) => ({ ...s, open: v }))}
        complaint={complaint}
        officeName={officeName}
        formType={editor.type}
        initialData={editor.initial}
        onGenerated={onChanged}
      />

      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4">
            <DialogTitle>Document preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} className="flex-1 w-full" title="Preview" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

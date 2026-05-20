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
  Receipt as ReceiptIcon,
  Printer,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import FormEditorDialog from "./FormEditorDialog";
import { StatutoryFormType } from "@/lib/complaintForms";
import { generateComplaintPdf } from "@/lib/generateComplaintPdf";
import PaymentReceipt from "@/components/PaymentReceipt";

interface Props {
  complaint: any;
  officeName?: string;
  docs: any[];
  receipts?: any[];
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

// Resolve a stored file_url to a signed URL. Handles:
//   - full https URLs from supabase storage
//   - bare paths like "complaints/{id}/form-7-v1.pdf" (assumed in form-outputs bucket)
//   - "bucket/path" combos
async function resolvePdfUrl(stored: string): Promise<string | null> {
  if (!stored) return null;
  if (/^https?:\/\//i.test(stored)) return stored;
  // Treat as bare storage path inside the form-outputs bucket
  const { data, error } = await supabase.storage
    .from("form-outputs")
    .createSignedUrl(stored, 3600);
  if (error || !data?.signedUrl) {
    console.error("Failed to sign storage URL", stored, error);
    return null;
  }
  return data.signedUrl;
}

export default function ComplaintDocumentsHub({
  complaint,
  officeName,
  docs,
  receipts = [],
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
  const [receiptPreview, setReceiptPreview] = useState<any | null>(null);

  const complaintTable: "complaints" | "landlord_complaints" =
    complaint?.complainant_role === "landlord" && complaint?.landlord_id && !complaint?.tenant_id
      ? "landlord_complaints"
      : "complaints";

  const parseSplits = (raw: any): Array<{ recipient: string; amount: number }> => {
    if (!raw) return [];
    try {
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(arr)) return arr.map((s: any) => ({ recipient: s.recipient || s.name || "—", amount: Number(s.amount || 0) }));
      if (typeof arr === "object") {
        return Object.entries(arr).map(([recipient, amount]) => ({ recipient, amount: Number(amount as any) || 0 }));
      }
    } catch {}
    return [];
  };

  const openEditor = (type: StatutoryFormType, initial?: any) =>
    setEditor({ open: true, type, initial });

  const openPdf = async (path: string) => {
    const url = await resolvePdfUrl(path);
    if (url) window.open(url, "_blank");
    else toast({ title: "Could not open document", description: "File not found in storage.", variant: "destructive" });
  };
  const previewPdf = async (path: string) => {
    const url = await resolvePdfUrl(path);
    if (url) setPreviewUrl(url);
    else toast({ title: "Could not preview", description: "File not found in storage.", variant: "destructive" });
  };

  const downloadProfile = async () => {
    setBusyProfile(true);
    try {
      generateComplaintPdf({
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

      {/* Payment receipts */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ReceiptIcon className="h-4 w-4 text-primary" />
              <strong className="text-sm">Payment Receipts</strong>
              <Badge variant="outline" className="text-[10px]">{receipts.length}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Auto-attached on successful payment.
            </p>
          </div>
          {receipts.length === 0 ? (
            <p className="text-xs text-muted-foreground">No receipts yet for this case.</p>
          ) : (
            <div className="space-y-2">
              {receipts.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border p-3 text-sm flex-wrap gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ReceiptIcon className="h-4 w-4 text-muted-foreground" />
                      <strong>{r.receipt_number}</strong>
                      <Badge variant="outline" className="text-[10px]">{r.payment_type?.replace(/_/g, " ")}</Badge>
                      <Badge
                        variant={r.receipt_status === "active" || r.status === "active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {r.receipt_status || r.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {r.payer_name || "—"} ·{" "}
                      {new Date(r.payment_date || r.created_at).toLocaleString()} · GHS{" "}
                      {Number(r.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => setReceiptPreview(r)} title="Preview">
                      <Eye className="h-3.5 w-3.5 mr-1" /> Preview
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReceiptPreview(r)} title="Download (use PDF button in preview)">
                      <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReceiptPreview(r)} title="Print (use Print button in preview)">
                      <Printer className="h-3.5 w-3.5 mr-1" /> Print
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>


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

      <Dialog open={!!receiptPreview} onOpenChange={(v) => !v && setReceiptPreview(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payment Receipt</DialogTitle>
          </DialogHeader>
          {receiptPreview && (
            <PaymentReceipt
              receiptNumber={receiptPreview.receipt_number}
              date={receiptPreview.payment_date || receiptPreview.created_at}
              payerName={receiptPreview.payer_name || "—"}
              totalAmount={Number(receiptPreview.total_amount || 0)}
              paymentType={receiptPreview.payment_type}
              description={receiptPreview.description || ""}
              splits={parseSplits(receiptPreview.split_breakdown)}
              status={receiptPreview.receipt_status || receiptPreview.status || "active"}
              qrCodeData={receiptPreview.qr_code_data || receiptPreview.receipt_number}
              complaintId={receiptPreview.case_id || complaint?.id}
              complaintTable={complaintTable}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

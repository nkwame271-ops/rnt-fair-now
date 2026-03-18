import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { generateTenancyCardPdf } from "@/lib/generateTenancyCardPdf";
import { differenceInDays, format } from "date-fns";

export interface TenancyCardData {
  tenancyId: string;
  registrationCode: string;
  propertyId: string;
  digitalAddress: string;
  landlordName: string;
  tenantName: string;
  monthlyRent: number;
  maxLawfulAdvance: number;
  advancePaid: number;
  startDate: string;
  expiryDate: string;
  assessmentId?: string;
  complianceStatus: string;
  status: string;
  rentCardSerial?: string;
}

const statusColor = (status: string) => {
  if (["active"].includes(status)) return "bg-success/10 text-success border-success/20";
  if (["renewal_window", "renewal_pending"].includes(status)) return "bg-warning/10 text-warning border-warning/20";
  if (["expired", "terminated"].includes(status)) return "bg-destructive/10 text-destructive border-destructive/20";
  return "bg-muted text-muted-foreground border-border";
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    active: "Active",
    pending: "Pending",
    renewal_window: "Renewal Window",
    renewal_pending: "Renewal Pending",
    renewal_pending_assessment: "Pending Assessment",
    renewal_pending_confirmation: "Pending Confirmation",
    renewal_pending_payment: "Pending Payment",
    expired: "Expired",
    terminated: "Terminated",
    existing_declared: "Existing — Declared",
    awaiting_verification: "Awaiting Verification",
    verified_existing: "Verified Existing",
  };
  return map[status] || status;
};

const TenancyCard = ({ data }: { data: TenancyCardData }) => {
  const daysRemaining = differenceInDays(new Date(data.expiryDate), new Date());
  const qrValue = `RENT-CONTROL|${data.registrationCode}|${data.tenancyId}`;

  const handleDownload = () => {
    const doc = generateTenancyCardPdf(data);
    doc.save(`TenancyCard_${data.registrationCode}.pdf`);
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className={`h-1.5 ${daysRemaining > 90 ? "bg-success" : daysRemaining > 0 ? "bg-warning" : "bg-destructive"}`} />
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Tenancy ID</p>
            <p className="font-mono font-bold text-primary text-sm">{data.registrationCode}</p>
          </div>
          <Badge className={statusColor(data.status)}>{statusLabel(data.status)}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div><p className="text-muted-foreground text-xs">Property ID</p><p className="font-semibold">{data.propertyId.slice(0, 8)}...</p></div>
          <div><p className="text-muted-foreground text-xs">Digital Address</p><p className="font-semibold">{data.digitalAddress || "—"}</p></div>
          <div><p className="text-muted-foreground text-xs">Landlord</p><p className="font-semibold">{data.landlordName}</p></div>
          <div><p className="text-muted-foreground text-xs">Tenant</p><p className="font-semibold">{data.tenantName}</p></div>
          <div><p className="text-muted-foreground text-xs">Monthly Rent (Approved)</p><p className="font-semibold">GH₵ {data.monthlyRent.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground text-xs">Max Lawful Advance</p><p className="font-semibold">GH₵ {data.maxLawfulAdvance.toLocaleString()}</p></div>
          <div><p className="text-muted-foreground text-xs">Advance Paid</p><p className="font-semibold">{data.advancePaid} month(s)</p></div>
          <div><p className="text-muted-foreground text-xs">Compliance</p><p className={`font-semibold ${data.complianceStatus === "compliant" ? "text-success" : "text-destructive"}`}>{data.complianceStatus}</p></div>
          <div><p className="text-muted-foreground text-xs">Start Date</p><p className="font-semibold">{format(new Date(data.startDate), "dd/MM/yyyy")}</p></div>
          <div><p className="text-muted-foreground text-xs">Expiry Date</p><p className="font-semibold">{format(new Date(data.expiryDate), "dd/MM/yyyy")}</p></div>
          {data.rentCardSerial && (
            <div><p className="text-muted-foreground text-xs">Rent Card</p><p className="font-mono font-semibold text-primary text-xs">{data.rentCardSerial}</p></div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <QRCodeSVG value={qrValue} size={56} />
            <div>
              <p className={`text-sm font-bold ${daysRemaining > 90 ? "text-success" : daysRemaining > 0 ? "text-warning" : "text-destructive"}`}>
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : "Expired"}
              </p>
              {data.assessmentId && <p className="text-xs text-muted-foreground">Assessment: {data.assessmentId.slice(0, 8)}...</p>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1" /> PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TenancyCard;

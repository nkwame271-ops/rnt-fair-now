import { useState } from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle2, Clock, Download, Shield, AlertTriangle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tenantAgreements } from "@/data/dummyData";
import { generateAgreementPdf } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link } from "react-router-dom";

// Simulated pending agreement (from landlord's AddTenant flow)
const pendingAgreement = {
  id: "AGR-PENDING-001",
  registrationCode: "RC-GR-2026-08412",
  landlordName: "Nana Agyemang",
  propertyName: "Cantonments Executive",
  propertyAddress: "7th Avenue, Cantonments",
  unitName: "Suite B",
  unitType: "2-Bedroom" as const,
  monthlyRent: 3000,
  advanceMonths: 6,
  startDate: "2026-03-01",
  endDate: "2026-08-31",
  region: "Greater Accra",
  status: "pending" as const,
};

const MyAgreements = () => {
  const [pendingAccepted, setPendingAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const agreement = tenantAgreements[0];
  const paidMonths = agreement.payments.filter((p) => p.taxPaid).length;
  const totalMonths = agreement.payments.length;

  const handleAccept = () => {
    setAccepting(true);
    setTimeout(() => {
      setAccepting(false);
      setPendingAccepted(true);
      toast.success("Agreement accepted! Pay the 8% tax to validate your tenancy.");
    }, 2000);
  };

  const handleDownload = (agr: typeof agreement | typeof pendingAgreement) => {
    const doc = generateAgreementPdf({
      registrationCode: "registrationCode" in agr ? agr.registrationCode : agreement.registrationCode,
      landlordName: "landlordName" in agr ? agr.landlordName : agreement.landlordName,
      tenantName: "Kwame Mensah",
      tenantId: "TN-2026-0001",
      propertyName: agr.propertyName,
      propertyAddress: agr.propertyAddress,
      unitName: agr.unitName,
      unitType: agr.unitType,
      monthlyRent: agr.monthlyRent,
      advanceMonths: agr.advanceMonths,
      startDate: agr.startDate,
      endDate: agr.endDate,
      region: "Greater Accra",
    });
    doc.save(`Tenancy_Agreement_${agr.id}.pdf`);
    toast.success("Agreement PDF downloaded!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Agreements</h1>
        <p className="text-muted-foreground mt-1">View, accept, and download your tenancy agreements</p>
      </div>

      {/* Pending Agreement */}
      {!pendingAccepted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-elevated border-2 border-warning/40 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-card-foreground">Pending Agreement — Action Required</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your landlord <strong>{pendingAgreement.landlordName}</strong> has created a tenancy agreement for you. Review the details below and accept to proceed.
          </p>

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Property", pendingAgreement.propertyName],
              ["Address", pendingAgreement.propertyAddress],
              ["Unit", `${pendingAgreement.unitName} (${pendingAgreement.unitType})`],
              ["Monthly Rent", `GH₵ ${pendingAgreement.monthlyRent.toLocaleString()}`],
              ["Advance", `${pendingAgreement.advanceMonths} month(s)`],
              ["Period", `${new Date(pendingAgreement.startDate).toLocaleDateString("en-GB")} — ${new Date(pendingAgreement.endDate).toLocaleDateString("en-GB")}`],
              ["8% Tax/mo", `GH₵ ${(pendingAgreement.monthlyRent * 0.08).toLocaleString()}`],
              ["To Landlord/mo", `GH₵ ${(pendingAgreement.monthlyRent * 0.92).toLocaleString()}`],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-muted-foreground">{label}</span>
                <div className="font-semibold text-card-foreground">{value}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={() => handleDownload(pendingAgreement)}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {accepting ? "Processing..." : "Accept Agreement"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Just accepted — prompt to pay */}
      {pendingAccepted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/5 border border-success/20 rounded-xl p-5 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-foreground text-sm">Agreement Accepted!</div>
            <p className="text-sm text-muted-foreground mt-1">
              Your agreement with {pendingAgreement.landlordName} is accepted. Now pay the 8% government tax to validate your tenancy.
            </p>
            <Link to="/tenant/payments" className="inline-flex items-center gap-1 text-sm text-primary font-medium mt-2 hover:underline">
              <CreditCard className="h-3.5 w-3.5" /> Go to Payments
            </Link>
          </div>
        </motion.div>
      )}

      {/* Active Agreement */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Active Agreements</h2>
        <div className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-card-foreground text-lg">{agreement.propertyName}</h3>
              <p className="text-sm text-muted-foreground">{agreement.propertyAddress} • {agreement.unitName} ({agreement.unitType})</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
              <Shield className="h-3 w-3" /> Registered
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Landlord</div>
              <div className="font-semibold">{agreement.landlordName}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Monthly Rent</div>
              <div className="font-semibold">GH₵ {agreement.monthlyRent.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Registration</div>
              <div className="font-semibold text-xs">{agreement.registrationCode}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Validity</div>
              <div className="font-semibold">{paidMonths}/{totalMonths} months</div>
            </div>
          </div>

          {/* Validity bar */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{paidMonths} of {totalMonths} months validated</span>
              <span>{Math.round((paidMonths / totalMonths) * 100)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${(paidMonths / totalMonths) * 100}%` }} />
            </div>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {agreement.payments.map((p) => (
              <div key={p.id} className={`text-center p-2 rounded-lg text-xs font-medium ${p.taxPaid ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {p.taxPaid ? <Shield className="h-3 w-3 mx-auto mb-0.5" /> : <Clock className="h-3 w-3 mx-auto mb-0.5" />}
                {p.month.split(" ")[0].slice(0, 3)}
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => handleDownload(agreement)}>
              <Download className="h-4 w-4 mr-1" /> Download PDF
            </Button>
            <Link to="/tenant/payments">
              <Button size="sm">
                <CreditCard className="h-4 w-4 mr-1" /> Pay Rent
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAgreements;

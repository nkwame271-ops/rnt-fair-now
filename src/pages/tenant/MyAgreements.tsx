import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, CheckCircle2, Download, Shield, AlertTriangle, CreditCard, Loader2, XCircle, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateAgreementPdf } from "@/lib/generateAgreementPdf";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RatingDialog from "@/components/RatingDialog";
import DigitalSignatureDialog from "@/components/DigitalSignatureDialog";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

interface CustomFieldDef {
  label: string;
  type: string;
  required: boolean;
}

interface TenancyView {
  id: string;
  registration_code: string;
  agreed_rent: number;
  advance_months: number;
  start_date: string;
  end_date: string;
  status: string;
  tenant_accepted: boolean | null;
  landlord_accepted: boolean | null;
  landlordName: string;
  propertyName: string;
  propertyAddress: string;
  unitName: string;
  unitType: string;
  region: string;
  paidCount: number;
  totalPayments: number;
  customFieldValues: Record<string, string>;
  landlord_user_id: string;
  landlord_signed_at: string | null;
  tenant_signed_at: string | null;
  tenancy_type: string | null;
  tax_compliance_status: string;
  agreement_pdf_url: string | null;
  final_agreement_pdf_url: string | null;
}

const MyAgreements = () => {
  const { user } = useAuth();
  const { enabled: digitalSignaturesEnabled } = useFeatureFlag("digital_signatures");
  const [tenancies, setTenancies] = useState<TenancyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState("");
  const [tenantIdCode, setTenantIdCode] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [signingTenancyId, setSigningTenancyId] = useState<string | null>(null);
  const [payingTax, setPayingTax] = useState<string | null>(null);
  const [verifyingTenancyId, setVerifyingTenancyId] = useState<string | null>(null);
  const autoVerificationTriggeredRef = useRef(false);

  const isPaidRecord = (payment: { status: string; tenant_marked_paid: boolean | null; landlord_confirmed: boolean | null }) => {
    return payment.tenant_marked_paid || payment.landlord_confirmed || payment.status === "confirmed" || payment.status === "tenant_paid";
  };

  const clearPaymentRedirectFlags = () => {
    sessionStorage.removeItem("paymentSuccessRedirected");
    sessionStorage.removeItem("paymentSuccessTenancyId");
    sessionStorage.removeItem("pendingPaymentTenancyId");
  };

  const fetchData = async () => {
    if (!user) return;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
    setTenantName(profile?.full_name || "");
    const { data: tenantRec } = await supabase.from("tenants").select("tenant_id").eq("user_id", user.id).single();
    setTenantIdCode(tenantRec?.tenant_id || "");

    const { data: configData } = await supabase.from("agreement_template_config").select("*").limit(1).single();
    if (configData) setCustomFields((configData as any).custom_fields || []);

    const { data: ts } = await supabase
      .from("tenancies")
      .select("*, unit:units(unit_name, unit_type, property_id)")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false });

    if (!ts || ts.length === 0) { setLoading(false); return; }

    const results: TenancyView[] = [];
    for (const t of ts as any[]) {
      const { data: prop } = await supabase.from("properties").select("property_name, address, region").eq("id", t.unit.property_id).single();
      const { data: landlordProfile } = await supabase.from("profiles").select("full_name").eq("user_id", t.landlord_user_id).single();
      const { data: payments } = await supabase.from("rent_payments").select("status, tenant_marked_paid, landlord_confirmed").eq("tenancy_id", t.id);
      const paidCount = (payments || []).filter((p: any) => isPaidRecord(p)).length;

      results.push({
        id: t.id,
        registration_code: t.registration_code,
        agreed_rent: t.agreed_rent,
        advance_months: t.advance_months,
        start_date: t.start_date,
        end_date: t.end_date,
        status: t.status,
        tenant_accepted: t.tenant_accepted,
        landlord_accepted: t.landlord_accepted,
        landlordName: landlordProfile?.full_name || "Unknown",
        propertyName: prop?.property_name || "Property",
        propertyAddress: prop?.address || "",
        unitName: t.unit.unit_name,
        unitType: t.unit.unit_type,
        region: prop?.region || "",
        paidCount,
        totalPayments: (payments || []).length,
        customFieldValues: (t as any).custom_field_values || {},
        landlord_user_id: t.landlord_user_id,
        landlord_signed_at: t.landlord_signed_at || null,
        tenant_signed_at: t.tenant_signed_at || null,
        tenancy_type: (t as any).tenancy_type || null,
        tax_compliance_status: (t as any).tax_compliance_status || "pending",
        agreement_pdf_url: (t as any).agreement_pdf_url || null,
        final_agreement_pdf_url: (t as any).final_agreement_pdf_url || null,
      });
    }
    setTenancies(results);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleReject = async (tenancyId: string) => {
    setRejecting(tenancyId);
    try {
      // Update tenancy status — the DB trigger handles cascading unit/property reset
      const { error } = await supabase.from("tenancies").update({ status: "rejected", tenant_accepted: false } as any).eq("id", tenancyId);
      if (error) throw error;

      setTenancies(prev => prev.map(t => t.id === tenancyId ? { ...t, status: "rejected", tenant_accepted: false } : t));
      toast.success("Agreement rejected. Your landlord has been notified.");
    } catch (err: any) {
      toast.error(err.message || "Failed to reject");
    } finally {
      setRejecting(null);
    }
  };

  const verifyPayment = async (tenancyId: string): Promise<boolean> => {
    // First, try to force-verify via the verify-payment edge function using stored reference
    const pendingRef = sessionStorage.getItem("pendingPaymentReference");
    if (pendingRef) {
      try {
        console.log("[verifyPayment] Calling verify-payment with reference:", pendingRef);
        const { data: vData, error: fnError } = await supabase.functions.invoke("verify-payment", {
          body: { reference: pendingRef },
        });
        if (fnError) {
          console.error("[verifyPayment] Edge function error:", fnError);
        } else if (vData?.verified) {
          console.log("[verifyPayment] Server confirmed payment for ref:", pendingRef);
          sessionStorage.removeItem("pendingPaymentReference");
          return true;
        } else {
          console.warn("[verifyPayment] verify-payment returned:", vData);
        }
      } catch (err) {
        console.error("[verifyPayment] Exception calling verify-payment:", err);
      }
    }

    // Check rent_payments for tenant_paid or confirmed
    const { data: payments } = await supabase
      .from("rent_payments")
      .select("id, status")
      .eq("tenancy_id", tenancyId)
      .in("status", ["confirmed", "tenant_paid"])
      .limit(1);
    if (payments && payments.length > 0) return true;

    // Fallback: check escrow_transactions for completed rent_tax_bulk
    const { data: escrow } = await supabase
      .from("escrow_transactions")
      .select("id, status")
      .eq("related_tenancy_id", tenancyId)
      .eq("payment_type", "rent_tax_bulk")
      .eq("status", "completed")
      .limit(1);
    if (escrow && escrow.length > 0) return true;

    return false;
  };

  const verifyPaymentWithRetry = async (tenancyId: string) => {
    setVerifyingTenancyId(tenancyId);

    for (let attempt = 0; attempt < 5; attempt++) {
      const paid = await verifyPayment(tenancyId);
      if (paid) return true;

      if (attempt === 0) {
        toast.info("Verifying payment... please wait.");
      }

      if (attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    return false;
  };

  const markAgreementAccepted = async (tenancyId: string) => {
    await supabase.from("tenancies").update({
      tenant_accepted: true,
      status: "pending",
    }).eq("id", tenancyId);

    setTenancies(prev => prev.map(t => t.id === tenancyId ? { ...t, tenant_accepted: true } : t));
    setSigningTenancyId(tenancyId);
  };

  // Accept existing tenancy (no tax payment required)
  const handleAcceptExistingTenancy = async (tenancyId: string) => {
    setPayingTax(tenancyId);
    try {
      const t = tenancies.find(x => x.id === tenancyId);
      if (!t) throw new Error("Tenancy not found");

      // Generate signed PDF
      let finalPdfUrl: string | null = null;
      try {
        const { data: tplConfig } = await supabase.from("agreement_template_config").select("*").limit(1).single();
        const pdfData = {
          tenancyId: t.id,
          registrationCode: t.registration_code,
          landlordName: t.landlordName,
          tenantName,
          tenantId: tenantIdCode,
          propertyName: t.propertyName,
          propertyAddress: t.propertyAddress,
          unitName: t.unitName,
          unitType: t.unitType,
          monthlyRent: t.agreed_rent,
          advanceMonths: t.advance_months,
          startDate: t.start_date,
          endDate: t.end_date,
          region: t.region,
          isExistingTenancy: !t.agreement_pdf_url,
          templateConfig: tplConfig ? {
            max_advance_months: tplConfig.max_advance_months,
            min_lease_duration: tplConfig.min_lease_duration,
            max_lease_duration: tplConfig.max_lease_duration,
            tax_rate: tplConfig.tax_rate,
            registration_deadline_days: tplConfig.registration_deadline_days,
            terms: tplConfig.terms,
          } : undefined,
          landlordSignature: t.landlord_signed_at ? { name: t.landlordName, signedAt: t.landlord_signed_at, method: "Digital (Auto)" } : undefined,
          tenantSignature: { name: tenantName, signedAt: new Date().toISOString(), method: "Digital" },
        };
        const doc = await generateAgreementPdf(pdfData);
        const pdfBlob = doc.output("blob");
        const pdfPath = `signed-agreements/${user!.id}/${Date.now()}_${t.registration_code}_signed.pdf`;
        const { error: uploadErr } = await supabase.storage.from("application-evidence").upload(pdfPath, pdfBlob, { contentType: "application/pdf" });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("application-evidence").getPublicUrl(pdfPath);
          finalPdfUrl = urlData.publicUrl;
        }
      } catch (pdfErr) {
        console.error("Failed to generate signed PDF:", pdfErr);
      }

      await supabase.from("tenancies").update({
        tenant_accepted: true,
        tenant_signed_at: new Date().toISOString(),
        ...(finalPdfUrl ? { final_agreement_pdf_url: finalPdfUrl } : {}),
      } as any).eq("id", tenancyId);

      setTenancies(prev => prev.map(x => x.id === tenancyId ? {
        ...x,
        tenant_accepted: true,
        tenant_signed_at: new Date().toISOString(),
        final_agreement_pdf_url: finalPdfUrl || x.final_agreement_pdf_url,
      } : x));
      toast.success("Existing tenancy confirmed!");
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm tenancy");
    } finally {
      setPayingTax(null);
    }
  };

  const handleAcceptAndPay = async (tenancyId: string) => {
    setPayingTax(tenancyId);
    try {
      if (digitalSignaturesEnabled) {
        const paid = await verifyPaymentWithRetry(tenancyId);

        if (!paid) {
          clearPaymentRedirectFlags();
          toast.error("Payment not yet confirmed. Please go to Payments to pay your first month's tax, then return here.");
          return;
        }

        clearPaymentRedirectFlags();
        await markAgreementAccepted(tenancyId);
      } else {
        // Legacy: just accept
        await supabase.from("tenancies").update({
          tenant_accepted: true,
          status: "active",
        }).eq("id", tenancyId);
        setTenancies(prev => prev.map(t => t.id === tenancyId ? { ...t, tenant_accepted: true, status: "active" } : t));
        toast.success("Agreement accepted! Pay the 8% tax to validate your tenancy.");
        setPayingTax(null);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to accept");
    } finally {
      setPayingTax(null);
      setVerifyingTenancyId(null);
    }
  };

  useEffect(() => {
    if (loading || !digitalSignaturesEnabled || autoVerificationTriggeredRef.current) return;

    const paymentRedirected = sessionStorage.getItem("paymentSuccessRedirected") === "true";
    if (!paymentRedirected) return;

    const targetTenancyId = sessionStorage.getItem("paymentSuccessTenancyId");
    const targetTenancy = tenancies.find((tenancy) => tenancy.id === targetTenancyId && !tenancy.tenant_accepted && tenancy.status === "pending")
      || tenancies.find((tenancy) => !tenancy.tenant_accepted && tenancy.status === "pending");

    if (!targetTenancy) {
      clearPaymentRedirectFlags();
      return;
    }

    autoVerificationTriggeredRef.current = true;
    void handleAcceptAndPay(targetTenancy.id);
  }, [digitalSignaturesEnabled, loading, tenancies]);

  const handleDownload = async (t: TenancyView) => {
    const doc = await generateAgreementPdf({
      tenancyId: t.id,
      registrationCode: t.registration_code,
      landlordName: t.landlordName,
      tenantName,
      tenantId: tenantIdCode,
      propertyName: t.propertyName,
      propertyAddress: t.propertyAddress,
      unitName: t.unitName,
      unitType: t.unitType,
      monthlyRent: t.agreed_rent,
      advanceMonths: t.advance_months,
      startDate: t.start_date,
      endDate: t.end_date,
      region: t.region,
      landlordSignature: t.landlord_signed_at ? { name: t.landlordName, signedAt: t.landlord_signed_at, method: "Digital (Auto)" } : undefined,
      tenantSignature: t.tenant_signed_at ? { name: tenantName, signedAt: t.tenant_signed_at, method: "Digital" } : undefined,
    });
    doc.save(`Tenancy_Agreement_${t.registration_code}.pdf`);
    toast.success("Agreement PDF downloaded!");
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const isPast = (t: TenancyView) => ["expired", "terminated", "archived"].includes(t.status);
  const pending = tenancies.filter(t => !t.tenant_accepted && t.status === "pending");
  const existingPending = tenancies.filter(t => !t.tenant_accepted && t.status === "existing_declared");
  const active = tenancies.filter(t => (t.tenant_accepted || t.status === "active") && t.status !== "rejected" && !isPast(t));
  const past = tenancies.filter(isPast);
  const rejected = tenancies.filter(t => t.status === "rejected");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">My Agreements</h1>
        <p className="text-muted-foreground mt-1">View, accept, and download your tenancy agreements</p>
      </div>

      {/* Pending */}
      {pending.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-elevated border-2 border-warning/40 space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <h2 className="text-lg font-semibold text-card-foreground">Pending Agreement — Action Required</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your landlord <strong>{t.landlordName}</strong> has created a tenancy agreement for you. Review and accept or reject.
          </p>
          {t.landlord_signed_at && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2">
              <PenLine className="h-3.5 w-3.5" />
              <span>Landlord signed on {new Date(t.landlord_signed_at).toLocaleDateString("en-GB")}</span>
            </div>
          )}
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Property", t.propertyName],
              ["Address", t.propertyAddress],
              ["Unit", `${t.unitName} (${t.unitType})`],
              ["Monthly Rent", `GH₵ ${t.agreed_rent.toLocaleString()}`],
              ["Advance", `${t.advance_months} month(s)`],
              ["Period", `${new Date(t.start_date).toLocaleDateString("en-GB")} — ${new Date(t.end_date).toLocaleDateString("en-GB")}`],
              ["8% Tax/mo", `GH₵ ${(t.agreed_rent * 0.08).toLocaleString()}`],
              ["To Landlord/mo", `GH₵ ${(t.agreed_rent * 0.92).toLocaleString()}`],
              ...customFields.map(f => [f.label, t.customFieldValues[f.label] || "—"]),
            ].map(([label, value]) => (
              <div key={label}><span className="text-muted-foreground">{label}</span><div className="font-semibold text-card-foreground">{value}</div></div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={() => handleDownload(t)}><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(t.id)}
              disabled={rejecting === t.id}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {rejecting === t.id ? "Rejecting..." : "Reject"}
            </Button>
            <Button onClick={() => handleAcceptAndPay(t.id)} disabled={payingTax === t.id}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {verifyingTenancyId === t.id ? "Verifying payment..." : payingTax === t.id ? "Processing..." : digitalSignaturesEnabled ? "Accept & Sign" : "Accept Agreement"}
            </Button>
          </div>
        </motion.div>
      ))}

      {/* Existing Tenancy — Pending Confirmation */}
      {existingPending.map(t => (
        <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-6 shadow-elevated border-2 border-info/40 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-info" />
            <h2 className="text-lg font-semibold text-card-foreground">Existing Tenancy — Confirm Your Agreement</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Your landlord <strong>{t.landlordName}</strong> has declared an existing tenancy for you. Review the details and confirm.
          </p>
          {t.landlord_signed_at && (
            <div className="flex items-center gap-2 text-xs text-success bg-success/5 border border-success/20 rounded-lg px-3 py-2">
              <PenLine className="h-3.5 w-3.5" />
              <span>Landlord signed on {new Date(t.landlord_signed_at).toLocaleDateString("en-GB")}</span>
            </div>
          )}
          {/* Tax compliance badge */}
          <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
            t.tax_compliance_status === "verified" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}>
            <Shield className="h-3 w-3" />
            Tax Compliance: {t.tax_compliance_status === "verified" ? "Verified" : "Pending"}
          </div>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Property", t.propertyName],
              ["Address", t.propertyAddress],
              ["Unit", `${t.unitName} (${t.unitType})`],
              ["Monthly Rent", `GH₵ ${t.agreed_rent.toLocaleString()}`],
              ["Advance Paid", `${t.advance_months} month(s)`],
              ["Period", `${new Date(t.start_date).toLocaleDateString("en-GB")} — ${new Date(t.end_date).toLocaleDateString("en-GB")}`],
            ].map(([label, value]) => (
              <div key={label}><span className="text-muted-foreground">{label}</span><div className="font-semibold text-card-foreground">{value}</div></div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {(t.agreement_pdf_url || t.final_agreement_pdf_url) && (
              <a href={t.final_agreement_pdf_url || t.agreement_pdf_url || "#"} target="_blank" rel="noopener noreferrer">
                <Button variant="outline"><Download className="h-4 w-4 mr-1" /> Download Agreement</Button>
              </a>
            )}
            <Button
              variant="destructive"
              onClick={() => handleReject(t.id)}
              disabled={rejecting === t.id}
            >
              <XCircle className="h-4 w-4 mr-1" />
              {rejecting === t.id ? "Rejecting..." : "Reject"}
            </Button>
            <Button onClick={() => handleAcceptExistingTenancy(t.id)} disabled={payingTax === t.id}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {payingTax === t.id ? "Processing..." : "Confirm Tenancy"}
            </Button>
          </div>
        </motion.div>
      ))}

      {/* Active */}
      {active.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Active Agreements</h2>
          <div className="space-y-4">
            {active.map(t => (
              <div key={t.id} className="bg-card rounded-xl p-6 shadow-card border border-border space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-card-foreground text-lg">{t.propertyName}</h3>
                    <p className="text-sm text-muted-foreground">{t.propertyAddress} • {t.unitName} ({t.unitType})</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="flex items-center gap-1 text-xs font-semibold text-success bg-success/10 px-2.5 py-1 rounded-full">
                      <Shield className="h-3 w-3" /> Registered
                    </span>
                    {t.tenancy_type === "existing_migration" && (
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                        t.tax_compliance_status === "verified" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>
                        Tax: {t.tax_compliance_status === "verified" ? "Verified" : "Pending"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div><div className="text-muted-foreground">Landlord</div><div className="font-semibold">{t.landlordName}</div></div>
                  <div><div className="text-muted-foreground">Monthly Rent</div><div className="font-semibold">GH₵ {t.agreed_rent.toLocaleString()}</div></div>
                  <div><div className="text-muted-foreground">Registration</div><div className="font-semibold text-xs">{t.registration_code}</div></div>
                  <div><div className="text-muted-foreground">Validity</div><div className="font-semibold">{t.paidCount}/{t.totalPayments} months</div></div>
                </div>
                {/* Signature status */}
                {(t.landlord_signed_at || t.tenant_signed_at) && (
                  <div className="flex gap-4 text-xs">
                    {t.landlord_signed_at && (
                      <span className="flex items-center gap-1 text-success"><PenLine className="h-3 w-3" /> Landlord signed {new Date(t.landlord_signed_at).toLocaleDateString("en-GB")}</span>
                    )}
                    {t.tenant_signed_at && (
                      <span className="flex items-center gap-1 text-success"><PenLine className="h-3 w-3" /> Tenant signed {new Date(t.tenant_signed_at).toLocaleDateString("en-GB")}</span>
                    )}
                  </div>
                )}
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>{t.paidCount} of {t.totalPayments} months validated</span><span>{t.totalPayments > 0 ? Math.round((t.paidCount / t.totalPayments) * 100) : 0}%</span></div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full transition-all" style={{ width: `${t.totalPayments > 0 ? (t.paidCount / t.totalPayments) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(t)}><Download className="h-4 w-4 mr-1" /> Download PDF</Button>
                  <Link to="/tenant/payments"><Button size="sm"><CreditCard className="h-4 w-4 mr-1" /> Pay Rent</Button></Link>
                  <RatingDialog tenancyId={t.id} ratedUserId={t.landlord_user_id} ratedUserName={t.landlordName} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Past Tenancies</h2>
          <div className="space-y-3">
            {past.map(t => (
              <div key={t.id} className="bg-muted/30 rounded-xl p-5 border border-border space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="font-semibold text-foreground">{t.propertyName}</h3>
                    <p className="text-xs text-muted-foreground">{t.propertyAddress} • {t.unitName}</p>
                  </div>
                  <span className="text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20 px-2.5 py-1 rounded-full">
                    {t.status === "expired" ? "Expired" : t.status === "terminated" ? "Terminated" : "Archived"}
                  </span>
                </div>
                <div className="grid sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
                  <div>Registration: <span className="font-mono text-foreground">{t.registration_code}</span></div>
                  <div>Ended: <span className="text-foreground">{new Date(t.end_date).toLocaleDateString("en-GB")}</span></div>
                  <div>Rent: <span className="text-foreground">GH₵ {t.agreed_rent.toLocaleString()}</span></div>
                </div>
                <div className="pt-1">
                  <Button variant="outline" size="sm" onClick={() => handleDownload(t)}><Download className="h-3.5 w-3.5 mr-1" /> Download Agreement</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tenancies.length === 0 && (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No agreements yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Your landlord will create a tenancy agreement for you once you're assigned to a unit.</p>
        </div>
      )}

      {/* Digital Signature Dialog */}
      {signingTenancyId && (
        <DigitalSignatureDialog
          open={!!signingTenancyId}
          onOpenChange={(open) => { if (!open) setSigningTenancyId(null); }}
          tenancyId={signingTenancyId}
          onSigned={() => {
            setSigningTenancyId(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

export default MyAgreements;

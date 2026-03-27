import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileCheck, CheckCircle2, Info, Loader2, XCircle, Clock, TrendingUp, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  status: string;
  tenant_accepted: boolean | null;
  tenantName: string;
  tenantIdCode: string;
  unitName: string;
  unitType: string;
  propertyName: string;
  customFieldValues: Record<string, string>;
  final_agreement_pdf_url: string | null;
  payments: {
    id: string;
    month_label: string;
    status: string;
    tenant_marked_paid: boolean | null;
    landlord_confirmed: boolean | null;
    tax_amount: number;
  }[];
}

const Agreements = () => {
  const { user } = useAuth();
  const { enabled: rentAssessmentEnabled } = useFeatureFlag("rent_assessment");
  const [tenancies, setTenancies] = useState<TenancyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  // Rent increase dialog
  const [increaseDialog, setIncreaseDialog] = useState<{ tenancyId: string; currentRent: number } | null>(null);
  const [proposedRent, setProposedRent] = useState("");
  const [increaseReason, setIncreaseReason] = useState("");
  const [submittingIncrease, setSubmittingIncrease] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: configData } = await supabase.from("agreement_template_config").select("*").limit(1).single();
      if (configData) setCustomFields((configData as any).custom_fields || []);

      const { data: ts } = await supabase
        .from("tenancies")
        .select("*, unit:units(unit_name, unit_type, property_id)")
        .eq("landlord_user_id", user.id)
        .order("created_at", { ascending: false });

      if (!ts) { setLoading(false); return; }

      const results: TenancyView[] = [];
      for (const t of ts as any[]) {
        const { data: prop } = await supabase.from("properties").select("property_name").eq("id", t.unit.property_id).single();
        const { data: tenantProfile } = await supabase.from("profiles").select("full_name").eq("user_id", t.tenant_user_id).single();
        const { data: payments } = await supabase.from("rent_payments").select("id, month_label, status, tenant_marked_paid, landlord_confirmed, tax_amount").eq("tenancy_id", t.id).order("due_date");

        results.push({
          id: t.id,
          registration_code: t.registration_code,
          agreed_rent: t.agreed_rent,
          status: t.status,
          tenant_accepted: t.tenant_accepted,
          tenantName: tenantProfile?.full_name || "Unknown",
          tenantIdCode: t.tenant_id_code,
          unitName: t.unit.unit_name,
          unitType: t.unit.unit_type,
          propertyName: prop?.property_name || "Property",
          customFieldValues: (t as any).custom_field_values || {},
          final_agreement_pdf_url: t.final_agreement_pdf_url || null,
          payments: (payments || []) as any[],
        });
      }
      setTenancies(results);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleConfirmPayment = async (paymentId: string, tenancyId: string) => {
    setConfirming(paymentId);
    try {
      const { error } = await supabase.from("rent_payments").update({
        landlord_confirmed: true,
        status: "confirmed",
      }).eq("id", paymentId);
      if (error) throw error;

      setTenancies(prev => prev.map(t => t.id === tenancyId ? {
        ...t,
        payments: t.payments.map(p => p.id === paymentId ? { ...p, landlord_confirmed: true, status: "confirmed" } : p),
      } : t));
      toast.success("Payment confirmed!");
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm");
    } finally {
      setConfirming(null);
    }
  };

  const handleSubmitRentIncrease = async () => {
    if (!user || !increaseDialog) return;
    setSubmittingIncrease(true);
    try {
      const { error } = await supabase.from("rent_assessments").insert({
        tenancy_id: increaseDialog.tenancyId,
        landlord_user_id: user.id,
        current_rent: increaseDialog.currentRent,
        proposed_rent: parseFloat(proposedRent),
        reason: increaseReason || null,
      } as any);
      if (error) throw error;
      toast.success("Rent increase application submitted for review");
      setIncreaseDialog(null);
      setProposedRent("");
      setIncreaseReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSubmittingIncrease(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Tenancy Agreements</h1>
        <p className="text-muted-foreground mt-1">View agreements and confirm tenant payments</p>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-warning/5 p-3 rounded-lg border border-warning/20">
        <Info className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>Confirm payments after verifying the tenant has paid. This validates their tenancy for that month.</span>
      </div>

      {tenancies.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <p className="text-muted-foreground">No tenancy agreements yet. Add a tenant from the Add Tenant page.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {tenancies.map(t => {
            const awaitingConfirm = t.payments.filter(p => p.tenant_marked_paid && !p.landlord_confirmed && p.status !== "confirmed");
            return (
              <div key={t.id} className="bg-card rounded-xl p-5 shadow-card border border-border space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-card-foreground">{t.propertyName} — {t.unitName}</h3>
                    <div className="text-sm text-muted-foreground">Tenant: {t.tenantName} ({t.tenantIdCode}) • GH₵ {t.agreed_rent}/mo</div>
                    {customFields.length > 0 && Object.keys(t.customFieldValues).length > 0 && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {customFields.map(f => t.customFieldValues[f.label] ? (
                          <span key={f.label}>{f.label}: <strong className="text-card-foreground">{t.customFieldValues[f.label]}</strong></span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {t.final_agreement_pdf_url && (
                      <a href={t.final_agreement_pdf_url} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="default" className="text-xs">
                          <FileCheck className="h-3 w-3 mr-1" /> Signed Copy
                        </Button>
                      </a>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      t.status === "active" ? "bg-success/10 text-success" 
                        : t.status === "rejected" ? "bg-destructive/10 text-destructive" 
                        : "bg-warning/10 text-warning"
                    }`}>
                      {t.status === "active" ? "Active" : t.status === "rejected" ? "Rejected" : t.tenant_accepted ? "Accepted" : "Pending Acceptance"}
                    </span>
                  </div>
                </div>

                {/* Payments awaiting confirmation */}
                {awaitingConfirm.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-info" /> Awaiting Your Confirmation</h4>
                    {awaitingConfirm.map(p => (
                      <div key={p.id} className="bg-info/5 border border-info/20 rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-card-foreground">{p.month_label}</div>
                          <div className="text-xs text-muted-foreground">Tax: GH₵ {p.tax_amount} — Tenant marked as paid</div>
                        </div>
                        <Button size="sm" onClick={() => handleConfirmPayment(p.id, t.id)} disabled={confirming === p.id}>
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          {confirming === p.id ? "..." : "Confirm"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment summary + rent increase */}
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> {t.payments.filter(p => p.landlord_confirmed || p.status === "confirmed").length} confirmed</span>
                  <span className="flex items-center gap-1 text-info"><Clock className="h-3 w-3" /> {awaitingConfirm.length} awaiting</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> {t.payments.filter(p => !p.tenant_marked_paid && !p.landlord_confirmed).length} unpaid</span>
                  {rentAssessmentEnabled && t.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="ml-auto text-xs gap-1"
                      onClick={() => { setIncreaseDialog({ tenancyId: t.id, currentRent: t.agreed_rent }); setProposedRent(""); setIncreaseReason(""); }}
                    >
                      <TrendingUp className="h-3 w-3" /> Request Rent Increase
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rent Increase Dialog */}
      <Dialog open={!!increaseDialog} onOpenChange={(open) => !open && setIncreaseDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Request Rent Increase
            </DialogTitle>
          </DialogHeader>
          {increaseDialog && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="text-muted-foreground">Current Rent:</span>
                <span className="ml-2 font-bold">GH₵ {increaseDialog.currentRent.toLocaleString()}/mo</span>
              </div>
              <div className="space-y-2">
                <Label>Proposed New Rent (GH₵)</Label>
                <Input
                  type="number"
                  value={proposedRent}
                  onChange={(e) => setProposedRent(e.target.value)}
                  placeholder="Enter new monthly rent"
                  min={increaseDialog.currentRent + 1}
                />
              </div>
              <div className="space-y-2">
                <Label>Reason for Increase</Label>
                <Textarea
                  value={increaseReason}
                  onChange={(e) => setIncreaseReason(e.target.value)}
                  placeholder="e.g. Property improvements, market rate adjustment..."
                  className="min-h-[80px]"
                />
              </div>
              <div className="text-xs text-muted-foreground bg-info/5 p-3 rounded-lg border border-info/20">
                <Info className="h-3.5 w-3.5 inline mr-1 text-info" />
                Per the Rent Act 220, rent increases must be assessed and approved by Rent Control before taking effect.
              </div>
              <Button
                onClick={handleSubmitRentIncrease}
                disabled={submittingIncrease || !proposedRent || parseFloat(proposedRent) <= increaseDialog.currentRent}
                className="w-full"
              >
                {submittingIncrease ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                Submit for Assessment
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Agreements;

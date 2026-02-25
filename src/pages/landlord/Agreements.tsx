import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileCheck, CheckCircle2, Info, Loader2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
  const [tenancies, setTenancies] = useState<TenancyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);

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
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    t.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}>
                    {t.status === "active" ? "Active" : t.tenant_accepted ? "Accepted" : "Pending Acceptance"}
                  </span>
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

                {/* Payment summary */}
                <div className="flex gap-3 text-xs">
                  <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> {t.payments.filter(p => p.landlord_confirmed || p.status === "confirmed").length} confirmed</span>
                  <span className="flex items-center gap-1 text-info"><Clock className="h-3 w-3" /> {awaitingConfirm.length} awaiting</span>
                  <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-3 w-3" /> {t.payments.filter(p => !p.tenant_marked_paid && !p.landlord_confirmed).length} unpaid</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Agreements;

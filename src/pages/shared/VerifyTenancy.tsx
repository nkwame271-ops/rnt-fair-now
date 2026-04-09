import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2, Building2, MapPin, CreditCard, CalendarDays, PenLine } from "lucide-react";
import { format } from "date-fns";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

interface TenancyInfo {
  registration_code: string;
  status: string;
  agreement_status: string;
  compliance_status: string;
  agreed_rent: number;
  start_date: string;
  end_date: string;
  landlord_name: string;
  tenant_name: string;
  landlord_signed_at: string | null;
  tenant_signed_at: string | null;
  property_name: string | null;
  property_address: string | null;
  property_region: string | null;
  gps_location: string | null;
  ghana_post_gps: string | null;
  unit_name: string | null;
  unit_type: string | null;
  rent_card_serial: string | null;
  rent_card_role: string | null;
  rent_card_serial_2: string | null;
  rent_card_role_2: string | null;
}

const roleLabel = (role: string | null) => {
  if (role === "landlord_copy") return "Landlord Copy";
  if (role === "tenant_copy") return "Tenant Copy";
  return "Rent Card";
};

const statusBadgeColor: Record<string, string> = {
  Final: "bg-success/10 text-success border-success/20",
  Active: "bg-success/10 text-success border-success/20",
  Pending: "bg-warning/10 text-warning border-warning/20",
  Expired: "bg-destructive/10 text-destructive border-destructive/20",
  Rejected: "bg-destructive/10 text-destructive border-destructive/20",
  Terminated: "bg-muted text-muted-foreground border-border",
  Archived: "bg-muted text-muted-foreground border-border",
};

const VerifyTenancy = () => {
  const { tenancyId } = useParams<{ tenancyId: string }>();
  const [loading, setLoading] = useState(true);
  const [tenancy, setTenancy] = useState<TenancyInfo | null>(null);

  useEffect(() => {
    const fetchTenancy = async () => {
      if (!tenancyId) { setLoading(false); return; }

      try {
        const { data, error } = await supabase.functions.invoke("verify-tenancy", {
          body: { tenancyId },
        });

        if (error || data?.error) {
          setLoading(false);
          return;
        }

        setTenancy(data as TenancyInfo);
      } catch {
        // Tenancy not found or network error
      } finally {
        setLoading(false);
      }
    };
    fetchTenancy();
  }, [tenancyId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md w-full space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Tenancy Not Found</h1>
          <p className="text-muted-foreground text-sm">This tenancy ID is invalid or does not exist in our records.</p>
        </div>
      </div>
    );
  }

  const isValid = ["active", "renewal_window", "renewal_pending"].includes(tenancy.status);
  const badgeColor = statusBadgeColor[tenancy.agreement_status] || "bg-muted text-muted-foreground border-border";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl border border-border shadow-card max-w-md w-full overflow-hidden">
        <div className="bg-primary p-5 text-center space-y-2">
          <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 mx-auto opacity-90" />
          <h1 className="text-lg font-bold text-primary-foreground">Rent Control — Tenancy Verification</h1>
        </div>

        <div className="p-6 space-y-5">
          {/* Registration Code & Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Registration Code</p>
              <p className="font-mono font-bold text-primary">{tenancy.registration_code}</p>
            </div>
            <Badge className={badgeColor}>
              {isValid ? (
                <><Shield className="h-3 w-3 mr-1" /> {tenancy.agreement_status}</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" /> {tenancy.agreement_status}</>
              )}
            </Badge>
          </div>

          {/* Property & Unit */}
          {(tenancy.property_name || tenancy.unit_name) && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3" /> PROPERTY & UNIT
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {tenancy.property_name && (
                  <div><p className="text-muted-foreground text-xs">Property</p><p className="font-semibold text-foreground">{tenancy.property_name}</p></div>
                )}
                {tenancy.unit_name && (
                  <div><p className="text-muted-foreground text-xs">Unit</p><p className="font-semibold text-foreground">{tenancy.unit_name} ({tenancy.unit_type})</p></div>
                )}
                {tenancy.property_address && (
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Address</p><p className="text-foreground text-sm">{tenancy.property_address}</p></div>
                )}
                {tenancy.property_region && (
                  <div><p className="text-muted-foreground text-xs">Region</p><p className="text-foreground">{tenancy.property_region}</p></div>
                )}
                {tenancy.ghana_post_gps && (
                  <div><p className="text-muted-foreground text-xs">Ghana Post GPS</p><p className="font-mono text-foreground text-xs">{tenancy.ghana_post_gps}</p></div>
                )}
              </div>
            </div>
          )}

          {/* Parties */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Landlord</p><p className="font-semibold text-foreground">{tenancy.landlord_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Tenant</p><p className="font-semibold text-foreground">{tenancy.tenant_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Assessed Rent/Month</p><p className="font-semibold text-foreground">GH₵ {tenancy.agreed_rent.toLocaleString()}</p></div>
            <div><p className="text-muted-foreground text-xs">Compliance</p><p className={`font-semibold ${tenancy.compliance_status === "compliant" ? "text-success" : "text-destructive"}`}>{tenancy.compliance_status}</p></div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-start gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <div><p className="text-muted-foreground text-xs">Start Date</p><p className="font-semibold text-foreground">{format(new Date(tenancy.start_date), "dd/MM/yyyy")}</p></div>
            </div>
            <div className="flex items-start gap-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              <div><p className="text-muted-foreground text-xs">End Date</p><p className="font-semibold text-foreground">{format(new Date(tenancy.end_date), "dd/MM/yyyy")}</p></div>
            </div>
          </div>

          {/* Signatures */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <PenLine className="h-3 w-3" /> SIGNATURES
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Landlord Signed</p>
                <p className={`font-semibold ${tenancy.landlord_signed_at ? "text-success" : "text-warning"}`}>
                  {tenancy.landlord_signed_at ? format(new Date(tenancy.landlord_signed_at), "dd/MM/yyyy HH:mm") : "Not yet signed"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tenant Signed</p>
                <p className={`font-semibold ${tenancy.tenant_signed_at ? "text-success" : "text-warning"}`}>
                  {tenancy.tenant_signed_at ? format(new Date(tenancy.tenant_signed_at), "dd/MM/yyyy HH:mm") : "Not yet signed"}
                </p>
              </div>
            </div>
          </div>

          {/* Rent Cards */}
          {(tenancy.rent_card_serial || tenancy.rent_card_serial_2) && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <CreditCard className="h-3 w-3" /> RENT CARDS
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {tenancy.rent_card_serial && (
                  <div>
                    <p className="text-muted-foreground text-xs">{roleLabel(tenancy.rent_card_role)}</p>
                    <p className="font-mono font-semibold text-primary text-sm">{tenancy.rent_card_serial}</p>
                  </div>
                )}
                {tenancy.rent_card_serial_2 && (
                  <div>
                    <p className="text-muted-foreground text-xs">{roleLabel(tenancy.rent_card_role_2)}</p>
                    <p className="font-mono font-semibold text-primary text-sm">{tenancy.rent_card_serial_2}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
            Verified by RentControlGhana • {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyTenancy;

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

interface TenancyInfo {
  registration_code: string;
  status: string;
  compliance_status: string;
  agreed_rent: number;
  start_date: string;
  end_date: string;
  landlord_name: string;
  tenant_name: string;
  rent_card_serial: string | null;
}

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl border border-border shadow-card max-w-md w-full overflow-hidden">
        <div className="bg-primary p-5 text-center space-y-2">
          <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 mx-auto opacity-90" />
          <h1 className="text-lg font-bold text-primary-foreground">Rent Control — Tenancy Verification</h1>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Registration Code</p>
              <p className="font-mono font-bold text-primary">{tenancy.registration_code}</p>
            </div>
            <Badge className={isValid ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
              {isValid ? (
                <><Shield className="h-3 w-3 mr-1" /> Valid</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" /> {tenancy.status}</>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Landlord</p><p className="font-semibold text-foreground">{tenancy.landlord_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Tenant</p><p className="font-semibold text-foreground">{tenancy.tenant_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Monthly Rent</p><p className="font-semibold text-foreground">GH₵ {tenancy.agreed_rent.toLocaleString()}</p></div>
            <div><p className="text-muted-foreground text-xs">Compliance</p><p className={`font-semibold ${tenancy.compliance_status === "compliant" ? "text-success" : "text-destructive"}`}>{tenancy.compliance_status}</p></div>
            <div><p className="text-muted-foreground text-xs">Start Date</p><p className="font-semibold text-foreground">{format(new Date(tenancy.start_date), "dd/MM/yyyy")}</p></div>
            <div><p className="text-muted-foreground text-xs">End Date</p><p className="font-semibold text-foreground">{format(new Date(tenancy.end_date), "dd/MM/yyyy")}</p></div>
            {tenancy.rent_card_serial && (
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Rent Card</p><p className="font-mono font-semibold text-primary text-sm">{tenancy.rent_card_serial}</p></div>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground text-center border-t border-border pt-3">
            Verified by RentControlGhana • {format(new Date(), "dd/MM/yyyy HH:mm")}
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyTenancy;

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, Loader2, CreditCard } from "lucide-react";
import { format } from "date-fns";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

interface RentCardInfo {
  serial_number: string;
  status: string;
  landlord_name: string;
  tenant_name: string | null;
  property_address: string | null;
  unit_name: string | null;
  current_rent: number | null;
  start_date: string | null;
  expiry_date: string | null;
  advance_paid: number | null;
  max_advance: number | null;
  last_payment_status: string | null;
}

const VerifyRentCard = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [card, setCard] = useState<RentCardInfo | null>(null);

  useEffect(() => {
    const fetchCard = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data, error } = await supabase.functions.invoke("verify-rent-card", {
          body: { token },
        });
        if (error || data?.error) { setLoading(false); return; }
        setCard(data as RentCardInfo);
      } catch {
        // not found
      } finally {
        setLoading(false);
      }
    };
    fetchCard();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-xl border border-border p-8 text-center max-w-md w-full space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Rent Card Not Found</h1>
          <p className="text-muted-foreground text-sm">This rent card token is invalid or does not exist.</p>
        </div>
      </div>
    );
  }

  const isValid = ["active", "valid"].includes(card.status);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="bg-card rounded-xl border border-border shadow-card max-w-md w-full overflow-hidden">
        <div className="bg-primary p-5 text-center space-y-2">
          <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 mx-auto opacity-90" />
          <h1 className="text-lg font-bold text-primary-foreground">Rent Control — Rent Card Verification</h1>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Serial Number</p>
              <p className="font-mono font-bold text-primary">{card.serial_number}</p>
            </div>
            <Badge className={isValid ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20"}>
              {isValid ? (
                <><Shield className="h-3 w-3 mr-1" /> {card.status === "active" ? "Active" : "Valid"}</>
              ) : (
                <><AlertTriangle className="h-3 w-3 mr-1" /> {card.status}</>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-muted-foreground text-xs">Landlord</p><p className="font-semibold text-foreground">{card.landlord_name}</p></div>
            <div><p className="text-muted-foreground text-xs">Tenant</p><p className="font-semibold text-foreground">{card.tenant_name || "Not assigned"}</p></div>
            {card.property_address && (
              <div className="col-span-2"><p className="text-muted-foreground text-xs">Property</p><p className="font-semibold text-foreground">{card.property_address}</p></div>
            )}
            {card.unit_name && (
              <div><p className="text-muted-foreground text-xs">Unit</p><p className="font-semibold text-foreground">{card.unit_name}</p></div>
            )}
            {card.current_rent != null && (
              <div><p className="text-muted-foreground text-xs">Monthly Rent</p><p className="font-semibold text-foreground">GH₵ {card.current_rent.toLocaleString()}</p></div>
            )}
            {card.start_date && (
              <div><p className="text-muted-foreground text-xs">Start Date</p><p className="font-semibold text-foreground">{format(new Date(card.start_date), "dd/MM/yyyy")}</p></div>
            )}
            {card.expiry_date && (
              <div><p className="text-muted-foreground text-xs">Expiry Date</p><p className="font-semibold text-foreground">{format(new Date(card.expiry_date), "dd/MM/yyyy")}</p></div>
            )}
            {card.advance_paid != null && (
              <div><p className="text-muted-foreground text-xs">Advance Paid</p><p className="font-semibold text-foreground">{card.advance_paid} month(s)</p></div>
            )}
            {card.max_advance != null && (
              <div><p className="text-muted-foreground text-xs">Max Advance</p><p className="font-semibold text-foreground">{card.max_advance} months</p></div>
            )}
            {card.last_payment_status && card.last_payment_status !== "none" && (
              <div><p className="text-muted-foreground text-xs">Last Payment</p><p className="font-semibold text-foreground capitalize">{card.last_payment_status}</p></div>
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

export default VerifyRentCard;

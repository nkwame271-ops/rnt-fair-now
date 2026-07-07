import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CreditCard, QrCode } from "lucide-react";
import { format } from "date-fns";
import LogoLoader from "@/components/LogoLoader";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";
import { QRCodeSVG } from "qrcode.react";
import Seo from "@/components/Seo";

type Variant = "tenant" | "landlord";

interface RentCardRow {
  id: string;
  serial_number: string | null;
  status: string;
  qr_token: string | null;
  card_role: string | null;
  current_rent: number | null;
  advance_paid: number | null;
  max_advance: number | null;
  start_date: string | null;
  expiry_date: string | null;
  tenancy_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  landlord_user_id: string;
  tenant_user_id: string | null;
  last_payment_status: string | null;
}

interface Enriched extends RentCardRow {
  property_address?: string;
  unit_name?: string;
  landlord_name?: string;
  tenant_name?: string;
}

const DigitalRentCardView = ({ variant }: { variant: Variant }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<Enriched[]>([]);
  const [payments, setPayments] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const filterCol = variant === "tenant" ? "tenant_user_id" : "landlord_user_id";
      const roleFilter = variant === "tenant" ? "tenant_copy" : "landlord_copy";
      const { data: raw } = await supabase
        .from("rent_cards")
        .select("*")
        .eq(filterCol, user.id)
        .order("created_at", { ascending: false });

      const list = (raw || []) as RentCardRow[];
      // Prefer the tenant/landlord copy where present, but fall back to any card
      const preferred = list.filter((c) => (c.card_role || "") === roleFilter);
      const use = preferred.length > 0 ? preferred : list;

      // Enrich
      const propIds = [...new Set(use.map((c) => c.property_id).filter(Boolean))] as string[];
      const unitIds = [...new Set(use.map((c) => c.unit_id).filter(Boolean))] as string[];
      const partnerIds = [
        ...new Set(
          use
            .map((c) => (variant === "tenant" ? c.landlord_user_id : c.tenant_user_id))
            .filter(Boolean),
        ),
      ] as string[];

      const [props, units, profs] = await Promise.all([
        propIds.length
          ? supabase.from("properties").select("id, address").in("id", propIds)
          : Promise.resolve({ data: [] as any[] }),
        unitIds.length
          ? supabase.from("units").select("id, unit_number").in("id", unitIds)
          : Promise.resolve({ data: [] as any[] }),
        partnerIds.length
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", partnerIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const pm = new Map((props.data || []).map((p: any) => [p.id, p.address]));
      const um = new Map((units.data || []).map((u: any) => [u.id, u.unit_number]));
      const nm = new Map((profs.data || []).map((p: any) => [p.user_id, p.full_name]));

      const enriched: Enriched[] = use.map((c) => ({
        ...c,
        property_address: c.property_id ? pm.get(c.property_id) : undefined,
        unit_name: c.unit_id ? um.get(c.unit_id) : undefined,
        landlord_name:
          variant === "tenant" ? nm.get(c.landlord_user_id) : undefined,
        tenant_name:
          variant === "landlord" && c.tenant_user_id
            ? nm.get(c.tenant_user_id)
            : undefined,
      }));

      // Payments per tenancy
      const tenancyIds = [...new Set(enriched.map((c) => c.tenancy_id).filter(Boolean))] as string[];
      const payMap: Record<string, any[]> = {};
      if (tenancyIds.length) {
        const { data: recs } = await supabase
          .from("payment_receipts")
          .select("id, receipt_number, total_amount, payment_type, created_at, tenancy_id, status")
          .in("tenancy_id", tenancyIds)
          .order("created_at", { ascending: false });
        (recs || []).forEach((r: any) => {
          if (!r.tenancy_id) return;
          (payMap[r.tenancy_id] ||= []).push(r);
        });
      }

      setCards(enriched);
      setPayments(payMap);
      setLoading(false);
    })();
  }, [user, variant]);

  if (loading) return <LogoLoader message="Loading rent card…" />;

  const heading = variant === "tenant" ? "My Rent Card" : "Landlord Rent Card Copy";
  const subtitle =
    variant === "tenant"
      ? "Your digital rent card and live payment history."
      : "Landlord copy of each active rent card issued for your properties.";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Seo title={`${heading} | Rent Control`} description={subtitle} canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"} />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" /> {heading}
        </h1>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="text-lg font-bold">No rent card yet</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Rent cards appear here once a tenancy has been registered and a serial has been assigned.
          </p>
        </div>
      ) : (
        cards.map((c) => {
          const isValid = ["active", "valid"].includes(c.status);
          const verifyUrl =
            typeof window !== "undefined" && c.qr_token
              ? `${window.location.origin}/verify/rent-card/${c.qr_token}`
              : c.qr_token || c.serial_number || "";
          const recs = c.tenancy_id ? payments[c.tenancy_id] || [] : [];
          return (
            <div
              key={c.id}
              className="bg-card rounded-2xl border border-border shadow-card overflow-hidden"
            >
              <div className="bg-destructive p-5 text-center space-y-2">
                <img
                  src={coatOfArms}
                  alt="Ghana Coat of Arms"
                  className="h-12 mx-auto opacity-95"
                />
                <h2 className="text-lg font-bold text-white">
                  Republic of Ghana — Rent Control
                </h2>
                <p className="text-white/90 text-xs uppercase tracking-widest">
                  {c.card_role === "landlord_copy" || variant === "landlord"
                    ? "Landlord Copy"
                    : "Tenant Copy"}
                </p>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Serial Number</p>
                    <p className="font-mono font-bold text-primary">
                      {c.serial_number || "—"}
                    </p>
                  </div>
                  <Badge
                    className={
                      isValid
                        ? "bg-success/10 text-success border-success/20"
                        : "bg-destructive/10 text-destructive border-destructive/20"
                    }
                  >
                    {isValid ? (
                      <>
                        <Shield className="h-3 w-3 mr-1" />
                        {c.status === "active" ? "Active" : "Valid"}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {c.status}
                      </>
                    )}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-start">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {c.landlord_name && (
                      <div>
                        <p className="text-muted-foreground text-xs">Landlord</p>
                        <p className="font-semibold">{c.landlord_name}</p>
                      </div>
                    )}
                    {c.tenant_name && (
                      <div>
                        <p className="text-muted-foreground text-xs">Tenant</p>
                        <p className="font-semibold">{c.tenant_name}</p>
                      </div>
                    )}
                    {c.property_address && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground text-xs">Property</p>
                        <p className="font-semibold">{c.property_address}</p>
                      </div>
                    )}
                    {c.unit_name && (
                      <div>
                        <p className="text-muted-foreground text-xs">Unit</p>
                        <p className="font-semibold">{c.unit_name}</p>
                      </div>
                    )}
                    {c.current_rent != null && (
                      <div>
                        <p className="text-muted-foreground text-xs">Monthly Rent</p>
                        <p className="font-semibold">GHS {Number(c.current_rent).toLocaleString()}</p>
                      </div>
                    )}
                    {c.start_date && (
                      <div>
                        <p className="text-muted-foreground text-xs">Start Date</p>
                        <p className="font-semibold">
                          {format(new Date(c.start_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {c.expiry_date && (
                      <div>
                        <p className="text-muted-foreground text-xs">Expiry</p>
                        <p className="font-semibold">
                          {format(new Date(c.expiry_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                    )}
                    {c.advance_paid != null && (
                      <div>
                        <p className="text-muted-foreground text-xs">Advance Paid</p>
                        <p className="font-semibold">{c.advance_paid} month(s)</p>
                      </div>
                    )}
                  </div>

                  {verifyUrl && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="p-2 bg-white rounded border border-border">
                        <QRCodeSVG value={verifyUrl} size={96} />
                      </div>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <QrCode className="h-3 w-3" /> Scan to verify
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-sm font-bold mb-2">Payment History</h3>
                  {recs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No payments recorded yet for this tenancy.
                    </p>
                  ) : (
                    <div className="overflow-x-auto -mx-1">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr className="text-left">
                            <th className="py-1 pr-2 font-medium">Date</th>
                            <th className="py-1 pr-2 font-medium">Receipt</th>
                            <th className="py-1 pr-2 font-medium">Type</th>
                            <th className="py-1 pr-2 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recs.slice(0, 25).map((r: any) => (
                            <tr key={r.id} className="border-t border-border/60">
                              <td className="py-1.5 pr-2">
                                {format(new Date(r.created_at), "dd/MM/yy")}
                              </td>
                              <td className="py-1.5 pr-2 font-mono">
                                {r.receipt_number}
                              </td>
                              <td className="py-1.5 pr-2 capitalize">
                                {String(r.payment_type || "").replace(/_/g, " ")}
                              </td>
                              <td className="py-1.5 pr-2 text-right font-semibold">
                                GHS {Number(r.total_amount || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default DigitalRentCardView;

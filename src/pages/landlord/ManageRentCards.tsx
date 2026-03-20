import { useState, useEffect } from "react";
import { CreditCard, Loader2, ShoppingCart, Hash, Link2, MapPin, User, Calendar, DollarSign, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";

interface RentCard {
  id: string;
  serial_number: string | null;
  status: string;
  tenancy_id: string | null;
  purchased_at: string;
  activated_at: string | null;
  tenant_user_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  start_date: string | null;
  expiry_date: string | null;
  current_rent: number | null;
  previous_rent: number | null;
  max_advance: number | null;
  advance_paid: number | null;
  last_payment_status: string | null;
  qr_token: string | null;
  purchase_id: string | null;
  card_role: string | null;
}

interface EnrichedRentCard extends RentCard {
  landlord_name?: string;
  landlord_id_code?: string;
  tenant_name?: string;
  tenant_id_code?: string;
  property_code?: string;
  unit_name?: string;
}

const PRICE_PER_PAIR = 25;
const PUBLISHED_URL = "https://www.rentcontrolghana.com";

const statusBadge = (status: string) => {
  switch (status) {
    case "awaiting_serial": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "valid": return "bg-success/10 text-success border-success/20";
    case "active": return "bg-primary/10 text-primary border-primary/20";
    case "used": return "bg-muted text-muted-foreground border-border";
    case "voided": return "bg-destructive/10 text-destructive border-destructive/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const statusLabel = (status: string) => {
  switch (status) {
    case "awaiting_serial": return "Awaiting Serial";
    case "valid": return "Available";
    case "active": return "Active";
    case "used": return "Used";
    case "voided": return "Voided";
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

const ManageRentCards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<EnrichedRentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const fetchCards = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rent_cards")
      .select("*")
      .eq("landlord_user_id", user.id)
      .order("created_at", { ascending: false });

    const rawCards = (data || []) as RentCard[];

    const enriched: EnrichedRentCard[] = [];
    const { data: landlordProfile } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).single();
    const { data: landlordRecord } = await supabase.from("landlords").select("landlord_id").eq("user_id", user.id).single();

    const tenantIds = [...new Set(rawCards.map(c => c.tenant_user_id).filter(Boolean))] as string[];
    const propertyIds = [...new Set(rawCards.map(c => c.property_id).filter(Boolean))] as string[];
    const unitIds = [...new Set(rawCards.map(c => c.unit_id).filter(Boolean))] as string[];

    const [tenantsRes, tenantProfilesRes, propsRes, unitsRes] = await Promise.all([
      tenantIds.length > 0 ? supabase.from("tenants").select("user_id, tenant_id").in("user_id", tenantIds) : { data: [] },
      tenantIds.length > 0 ? supabase.from("profiles").select("user_id, full_name").in("user_id", tenantIds) : { data: [] },
      propertyIds.length > 0 ? supabase.from("properties").select("id, property_code").in("id", propertyIds) : { data: [] },
      unitIds.length > 0 ? supabase.from("units").select("id, unit_name").in("id", unitIds) : { data: [] },
    ]);

    const tenantMap = new Map((tenantsRes.data || []).map((t: any) => [t.user_id, t.tenant_id]));
    const tenantNameMap = new Map((tenantProfilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));
    const propMap = new Map((propsRes.data || []).map((p: any) => [p.id, p.property_code]));
    const unitMap = new Map((unitsRes.data || []).map((u: any) => [u.id, u.unit_name]));

    for (const card of rawCards) {
      enriched.push({
        ...card,
        landlord_name: landlordProfile?.full_name || "—",
        landlord_id_code: landlordRecord?.landlord_id || "—",
        tenant_name: card.tenant_user_id ? (tenantNameMap.get(card.tenant_user_id) || "—") : undefined,
        tenant_id_code: card.tenant_user_id ? (tenantMap.get(card.tenant_user_id) || "—") : undefined,
        property_code: card.property_id ? (propMap.get(card.property_id) || "—") : undefined,
        unit_name: card.unit_id ? (unitMap.get(card.unit_id) || "—") : undefined,
      });
    }

    setCards(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchCards();

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("reference") || params.get("trxref");

    if (ref) {
      window.history.replaceState({}, "", window.location.pathname);
      supabase.functions.invoke("verify-payment", { body: { reference: ref } })
        .then(({ data }) => {
          if (data?.verified) {
            toast.success("Rent cards purchased! Visit your Rent Control office to collect physical cards.");
          } else {
            toast.info("Payment is being processed. Your cards will appear shortly.");
          }
          const poll = setInterval(async () => {
            await fetchCards();
            clearInterval(poll);
          }, 3000);
          setTimeout(() => clearInterval(poll), 15000);
          fetchCards();
        })
        .catch(() => {
          toast.info("Payment is being processed.");
          fetchCards();
        });
    }
  }, [user]);

  const handlePurchase = async () => {
    if (!user) return;
    setPurchasing(true);
    try {
      const qty = parseInt(quantity);
      const { data, error } = await supabase.functions.invoke("paystack-checkout", {
        body: { type: "rent_card_bulk", quantity: qty },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (data?.skipped) {
        toast.success(data.message || "Rent cards created!");
        fetchCards();
        setPurchasing(false);
        return;
      }
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate purchase");
      setPurchasing(false);
    }
  };

  const awaitingCount = cards.filter(c => c.status === "awaiting_serial").length;
  const validCount = cards.filter(c => c.status === "valid").length;
  const activeCount = cards.filter(c => c.status === "active").length;
  const usedCount = cards.filter(c => c.status === "used").length;

  const filteredCards = filterStatus === "all" ? cards : cards.filter(c => c.status === filterStatus);

  // Group cards by purchase_id for display
  const purchaseGroups = new Map<string, EnrichedRentCard[]>();
  for (const card of filteredCards) {
    const key = card.purchase_id || card.id;
    if (!purchaseGroups.has(key)) purchaseGroups.set(key, []);
    purchaseGroups.get(key)!.push(card);
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Rent Cards</h1>
          <p className="text-muted-foreground mt-1">Purchase and manage rent cards for your tenancies</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: "Total Cards", value: cards.length, color: "text-foreground" },
            { label: "Awaiting Serial", value: awaitingCount, color: "text-amber-600" },
            { label: "Available", value: validCount, color: "text-success" },
            { label: "Active", value: activeCount, color: "text-primary" },
            { label: "Used", value: usedCount, color: "text-muted-foreground" },
          ].map(s => (
            <div key={s.label} className="bg-card rounded-xl border border-border p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Awaiting Serial Banner */}
        {awaitingCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <Building2 className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-700">
                {awaitingCount} card{awaitingCount > 1 ? "s" : ""} awaiting serial assignment
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                Please visit your assigned Rent Control office with your Landlord ID to collect your physical rent cards.
              </p>
            </div>
          </div>
        )}

        {/* Purchase Section */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Purchase Rent Cards
          </h2>
          <p className="text-sm text-muted-foreground">
            Each rent card costs <strong>GH₵ {PRICE_PER_CARD}</strong>. After purchase, collect physical cards from your Rent Control office.
          </p>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" min="1" max="50" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-24" />
            </div>
            <div className="text-sm text-muted-foreground pb-2">
              Total: <strong className="text-foreground">GH₵ {(parseInt(quantity) * PRICE_PER_CARD || 0).toLocaleString()}</strong>
            </div>
            <Button onClick={handlePurchase} disabled={purchasing || !parseInt(quantity) || parseInt(quantity) < 1}>
              <CreditCard className="h-4 w-4 mr-1" />
              {purchasing ? "Processing..." : "Buy Rent Cards"}
            </Button>
          </div>
        </div>

        {/* Serial Inventory — Range View */}
        {cards.some(c => c.serial_number && c.status === "valid") && (
          <div className="bg-card rounded-xl border border-border p-6 space-y-4">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" /> Assigned Serial Inventory
            </h2>
            <p className="text-sm text-muted-foreground">Your available serials from Rent Control office assignments, grouped by batch.</p>
            {(() => {
              const validCards = cards.filter(c => c.serial_number && ["valid", "active", "used"].includes(c.status));
              const batchGroups = new Map<string, typeof validCards>();
              for (const card of validCards) {
                const key = card.purchase_id || "ungrouped";
                if (!batchGroups.has(key)) batchGroups.set(key, []);
                batchGroups.get(key)!.push(card);
              }
              return Array.from(batchGroups.entries()).map(([purchaseId, groupCards]) => {
                const sorted = [...groupCards].sort((a, b) => (a.serial_number || "").localeCompare(b.serial_number || ""));
                const first = sorted[0]?.serial_number || "";
                const last = sorted[sorted.length - 1]?.serial_number || "";
                const available = sorted.filter(c => c.status === "valid").length;
                const active = sorted.filter(c => c.status === "active").length;
                return (
                  <div key={purchaseId} className="border border-border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-mono text-xs font-bold text-card-foreground">
                        {sorted.length > 1 ? `${first} → ${last}` : first}
                      </p>
                      <p className="text-xs text-muted-foreground">Purchase: {purchaseId} • {sorted.length} card(s)</p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <Badge className="bg-success/10 text-success border-success/20">{available} unused</Badge>
                      <Badge className="bg-primary/10 text-primary border-primary/20">{active} active</Badge>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" /> Your Rent Cards
          </h2>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="awaiting_serial">Awaiting Serial</SelectItem>
              <SelectItem value="valid">Available</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="used">Used</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Card List */}
        {filteredCards.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">{cards.length === 0 ? "No rent cards yet. Purchase some above." : "No cards match this filter."}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCards.map(card => {
              const isExpanded = expandedCard === card.id;
              const isLinked = card.status === "active" && card.tenant_user_id;
              const isAwaiting = card.status === "awaiting_serial";
              return (
                <div key={card.id} className="bg-card rounded-xl border border-border overflow-hidden">
                  <button
                    onClick={() => setExpandedCard(isExpanded ? null : card.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className={`h-5 w-5 ${isAwaiting ? "text-amber-500" : "text-primary"}`} />
                      <div>
                        {isAwaiting ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                            <p className="text-sm font-medium text-amber-600">Collect from Rent Control office</p>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-bold text-sm text-card-foreground">{card.serial_number}</p>
                            {card.card_role && (
                              <Badge variant="outline" className="text-[10px]">
                                {card.card_role === "landlord_copy" ? "Landlord Copy" : card.card_role === "tenant_copy" ? "Tenant Copy" : card.card_role}
                              </Badge>
                            )}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {card.purchase_id && <span className="font-mono">{card.purchase_id} • </span>}
                          Purchased: {format(new Date(card.purchased_at), "dd/MM/yyyy")}
                          {card.activated_at && ` • Activated: ${format(new Date(card.activated_at), "dd/MM/yyyy")}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isLinked && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Link2 className="h-3 w-3" /> Linked
                        </span>
                      )}
                      <Badge className={statusBadge(card.status)}>{statusLabel(card.status)}</Badge>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border p-5 space-y-4">
                      {isAwaiting && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-700">
                          <strong>Next step:</strong> Visit your assigned Rent Control office with your Landlord ID ({card.landlord_id_code}) to collect the physical card and have the serial number assigned.
                        </div>
                      )}
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Rent Card ID</p>
                          <p className="font-mono text-xs text-card-foreground">{card.id.slice(0, 8)}...</p>
                        </div>
                        {card.purchase_id && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Purchase ID</p>
                            <p className="font-mono text-xs text-card-foreground">{card.purchase_id}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Landlord</p>
                          <p className="font-semibold text-card-foreground">{card.landlord_name} ({card.landlord_id_code})</p>
                        </div>
                        {card.tenant_name && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Tenant</p>
                            <p className="font-semibold text-card-foreground">{card.tenant_name} ({card.tenant_id_code})</p>
                          </div>
                        )}
                        {card.property_code && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Property</p>
                            <p className="font-semibold text-card-foreground">{card.property_code}</p>
                          </div>
                        )}
                        {card.unit_name && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Unit</p>
                            <p className="font-semibold text-card-foreground">{card.unit_name}</p>
                          </div>
                        )}
                        {card.tenancy_id && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Tenancy ID</p>
                            <p className="font-mono text-xs text-card-foreground">{card.tenancy_id.slice(0, 8)}...</p>
                          </div>
                        )}
                        {card.start_date && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Start Date</p>
                            <p className="font-semibold text-card-foreground">{format(new Date(card.start_date), "dd/MM/yyyy")}</p>
                          </div>
                        )}
                        {card.expiry_date && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> Expiry Date</p>
                            <p className="font-semibold text-card-foreground">{format(new Date(card.expiry_date), "dd/MM/yyyy")}</p>
                          </div>
                        )}
                        {card.current_rent != null && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Current Rent</p>
                            <p className="font-semibold text-card-foreground">GH₵ {card.current_rent.toLocaleString()}</p>
                          </div>
                        )}
                        {card.previous_rent != null && card.previous_rent > 0 && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Previous Rent</p>
                            <p className="font-semibold text-card-foreground">GH₵ {card.previous_rent.toLocaleString()}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Max Advance</p>
                          <p className="font-semibold text-card-foreground">{card.max_advance ?? 6} months</p>
                        </div>
                        {card.advance_paid != null && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Advance Paid</p>
                            <p className="font-semibold text-card-foreground">{card.advance_paid} month(s)</p>
                          </div>
                        )}
                        {card.last_payment_status && card.last_payment_status !== "none" && (
                          <div>
                            <p className="text-muted-foreground text-xs mb-1">Last Payment Status</p>
                            <p className="font-semibold text-card-foreground capitalize">{card.last_payment_status}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs mb-1">Card Status</p>
                          <Badge className={statusBadge(card.status)}>{statusLabel(card.status)}</Badge>
                        </div>
                      </div>

                      {card.qr_token && (
                        <div className="flex flex-col items-center gap-2 pt-3 border-t border-border">
                          <p className="text-xs text-muted-foreground font-medium">Verification QR Code</p>
                          <QRCodeSVG
                            value={`${PUBLISHED_URL}/verify/rent-card/${card.qr_token}`}
                            size={120}
                            level="M"
                          />
                          <p className="text-[10px] text-muted-foreground">Scan to verify this rent card</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default ManageRentCards;

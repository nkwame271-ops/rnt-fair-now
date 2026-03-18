import { useState, useEffect } from "react";
import { CreditCard, Loader2, ShoppingCart, Hash, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RentCard {
  id: string;
  serial_number: string;
  status: string;
  tenancy_id: string | null;
  purchased_at: string;
  activated_at: string | null;
}

const PRICE_PER_CARD = 25;

const statusBadge = (status: string) => {
  switch (status) {
    case "valid": return "bg-success/10 text-success border-success/20";
    case "active": return "bg-primary/10 text-primary border-primary/20";
    case "used": return "bg-muted text-muted-foreground border-border";
    case "voided": return "bg-destructive/10 text-destructive border-destructive/20";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const ManageRentCards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<RentCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchCards = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("rent_cards")
      .select("*")
      .eq("landlord_user_id", user.id)
      .order("created_at", { ascending: false });
    setCards((data || []) as RentCard[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchCards();

    // Handle return from payment
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") === "success") {
      toast.success("Rent cards purchased successfully!");
      window.history.replaceState({}, "", window.location.pathname);
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

  const validCount = cards.filter(c => c.status === "valid").length;
  const activeCount = cards.filter(c => c.status === "active").length;
  const usedCount = cards.filter(c => c.status === "used").length;

  const filteredCards = filterStatus === "all" ? cards : cards.filter(c => c.status === filterStatus);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manage Rent Cards</h1>
          <p className="text-muted-foreground mt-1">Purchase and manage rent cards for your tenancies</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Cards", value: cards.length, color: "text-foreground" },
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

        {/* Purchase Section */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Purchase Rent Cards
          </h2>
          <p className="text-sm text-muted-foreground">
            Each rent card costs <strong>GH₵ {PRICE_PER_CARD}</strong>. A rent card must be assigned to every new tenancy.
          </p>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-24"
              />
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

        {/* Card List */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" /> Your Rent Cards
            </h2>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="valid">Available</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="used">Used</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredCards.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{cards.length === 0 ? "No rent cards yet. Purchase some above." : "No cards match this filter."}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredCards.map(card => (
                <div key={card.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-mono font-semibold text-sm text-card-foreground">{card.serial_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Purchased: {new Date(card.purchased_at).toLocaleDateString("en-GB")}
                        {card.activated_at && ` • Activated: ${new Date(card.activated_at).toLocaleDateString("en-GB")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {card.tenancy_id && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> Linked
                      </span>
                    )}
                    <Badge className={statusBadge(card.status)}>
                      {card.status === "valid" ? "Available" : card.status.charAt(0).toUpperCase() + card.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
};

export default ManageRentCards;

import { useState } from "react";
import { Search, CreditCard, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminProfile, GHANA_OFFICES } from "@/hooks/useAdminProfile";
import { useAuth } from "@/hooks/useAuth";

export interface PendingPurchase {
  purchase_id: string;
  landlord_user_id: string;
  landlord_name: string;
  landlord_id_code: string;
  pending_count: number;
  purchased_at: string;
  card_ids: string[];
}

interface Props {
  profile: AdminProfile | null;
  onStockChanged: () => void;
}

const PendingPurchases = ({ profile, onStockChanged }: Props) => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [searched, setSearched] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedSerials, setAssignedSerials] = useState<Record<string, string[]>>({});

  const officeName = profile?.isMainAdmin
    ? "" // main admin will need to pick — handled in assign
    : GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || "";

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);
    setPurchases([]);

    try {
      const { data: cards, error } = await supabase
        .from("rent_cards")
        .select("id, purchase_id, landlord_user_id, purchased_at")
        .eq("status", "awaiting_serial");

      if (error) throw error;
      if (!cards || cards.length === 0) { setSearching(false); return; }

      const landlordUserIds = [...new Set(cards.map((c: any) => c.landlord_user_id))];
      const [profilesRes, landlordsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", landlordUserIds),
        supabase.from("landlords").select("user_id, landlord_id").in("user_id", landlordUserIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));
      const landlordIdMap = new Map((landlordsRes.data || []).map((l: any) => [l.user_id, l.landlord_id]));

      const q = searchQuery.trim().toUpperCase();
      const grouped = new Map<string, PendingPurchase>();

      for (const card of cards as any[]) {
        const purchaseId = card.purchase_id || card.id;
        const landlordIdCode = landlordIdMap.get(card.landlord_user_id) || "";
        const matchesPurchase = purchaseId.toUpperCase().includes(q);
        const matchesLandlord = landlordIdCode.toUpperCase().includes(q);
        const matchesName = (profileMap.get(card.landlord_user_id) || "").toUpperCase().includes(q);
        if (!matchesPurchase && !matchesLandlord && !matchesName) continue;

        if (!grouped.has(purchaseId)) {
          grouped.set(purchaseId, {
            purchase_id: purchaseId,
            landlord_user_id: card.landlord_user_id,
            landlord_name: profileMap.get(card.landlord_user_id) || "Unknown",
            landlord_id_code: landlordIdCode || "—",
            pending_count: 0,
            purchased_at: card.purchased_at,
            card_ids: [],
          });
        }
        const g = grouped.get(purchaseId)!;
        g.pending_count++;
        g.card_ids.push(card.id);
      }

      setPurchases(Array.from(grouped.values()));
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    }
    setSearching(false);
  };

  const handleAssign = async (purchase: PendingPurchase) => {
    const office = profile?.isMainAdmin
      ? GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || GHANA_OFFICES[0]?.name
      : officeName;

    if (!office) { toast.error("No office configured"); return; }

    setAssigning(purchase.purchase_id);
    try {
      const qty = purchase.pending_count;
      const { data: availableSerials, error: stockErr } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("id, serial_number")
        .eq("office_name", office)
        .eq("status", "available")
        .order("created_at", { ascending: true })
        .limit(qty);

      if (stockErr) throw stockErr;
      if (!availableSerials || availableSerials.length < qty) {
        toast.error(`Not enough serials. Available: ${availableSerials?.length || 0}, needed: ${qty}`);
        setAssigning(null);
        return;
      }

      const assignedList: string[] = [];
      for (let i = 0; i < qty; i++) {
        const serial = (availableSerials as any)[i];
        const cardId = purchase.card_ids[i];

        const { error: cardErr } = await supabase
          .from("rent_cards")
          .update({ serial_number: serial.serial_number, status: "valid" } as any)
          .eq("id", cardId);

        if (cardErr) throw cardErr;

        const { error: stockErr2 } = await supabase
          .from("rent_card_serial_stock" as any)
          .update({
            status: "assigned",
            assigned_to_card_id: cardId,
            assigned_at: new Date().toISOString(),
            assigned_by: user?.id,
          })
          .eq("id", serial.id);

        if (stockErr2) throw stockErr2;

        assignedList.push(serial.serial_number);
      }

      // Audit trail
      const officeId = profile?.isMainAdmin ? profile?.officeId || GHANA_OFFICES[0]?.id : profile?.officeId;
      await supabase.from("serial_assignments" as any).insert({
        purchase_id: purchase.purchase_id,
        landlord_user_id: purchase.landlord_user_id,
        office_name: office,
        office_id: officeId || null,
        assigned_by: user?.id,
        serial_numbers: assignedList,
        card_count: qty,
      });

      setAssignedSerials(prev => ({ ...prev, [purchase.purchase_id]: assignedList }));
      setPurchases(prev => prev.filter(p => p.purchase_id !== purchase.purchase_id));
      onStockChanged();
      toast.success(`${qty} serial(s) assigned successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    }
    setAssigning(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Pending Purchases & Assign
        </h2>
        <div className="flex gap-3">
          <Input
            placeholder="Search by Landlord ID, Name, or Purchase ID..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Search
          </Button>
        </div>

        {searched && purchases.length === 0 && !searching && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No pending purchases found for "{searchQuery}"
          </div>
        )}

        {purchases.map(p => (
          <div key={p.purchase_id} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-mono font-bold text-sm text-card-foreground">{p.purchase_id}</p>
                <p className="text-xs text-muted-foreground">
                  {p.landlord_name} ({p.landlord_id_code}) • Purchased: {format(new Date(p.purchased_at), "dd/MM/yyyy")}
                </p>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                {p.pending_count} card{p.pending_count > 1 ? "s" : ""} pending
              </Badge>
            </div>
            <Button
              onClick={() => handleAssign(p)}
              disabled={assigning === p.purchase_id}
              className="w-full sm:w-auto"
            >
              {assigning === p.purchase_id ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Assigning...</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> Assign {p.pending_count} Serial{p.pending_count > 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        ))}

        {Object.entries(assignedSerials).map(([purchaseId, serials]) => (
          <div key={purchaseId} className="border border-success/30 bg-success/5 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success" />
              <p className="font-semibold text-success text-sm">Assigned — {purchaseId}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {serials.map(s => (
                <Badge key={s} variant="outline" className="font-mono text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PendingPurchases;

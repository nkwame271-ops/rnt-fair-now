import { useState, useMemo } from "react";
import { Search, CreditCard, Loader2, CheckCircle, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminProfile, GHANA_OFFICES } from "@/hooks/useAdminProfile";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PendingPurchase {
  purchase_id: string;
  landlord_user_id: string;
  landlord_name: string;
  landlord_id_code: string;
  pending_count: number;
  purchased_at: string;
  card_ids: string[];
}

interface SerialOption {
  id: string;
  serial_number: string;
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
  const [assigning, setAssigning] = useState(false);
  const [assignedSerials, setAssignedSerials] = useState<Record<string, string[]>>({});

  // Mapping state
  const [mappingPurchase, setMappingPurchase] = useState<PendingPurchase | null>(null);
  const [serialMap, setSerialMap] = useState<Record<string, string>>({});
  const [availableSerials, setAvailableSerials] = useState<SerialOption[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialFilter, setSerialFilter] = useState("");

  const officeName = profile?.isMainAdmin
    ? ""
    : GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || "";

  const resolveOffice = () => {
    return profile?.isMainAdmin
      ? GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || GHANA_OFFICES[0]?.name
      : officeName;
  };

  // Serials already picked in the current mapping (exclude from other dropdowns)
  const selectedSerialSet = useMemo(() => new Set(Object.values(serialMap).filter(Boolean)), [serialMap]);

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

  const openMappingDialog = async (purchase: PendingPurchase) => {
    const office = resolveOffice();
    if (!office) { toast.error("No office configured"); return; }

    setLoadingSerials(true);
    setMappingPurchase(purchase);
    setSerialMap({});
    setSerialFilter("");

    try {
      const { data, error } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("id, serial_number")
        .eq("office_name", office)
        .eq("status", "available")
        .order("serial_number", { ascending: true })
        .limit(500);

      if (error) throw error;
      setAvailableSerials((data as any[] || []).map((s: any) => ({ id: s.id, serial_number: s.serial_number })));
    } catch (err: any) {
      toast.error(err.message || "Failed to load serials");
      setMappingPurchase(null);
    }
    setLoadingSerials(false);
  };

  const handleAutoFill = () => {
    if (!mappingPurchase) return;
    const newMap: Record<string, string> = {};
    const used = new Set<string>();
    for (const cardId of mappingPurchase.card_ids) {
      const next = availableSerials.find(s => !used.has(s.serial_number));
      if (next) {
        newMap[cardId] = next.serial_number;
        used.add(next.serial_number);
      }
    }
    setSerialMap(newMap);
  };

  const allMapped = mappingPurchase
    ? mappingPurchase.card_ids.every(id => serialMap[id])
    : false;

  const handleConfirmAssign = async () => {
    if (!mappingPurchase || !allMapped) return;
    setAssigning(true);

    const office = resolveOffice();
    if (!office) { toast.error("No office configured"); setAssigning(false); return; }

    try {
      const assignedList: string[] = [];

      for (const cardId of mappingPurchase.card_ids) {
        const chosenSerial = serialMap[cardId];
        const serialRecord = availableSerials.find(s => s.serial_number === chosenSerial);
        if (!serialRecord) { toast.error(`Serial ${chosenSerial} not found`); continue; }

        // Atomically claim the serial
        const { data: updated, error: stockErr } = await supabase
          .from("rent_card_serial_stock" as any)
          .update({
            status: "assigned",
            assigned_to_card_id: cardId,
            assigned_at: new Date().toISOString(),
            assigned_by: user?.id,
          })
          .eq("id", serialRecord.id)
          .eq("status", "available")
          .select("id");

        if (stockErr) throw stockErr;
        if (!updated || updated.length === 0) {
          toast.error(`Serial ${chosenSerial} was claimed by another admin`);
          continue;
        }

        const { error: cardErr } = await supabase
          .from("rent_cards")
          .update({ serial_number: chosenSerial, status: "valid" } as any)
          .eq("id", cardId);

        if (cardErr) throw cardErr;
        assignedList.push(chosenSerial);
      }

      if (assignedList.length > 0) {
        const officeId = profile?.isMainAdmin ? profile?.officeId || GHANA_OFFICES[0]?.id : profile?.officeId;
        const { data: existingAudit } = await supabase
          .from("serial_assignments" as any)
          .select("id")
          .eq("purchase_id", mappingPurchase.purchase_id)
          .limit(1);

        if (!existingAudit || existingAudit.length === 0) {
          await supabase.from("serial_assignments" as any).insert({
            purchase_id: mappingPurchase.purchase_id,
            landlord_user_id: mappingPurchase.landlord_user_id,
            office_name: office,
            office_id: officeId || null,
            assigned_by: user?.id,
            serial_numbers: assignedList,
            card_count: assignedList.length,
          });
        }

        setAssignedSerials(prev => ({ ...prev, [mappingPurchase.purchase_id]: assignedList }));
        setPurchases(prev => prev.filter(p => p.purchase_id !== mappingPurchase.purchase_id));
        onStockChanged();
        toast.success(`${assignedList.length} serial(s) assigned successfully!`);
      }

      setMappingPurchase(null);
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    }
    setAssigning(false);
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
            <Button onClick={() => openMappingDialog(p)} className="w-full sm:w-auto">
              <CreditCard className="h-4 w-4 mr-1" /> Assign Serials
            </Button>
          </div>
        ))}

        {Object.entries(assignedSerials).map(([purchaseId, serials]) => {
          const sorted = [...serials].sort();
          const rangeLabel = sorted.length > 1
            ? `${sorted[0]} → ${sorted[sorted.length - 1]}`
            : sorted[0];
          return (
            <div key={purchaseId} className="border border-success/30 bg-success/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <p className="font-semibold text-success text-sm">Assigned — {purchaseId}</p>
              </div>
              <p className="font-mono text-xs text-card-foreground">{rangeLabel} ({sorted.length} serial{sorted.length > 1 ? "s" : ""})</p>
              <div className="flex flex-wrap gap-2">
                {serials.map(s => (
                  <Badge key={s} variant="outline" className="font-mono text-xs">{s}</Badge>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Serial Mapping Dialog */}
      <Dialog open={!!mappingPurchase} onOpenChange={open => { if (!open && !assigning) setMappingPurchase(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Serials — {mappingPurchase?.purchase_id}</DialogTitle>
            <DialogDescription>
              Pick a specific serial number for each rent card. {mappingPurchase?.landlord_name} ({mappingPurchase?.landlord_id_code})
            </DialogDescription>
          </DialogHeader>

          {loadingSerials ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading available serials…</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {availableSerials.length} serial(s) available in office stock
                </p>
                <Button variant="outline" size="sm" onClick={handleAutoFill}>
                  <Wand2 className="h-3 w-3 mr-1" /> Auto-fill sequential
                </Button>
              </div>

              <div className="space-y-3">
                {mappingPurchase?.card_ids.map((cardId, idx) => {
                  const currentVal = serialMap[cardId] || "";
                  // Available options: not selected by other cards, or the one selected for this card
                  const options = availableSerials.filter(
                    s => !selectedSerialSet.has(s.serial_number) || s.serial_number === currentVal
                  );
                  return (
                    <div key={cardId} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                      <div className="min-w-0 flex-shrink-0">
                        <span className="text-xs font-medium text-muted-foreground">Card {idx + 1}</span>
                        <p className="font-mono text-xs text-card-foreground truncate max-w-[140px]" title={cardId}>
                          {cardId.slice(0, 8)}…
                        </p>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={currentVal}
                          onValueChange={val => setSerialMap(prev => ({ ...prev, [cardId]: val }))}
                        >
                          <SelectTrigger className="font-mono text-xs">
                            <SelectValue placeholder="Select serial number…" />
                          </SelectTrigger>
                          <SelectContent className="max-h-[200px]">
                            {options.map(s => (
                              <SelectItem key={s.serial_number} value={s.serial_number} className="font-mono text-xs">
                                {s.serial_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMappingPurchase(null)} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAssign} disabled={!allMapped || assigning}>
              {assigning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Assigning…</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> Confirm Assignment ({mappingPurchase?.pending_count})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingPurchases;

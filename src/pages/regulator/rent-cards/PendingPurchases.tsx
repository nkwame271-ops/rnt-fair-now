import { useState, useMemo, useRef, useEffect } from "react";
import { Search, CreditCard, Loader2, CheckCircle } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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

/* ─── Searchable serial picker ─── */
const SerialSearchPicker = ({
  options,
  value,
  onChange,
}: {
  options: SerialOption[];
  value: string;
  onChange: (val: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 100);
    const q = query.toUpperCase();
    return options.filter(s => s.serial_number.toUpperCase().includes(q)).slice(0, 100);
  }, [options, query]);

  return (
    <div ref={containerRef} className="relative">
      {value && !open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setQuery(""); }}
          className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-left font-mono text-xs ring-offset-background hover:bg-accent/50 transition-colors"
        >
          <span className="flex-1 truncate">{value}</span>
          <span className="text-muted-foreground text-[10px] ml-2">Change</span>
        </button>
      ) : (
        <Input
          ref={inputRef}
          placeholder="Type to search serial…"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="font-mono text-xs"
          autoComplete="off"
        />
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">No serials found</p>
          ) : (
            filtered.map(s => (
              <button
                key={s.serial_number}
                type="button"
                className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent transition-colors ${
                  s.serial_number === value ? "bg-accent text-accent-foreground" : "text-popover-foreground"
                }`}
                onClick={() => {
                  onChange(s.serial_number);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {s.serial_number}
              </button>
            ))
          )}
          {options.length > 100 && filtered.length >= 100 && (
            <p className="text-[10px] text-muted-foreground text-center py-1">
              Showing first 100 — type to narrow results
            </p>
          )}
        </div>
      )}
    </div>
  );
};

interface PendingCard {
  id: string;
  purchase_id: string;
  landlord_user_id: string;
  landlord_name: string;
  landlord_id_code: string;
  purchased_at: string;
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
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([]);
  const [searched, setSearched] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignedSerials, setAssignedSerials] = useState<Record<string, string[]>>({});

  // Selection state
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());

  // Assignment mode
  type AssignMode = "auto_qty" | "start_from" | "range" | "manual";
  const [assignMode, setAssignMode] = useState<AssignMode>("auto_qty");
  const [startFromSerial, setStartFromSerial] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Mapping state
  const [mappingCards, setMappingCards] = useState<PendingCard[]>([]);
  const [serialMap, setSerialMap] = useState<Record<string, string>>({});
  const [availableSerials, setAvailableSerials] = useState<SerialOption[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);

  const selectedSerialSet = useMemo(() => new Set(Object.values(serialMap).filter(Boolean)), [serialMap]);

  // Computed: serials for "start_from" mode
  const startFromPreview = useMemo(() => {
    if (!startFromSerial || availableSerials.length === 0) return [];
    const idx = availableSerials.findIndex(s => s.serial_number === startFromSerial);
    if (idx === -1) return [];
    return availableSerials.slice(idx, idx + mappingCards.length);
  }, [startFromSerial, availableSerials, mappingCards.length]);

  // Computed: serials for "range" mode
  const rangePreview = useMemo(() => {
    if (!rangeFrom || !rangeTo || availableSerials.length === 0) return [];
    const fromIdx = availableSerials.findIndex(s => s.serial_number === rangeFrom);
    const toIdx = availableSerials.findIndex(s => s.serial_number === rangeTo);
    if (fromIdx === -1 || toIdx === -1 || toIdx < fromIdx) return [];
    return availableSerials.slice(fromIdx, toIdx + 1);
  }, [rangeFrom, rangeTo, availableSerials]);
    ? ""
    : GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || "";

  const resolveOffice = () => {
    return profile?.isMainAdmin
      ? GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || GHANA_OFFICES[0]?.name
      : officeName;
  };

  const selectedSerialSet = useMemo(() => new Set(Object.values(serialMap).filter(Boolean)), [serialMap]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);
    setPendingCards([]);
    setSelectedCardIds(new Set());

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
      const results: PendingCard[] = [];

      for (const card of cards as any[]) {
        const purchaseId = card.purchase_id || card.id;
        const landlordIdCode = landlordIdMap.get(card.landlord_user_id) || "";
        const matchesPurchase = purchaseId.toUpperCase().includes(q);
        const matchesLandlord = landlordIdCode.toUpperCase().includes(q);
        const matchesName = (profileMap.get(card.landlord_user_id) || "").toUpperCase().includes(q);
        if (!matchesPurchase && !matchesLandlord && !matchesName) continue;

        results.push({
          id: card.id,
          purchase_id: purchaseId,
          landlord_user_id: card.landlord_user_id,
          landlord_name: profileMap.get(card.landlord_user_id) || "Unknown",
          landlord_id_code: landlordIdCode || "—",
          purchased_at: card.purchased_at,
        });
      }

      setPendingCards(results);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    }
    setSearching(false);
  };

  const toggleCard = (cardId: string) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedCardIds.size === pendingCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(pendingCards.map(c => c.id)));
    }
  };

  const openMappingDialog = async () => {
    const selected = pendingCards.filter(c => selectedCardIds.has(c.id));
    if (selected.length === 0) { toast.error("Select at least one card"); return; }

    const office = resolveOffice();
    if (!office) { toast.error("No office configured"); return; }

    setLoadingSerials(true);
    setMappingCards(selected);
    setSerialMap({});

    try {
      let allSerials: any[] = [];
      let from = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from("rent_card_serial_stock" as any)
          .select("id, serial_number")
          .eq("office_name", office)
          .eq("status", "available")
          .order("serial_number", { ascending: true })
          .range(from, from + PAGE - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;
        allSerials = allSerials.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setAvailableSerials(allSerials.map((s: any) => ({ id: s.id, serial_number: s.serial_number })));
    } catch (err: any) {
      toast.error(err.message || "Failed to load serials");
      setMappingCards([]);
    }
    setLoadingSerials(false);
  };

  const handleAutoFill = () => {
    if (mappingCards.length === 0) return;
    const newMap: Record<string, string> = {};
    const used = new Set<string>();
    for (const card of mappingCards) {
      const next = availableSerials.find(s => !used.has(s.serial_number));
      if (next) {
        newMap[card.id] = next.serial_number;
        used.add(next.serial_number);
      }
    }
    setSerialMap(newMap);
  };

  const allMapped = mappingCards.length > 0 && mappingCards.every(c => serialMap[c.id]);

  const handleConfirmAssign = async () => {
    if (!allMapped) return;
    setAssigning(true);

    const office = resolveOffice();
    if (!office) { toast.error("No office configured"); setAssigning(false); return; }

    try {
      const assignedList: string[] = [];
      const assignedCardIds: string[] = [];

      for (const card of mappingCards) {
        const chosenSerial = serialMap[card.id];
        const serialRecord = availableSerials.find(s => s.serial_number === chosenSerial);
        if (!serialRecord) { toast.error(`Serial ${chosenSerial} not found`); continue; }

        const { data: updated, error: stockErr } = await supabase
          .from("rent_card_serial_stock" as any)
          .update({
            status: "assigned",
            assigned_to_card_id: card.id,
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
          .eq("id", card.id);

        if (cardErr) throw cardErr;
        assignedList.push(chosenSerial);
        assignedCardIds.push(card.id);
      }

      if (assignedList.length > 0) {
        // Group by purchase_id for audit
        const purchaseGroups = new Map<string, { cards: PendingCard[]; serials: string[] }>();
        for (let i = 0; i < assignedCardIds.length; i++) {
          const card = mappingCards.find(c => c.id === assignedCardIds[i])!;
          if (!purchaseGroups.has(card.purchase_id)) {
            purchaseGroups.set(card.purchase_id, { cards: [card], serials: [assignedList[i]] });
          } else {
            purchaseGroups.get(card.purchase_id)!.cards.push(card);
            purchaseGroups.get(card.purchase_id)!.serials.push(assignedList[i]);
          }
        }

        const officeId = profile?.isMainAdmin ? profile?.officeId || GHANA_OFFICES[0]?.id : profile?.officeId;

        for (const [purchaseId, group] of purchaseGroups) {
          const { data: existingAudit } = await supabase
            .from("serial_assignments" as any)
            .select("id")
            .eq("purchase_id", purchaseId)
            .limit(1);

          if (!existingAudit || existingAudit.length === 0) {
            await supabase.from("serial_assignments" as any).insert({
              purchase_id: purchaseId,
              landlord_user_id: group.cards[0].landlord_user_id,
              office_name: office,
              office_id: officeId || null,
              assigned_by: user?.id,
              serial_numbers: group.serials,
              card_count: group.serials.length,
            });
          }
        }

        // Update assigned serials display
        for (const [purchaseId, group] of purchaseGroups) {
          setAssignedSerials(prev => ({
            ...prev,
            [purchaseId]: [...(prev[purchaseId] || []), ...group.serials],
          }));
        }

        // Remove assigned cards from the list
        const assignedSet = new Set(assignedCardIds);
        setPendingCards(prev => prev.filter(c => !assignedSet.has(c.id)));
        setSelectedCardIds(prev => {
          const next = new Set(prev);
          assignedCardIds.forEach(id => next.delete(id));
          return next;
        });
        onStockChanged();
        toast.success(`${assignedList.length} serial(s) assigned successfully!`);
      }

      setMappingCards([]);
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    }
    setAssigning(false);
  };

  // Group cards by purchase_id for display
  const cardsByPurchase = useMemo(() => {
    const groups = new Map<string, PendingCard[]>();
    for (const card of pendingCards) {
      if (!groups.has(card.purchase_id)) groups.set(card.purchase_id, []);
      groups.get(card.purchase_id)!.push(card);
    }
    return groups;
  }, [pendingCards]);

  const allSelected = pendingCards.length > 0 && selectedCardIds.size === pendingCards.length;

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

        {searched && pendingCards.length === 0 && !searching && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No pending cards found for "{searchQuery}"
          </div>
        )}

        {/* Selection toolbar */}
        {pendingCards.length > 0 && (
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={allSelected}
                onCheckedChange={toggleAll}
                id="select-all"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
                {allSelected ? "Deselect All" : "Select All"} ({pendingCards.length} card{pendingCards.length !== 1 ? "s" : ""})
              </label>
            </div>
            <Button
              onClick={openMappingDialog}
              disabled={selectedCardIds.size === 0}
              size="sm"
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Assign Serials ({selectedCardIds.size})
            </Button>
          </div>
        )}

        {/* Cards grouped by purchase */}
        {Array.from(cardsByPurchase.entries()).map(([purchaseId, cards]) => (
          <div key={purchaseId} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-sm text-card-foreground">{purchaseId}</p>
                <p className="text-xs text-muted-foreground">
                  {cards[0].landlord_name} ({cards[0].landlord_id_code}) • Purchased: {format(new Date(cards[0].purchased_at), "dd/MM/yyyy")}
                </p>
              </div>
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                {cards.length} card{cards.length > 1 ? "s" : ""} pending
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {cards.map((card, idx) => (
                <label
                  key={card.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={selectedCardIds.has(card.id)}
                    onCheckedChange={() => toggleCard(card.id)}
                  />
                  <CreditCard className="h-4 w-4 text-amber-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">Card {idx + 1}</span>
                    <p className="font-mono text-xs text-card-foreground truncate">{card.id.slice(0, 12)}…</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-600 border-amber-500/20">
                    Awaiting Serial
                  </Badge>
                </label>
              ))}
            </div>
          </div>
        ))}

        {/* Recently assigned display */}
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

      {/* Simplified Assignment Dialog */}
      <Dialog open={mappingCards.length > 0} onOpenChange={open => { if (!open && !assigning) setMappingCards([]); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign Serials — {mappingCards.length} card{mappingCards.length !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              The system will automatically select the next {mappingCards.length} available serial{mappingCards.length !== 1 ? "s" : ""} from office stock.
            </DialogDescription>
          </DialogHeader>

          {loadingSerials ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading available serials…</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cards to assign:</span>
                  <span className="font-semibold text-card-foreground">{mappingCards.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Available serials:</span>
                  <span className="font-semibold text-card-foreground">{availableSerials.length}</span>
                </div>
                {availableSerials.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Serial range:</span>
                    <span className="font-mono text-xs text-card-foreground">
                      {availableSerials[0]?.serial_number} → {availableSerials[Math.min(mappingCards.length - 1, availableSerials.length - 1)]?.serial_number}
                    </span>
                  </div>
                )}
              </div>

              {availableSerials.length < mappingCards.length && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  Not enough serials available. Need {mappingCards.length}, only {availableSerials.length} available.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMappingCards([])} disabled={assigning}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Auto-fill then confirm
                const newMap: Record<string, string> = {};
                for (let i = 0; i < mappingCards.length && i < availableSerials.length; i++) {
                  newMap[mappingCards[i].id] = availableSerials[i].serial_number;
                }
                setSerialMap(newMap);
                // Trigger assignment immediately
                setTimeout(() => {
                  handleConfirmAssign();
                }, 100);
              }}
              disabled={availableSerials.length < mappingCards.length || assigning || loadingSerials}
            >
              {assigning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Assigning…</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> Confirm Auto-Assignment ({mappingCards.length})</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingPurchases;
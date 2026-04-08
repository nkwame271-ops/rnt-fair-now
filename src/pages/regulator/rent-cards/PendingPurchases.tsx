import { useState, useMemo, useRef, useEffect } from "react";
import { Search, CreditCard, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
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
import { AdminProfile, GHANA_OFFICES, getRegionForOffice } from "@/hooks/useAdminProfile";
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

type AssignMode = "auto_qty" | "start_from" | "range" | "manual";

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

  // Assignment mode state
  const [assignMode, setAssignMode] = useState<AssignMode>("auto_qty");
  const [startFromSerial, setStartFromSerial] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");

  // Mapping state
  const [mappingCards, setMappingCards] = useState<PendingCard[]>([]);
  const [serialMap, setSerialMap] = useState<Record<string, string>>({});
  const [availableSerials, setAvailableSerials] = useState<SerialOption[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [quotaContext, setQuotaContext] = useState<{ remaining: number } | null>(null);

  // Paired mode: 1 serial = 2 cards
  const serialsNeeded = useMemo(() => Math.ceil(mappingCards.length / 2), [mappingCards.length]);

  // Computed: serials for "start_from" mode
  const startFromPreview = useMemo(() => {
    if (!startFromSerial || availableSerials.length === 0) return [];
    const idx = availableSerials.findIndex(s => s.serial_number === startFromSerial);
    if (idx === -1) return [];
    return availableSerials.slice(idx, idx + serialsNeeded);
  }, [startFromSerial, availableSerials, serialsNeeded]);

  // Computed: serials for "range" mode
  const rangePreview = useMemo(() => {
    if (!rangeFrom || !rangeTo || availableSerials.length === 0) return [];
    const fromIdx = availableSerials.findIndex(s => s.serial_number === rangeFrom);
    const toIdx = availableSerials.findIndex(s => s.serial_number === rangeTo);
    if (fromIdx === -1 || toIdx === -1 || toIdx < fromIdx) return [];
    return availableSerials.slice(fromIdx, toIdx + 1);
  }, [rangeFrom, rangeTo, availableSerials]);

  // Filter out already-selected serials for manual mode pickers
  const selectedSerialSet = useMemo(() => new Set(Object.values(serialMap).filter(Boolean)), [serialMap]);

  // Group cards into pairs for manual mode
  const cardPairs = useMemo(() => {
    const pairs: { cards: PendingCard[]; pairIndex: number }[] = [];
    for (let i = 0; i < mappingCards.length; i += 2) {
      pairs.push({
        cards: mappingCards.slice(i, i + 2),
        pairIndex: Math.floor(i / 2) + 1,
      });
    }
    return pairs;
  }, [mappingCards]);

  const officeName = profile?.isMainAdmin
    ? ""
    : GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || "";

  const resolveOffice = () => {
    return profile?.isMainAdmin
      ? GHANA_OFFICES.find(o => o.id === profile?.officeId)?.name || GHANA_OFFICES[0]?.name
      : officeName;
  };

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
    setAssignMode("auto_qty");
    setStartFromSerial("");
    setRangeFrom("");
    setRangeTo("");

    try {
      const officeId = profile?.isMainAdmin ? profile?.officeId || GHANA_OFFICES[0]?.id : profile?.officeId;
      const officeRegion = officeId ? getRegionForOffice(officeId) : null;

      // Check if this office has quota/count-based allocations
      let quotaRemaining = Infinity;
      let hasQuota = false;
      if (officeId) {
        const { data: quotaAllocations } = await supabase
          .from("office_allocations" as any)
          .select("quota_limit")
          .eq("office_id", officeId)
          .in("allocation_mode", ["quota", "quantity_transfer"]);

        const totalQuota = (quotaAllocations || []).reduce((sum: number, a: any) => sum + (a.quota_limit || 0), 0);

        if (totalQuota > 0) {
          hasQuota = true;
          const { data: assignments } = await supabase
            .from("serial_assignments" as any)
            .select("card_count")
            .eq("office_id", officeId);

          const totalUsed = (assignments || []).reduce((sum: number, a: any) => sum + (a.card_count || 0), 0);
          quotaRemaining = Math.max(0, totalQuota - totalUsed);

          if (quotaRemaining <= 0) {
            toast.error("Quota exhausted — request more allocation from HQ");
            setMappingCards([]);
            setLoadingSerials(false);
            return;
          }
        }
      }

      let allSerials: any[] = [];
      let from = 0;
      const PAGE = 1000;

      if (hasQuota) {
        // LAYER 1: Regional Registry — show ALL unused regional serials (no slicing!)
        // Allocation only limits how many can be assigned, not which serials are visible
        while (true) {
          const { data, error } = await supabase
            .from("rent_card_serial_stock" as any)
            .select("id, serial_number")
            .eq("region", officeRegion || "")
            .eq("stock_type", "regional")
            .eq("status", "available")
            .eq("pair_index", 1)
            .order("serial_number", { ascending: true })
            .range(from, from + PAGE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          allSerials = allSerials.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        // DO NOT slice — show full regional registry. Quota enforcement happens at confirm time.
      } else {
        // Transfer mode: fetch from office stock (physical stock only)
        while (true) {
          const { data, error } = await supabase
            .from("rent_card_serial_stock" as any)
            .select("id, serial_number")
            .eq("office_name", office)
            .eq("stock_type", "office")
            .eq("status", "available")
            .eq("pair_index", 1)
            .order("serial_number", { ascending: true })
            .range(from, from + PAGE - 1);

          if (error) throw error;
          if (!data || data.length === 0) break;
          allSerials = allSerials.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
      }
      setAvailableSerials(allSerials.map((s: any) => ({ id: s.id, serial_number: s.serial_number })));
      // Store quota remaining for enforcement at confirm time
      setQuotaContext(hasQuota ? { remaining: quotaRemaining } : null);
    } catch (err: any) {
      toast.error(err.message || "Failed to load serials");
      setMappingCards([]);
    }
    setLoadingSerials(false);
  };

  const allMapped = mappingCards.length > 0 && mappingCards.every(c => serialMap[c.id]);

  // For manual mode with pairing: derive pairSerialMap (pairIndex -> serial)
  const pairSerialMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const pair of cardPairs) {
      const val = serialMap[pair.cards[0].id];
      if (val) map[pair.pairIndex] = val;
    }
    return map;
  }, [cardPairs, serialMap]);

  // Build serial map based on mode, then call handleConfirmAssign
  // Paired logic: card[i] → serial[Math.floor(i/2)]
  const buildAndAssign = () => {
    const newMap: Record<string, string> = {};

    if (assignMode === "auto_qty") {
      for (let i = 0; i < mappingCards.length; i++) {
        const serialIdx = Math.floor(i / 2);
        if (serialIdx < availableSerials.length) {
          newMap[mappingCards[i].id] = availableSerials[serialIdx].serial_number;
        }
      }
    } else if (assignMode === "start_from") {
      for (let i = 0; i < mappingCards.length; i++) {
        const serialIdx = Math.floor(i / 2);
        if (serialIdx < startFromPreview.length) {
          newMap[mappingCards[i].id] = startFromPreview[serialIdx].serial_number;
        }
      }
    } else if (assignMode === "range") {
      for (let i = 0; i < mappingCards.length; i++) {
        const serialIdx = Math.floor(i / 2);
        if (serialIdx < rangePreview.length) {
          newMap[mappingCards[i].id] = rangePreview[serialIdx].serial_number;
        }
      }
    } else if (assignMode === "manual") {
      for (const pair of cardPairs) {
        const serial = pairSerialMap[pair.pairIndex];
        if (serial) {
          for (const card of pair.cards) {
            newMap[card.id] = serial;
          }
        }
      }
    }

    setSerialMap(newMap);
    // Pass newMap directly to avoid stale state from async React setState
    handleConfirmAssign(newMap);
  };

  // Check if current mode is ready to confirm
  const canConfirm = useMemo(() => {
    if (loadingSerials || assigning) return false;
    if (assignMode === "auto_qty") {
      return availableSerials.length >= serialsNeeded;
    }
    if (assignMode === "start_from") {
      return startFromPreview.length >= serialsNeeded;
    }
    if (assignMode === "range") {
      return rangePreview.length === serialsNeeded;
    }
    if (assignMode === "manual") {
      return cardPairs.length > 0 && cardPairs.every(p => pairSerialMap[p.pairIndex]);
    }
    return false;
  }, [assignMode, availableSerials.length, serialsNeeded, cardPairs, pairSerialMap, startFromPreview, rangePreview, loadingSerials, assigning]);

  const confirmLabel = useMemo(() => {
    if (assignMode === "auto_qty") return `Confirm Auto-Assignment (${serialsNeeded} serials → ${mappingCards.length} cards)`;
    if (assignMode === "start_from") return `Assign from ${startFromSerial || "…"} (${serialsNeeded} serials)`;
    if (assignMode === "range") return `Assign Range (${rangePreview.length}/${serialsNeeded} serials)`;
    if (assignMode === "manual") return `Confirm Manual Assignment`;
    return "Confirm";
  }, [assignMode, serialsNeeded, mappingCards.length, startFromSerial, rangePreview.length]);

  const handleConfirmAssign = async (mapOverride?: Record<string, string>) => {
    const activeMap = mapOverride ?? serialMap;
    const isFullyMapped = mappingCards.length > 0 && mappingCards.every(c => activeMap[c.id]);
    if (!isFullyMapped) return;

    // LAYER 2 enforcement: if quota-based, block if assignment count exceeds remaining
    if (quotaContext && mappingCards.length > quotaContext.remaining) {
      toast.error(`Quota allows only ${quotaContext.remaining} more assignment(s), but ${mappingCards.length} selected`);
      return;
    }

    setAssigning(true);

    const office = resolveOffice();
    if (!office) { toast.error("No office configured"); setAssigning(false); return; }

    try {
      const assignedList: string[] = [];
      const assignedCardIds: string[] = [];
      const processedSerials = new Set<string>();

      for (const card of mappingCards) {
        const chosenSerial = activeMap[card.id];

        // Only update stock rows once per unique serial (first card in pair)
        if (!processedSerials.has(chosenSerial)) {
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

          // Also mark the pair_index=2 copy as assigned (paired mode)
          await supabase
            .from("rent_card_serial_stock" as any)
            .update({
              status: "assigned",
              assigned_to_card_id: card.id,
              assigned_at: new Date().toISOString(),
              assigned_by: user?.id,
            })
            .eq("serial_number", chosenSerial)
            .eq("pair_index", 2)
            .eq("status", "available");

          processedSerials.add(chosenSerial);
        }

        // Always update the rent_cards row for every card in the pair
        const officeId = profile?.isMainAdmin ? profile?.officeId || GHANA_OFFICES[0]?.id : profile?.officeId;
        const { error: cardErr } = await supabase
          .from("rent_cards")
          .update({
            serial_number: chosenSerial,
            status: "valid",
            assigned_office_id: officeId || null,
            assigned_office_name: office,
          } as any)
          .eq("id", card.id);

        if (cardErr) throw cardErr;
        assignedList.push(chosenSerial);
        assignedCardIds.push(card.id);
      }

      if (assignedList.length > 0) {
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

          // Finalize deferred office attribution for rent card purchases
          if (officeId) {
            try {
              // Find the escrow_transaction_id from the rent card
              const { data: cardData } = await supabase
                .from("rent_cards")
                .select("escrow_transaction_id")
                .eq("id", group.cards[0].id)
                .single();

              if (cardData?.escrow_transaction_id) {
                await supabase.functions.invoke("finalize-office-attribution", {
                  body: {
                    escrow_transaction_id: cardData.escrow_transaction_id,
                    office_id: officeId,
                  },
                });
              }
            } catch (e: any) {
              console.warn("Office attribution deferred:", e.message);
            }
          }
        }

        for (const [purchaseId, group] of purchaseGroups) {
          setAssignedSerials(prev => ({
            ...prev,
            [purchaseId]: [...(prev[purchaseId] || []), ...group.serials],
          }));
        }

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

        {pendingCards.length > 0 && (
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-2 bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} id="select-all" />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer select-none">
                {allSelected ? "Deselect All" : "Select All"} ({pendingCards.length} card{pendingCards.length !== 1 ? "s" : ""})
              </label>
            </div>
            <Button onClick={openMappingDialog} disabled={selectedCardIds.size === 0} size="sm">
              <CreditCard className="h-4 w-4 mr-1" />
              Assign Serials ({selectedCardIds.size})
            </Button>
          </div>
        )}

        {Array.from(cardsByPurchase.entries()).map(([purchaseId, cards]) => (
          <div key={purchaseId} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
              <div>
                <p className="font-mono font-bold text-sm text-card-foreground">{purchaseId}</p>
                <p className="text-xs text-muted-foreground">
                  {cards[0].landlord_name} ({cards[0].landlord_id_code}) • Purchased: {format(new Date(cards[0].purchased_at), "dd/MM/yyyy")}
                </p>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                {cards.length} card{cards.length > 1 ? "s" : ""} pending
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {cards.map((card, idx) => (
                <label
                  key={card.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <Checkbox checked={selectedCardIds.has(card.id)} onCheckedChange={() => toggleCard(card.id)} />
                  <CreditCard className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-muted-foreground">Card {idx + 1}</span>
                    <p className="font-mono text-xs text-card-foreground truncate">{card.id.slice(0, 12)}…</p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    Awaiting Serial
                  </Badge>
                </label>
              ))}
            </div>
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

      {/* Assignment Dialog with 4 modes */}
      <Dialog open={mappingCards.length > 0} onOpenChange={open => { if (!open && !assigning) setMappingCards([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Serials — {mappingCards.length} card{mappingCards.length !== 1 ? "s" : ""}</DialogTitle>
            <DialogDescription>
              Choose an assignment mode and confirm.
            </DialogDescription>
          </DialogHeader>

          {loadingSerials ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Loading available serials…</span>
            </div>
          ) : (
            <div className="space-y-4 flex-1 overflow-y-auto min-h-0">
              {/* Summary */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cards to assign:</span>
                  <span className="font-semibold text-card-foreground">{mappingCards.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serials needed (paired — 1 serial = 2 cards):</span>
                  <span className="font-semibold text-card-foreground">{serialsNeeded}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available serials:</span>
                  <span className="font-semibold text-card-foreground">{availableSerials.length}</span>
                </div>
                {quotaContext && (
                  <div className="flex justify-between border-t border-border pt-1 mt-1">
                    <span className="text-muted-foreground">Quota remaining:</span>
                    <span className={`font-semibold ${quotaContext.remaining >= mappingCards.length ? "text-success" : "text-destructive"}`}>
                      {quotaContext.remaining}
                    </span>
                  </div>
                )}
                {quotaContext && mappingCards.length > quotaContext.remaining && (
                  <p className="text-destructive text-xs mt-1">
                    ⚠ Selected {mappingCards.length} cards but only {quotaContext.remaining} quota remaining. Reduce selection.
                  </p>
                )}
              </div>

              {availableSerials.length === 0 ? (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                  No serials available in office stock.
                </div>
              ) : (
                <>
                  {/* Mode selector */}
                  <RadioGroup
                    value={assignMode}
                    onValueChange={(v) => setAssignMode(v as AssignMode)}
                    className="grid gap-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="auto_qty" id="mode-auto" />
                      <Label htmlFor="mode-auto" className="cursor-pointer text-sm font-medium">
                        Auto Assign by Quantity
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="start_from" id="mode-start" />
                      <Label htmlFor="mode-start" className="cursor-pointer text-sm font-medium">
                        Auto Assign with Start From
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="range" id="mode-range" />
                      <Label htmlFor="mode-range" className="cursor-pointer text-sm font-medium">
                        Assign by selecting a Range
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="manual" id="mode-manual" />
                      <Label htmlFor="mode-manual" className="cursor-pointer text-sm font-medium">
                        Manual Assignment
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Mode-specific content */}
                  {assignMode === "auto_qty" && (
                    <div className="bg-muted/20 rounded-lg p-3 space-y-1 text-sm">
                      <p className="text-muted-foreground">
                        The next <span className="font-semibold text-card-foreground">{serialsNeeded}</span> sequential serial{serialsNeeded !== 1 ? "s" : ""} will be assigned to <span className="font-semibold text-card-foreground">{mappingCards.length}</span> cards (paired).
                      </p>
                      {availableSerials.length > 0 && (
                        <p className="font-mono text-xs text-card-foreground">
                          {availableSerials[0]?.serial_number} → {availableSerials[Math.min(serialsNeeded - 1, availableSerials.length - 1)]?.serial_number}
                        </p>
                      )}
                      {availableSerials.length < serialsNeeded && (
                        <p className="text-destructive text-xs mt-1">
                          Not enough serials. Need {serialsNeeded}, only {availableSerials.length} available.
                        </p>
                      )}
                    </div>
                  )}

                  {assignMode === "start_from" && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1 block">Start from serial:</Label>
                        <SerialSearchPicker
                          options={availableSerials}
                          value={startFromSerial}
                          onChange={setStartFromSerial}
                        />
                      </div>
                      {startFromSerial && (
                        <div className="bg-muted/20 rounded-lg p-3 text-sm space-y-1">
                          <p className="text-muted-foreground">
                            Will use <span className="font-semibold text-card-foreground">{Math.min(startFromPreview.length, serialsNeeded)}</span> serial{serialsNeeded !== 1 ? "s" : ""} for <span className="font-semibold text-card-foreground">{mappingCards.length}</span> cards (paired), starting from <span className="font-mono text-xs">{startFromSerial}</span>
                          </p>
                          {startFromPreview.length > 0 && (
                            <p className="font-mono text-xs text-card-foreground">
                              {startFromPreview[0]?.serial_number} → {startFromPreview[Math.min(serialsNeeded - 1, startFromPreview.length - 1)]?.serial_number}
                            </p>
                          )}
                          {startFromPreview.length < serialsNeeded && (
                            <p className="text-destructive text-xs mt-1">
                              Only {startFromPreview.length} serial{startFromPreview.length !== 1 ? "s" : ""} available from this point. Need {serialsNeeded}.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {assignMode === "range" && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">From:</Label>
                          <SerialSearchPicker
                            options={availableSerials}
                            value={rangeFrom}
                            onChange={setRangeFrom}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">To:</Label>
                          <SerialSearchPicker
                            options={availableSerials}
                            value={rangeTo}
                            onChange={setRangeTo}
                          />
                        </div>
                      </div>
                      {rangeFrom && rangeTo && (
                        <div className="bg-muted/20 rounded-lg p-3 text-sm space-y-1">
                          <p className="text-muted-foreground">
                            Serials in range: <span className="font-semibold text-card-foreground">{rangePreview.length}</span> — Serials needed: <span className="font-semibold text-card-foreground">{serialsNeeded}</span> (for {mappingCards.length} cards, paired)
                          </p>
                          {rangePreview.length !== serialsNeeded && (
                            <p className="text-destructive text-xs">
                              {rangePreview.length > serialsNeeded
                                ? `Range has ${rangePreview.length - serialsNeeded} more serial(s) than needed.`
                                : `Range has ${serialsNeeded - rangePreview.length} fewer serial(s) than needed.`}
                              {" "}Count must match exactly.
                            </p>
                          )}
                          {rangePreview.length === serialsNeeded && (
                            <p className="text-success text-xs font-medium">✓ {rangePreview.length} serials will cover {mappingCards.length} cards (paired).</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {assignMode === "manual" && (
                    <div className="max-h-[50vh] overflow-y-auto border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-3">
                        Select one serial per pair of cards. Each serial covers 2 cards (landlord + tenant copy).
                      </p>
                      <div className="space-y-3">
                        {cardPairs.map((pair) => (
                          <div key={pair.pairIndex} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">
                              Pair {pair.pairIndex} — {pair.cards.map((c, i) => `Card ${(pair.pairIndex - 1) * 2 + i + 1}`).join(" & ")} ({pair.cards[0].landlord_name})
                            </Label>
                            <SerialSearchPicker
                              options={availableSerials.filter(
                                s => !selectedSerialSet.has(s.serial_number) || pairSerialMap[pair.pairIndex] === s.serial_number
                              )}
                              value={pairSerialMap[pair.pairIndex] || ""}
                              onChange={val => {
                                setSerialMap(prev => {
                                  const next = { ...prev };
                                  for (const card of pair.cards) {
                                    next[card.id] = val;
                                  }
                                  return next;
                                });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMappingCards([])} disabled={assigning}>
              Cancel
            </Button>
            <Button onClick={buildAndAssign} disabled={!canConfirm}>
              {assigning ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Assigning…</>
              ) : (
                <><CheckCircle className="h-4 w-4 mr-1" /> {confirmLabel}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingPurchases;

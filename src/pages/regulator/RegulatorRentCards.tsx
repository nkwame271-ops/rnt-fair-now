import { useState } from "react";
import { CreditCard, Search, Loader2, Upload, CheckCircle, Package, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PageTransition from "@/components/PageTransition";
import { format } from "date-fns";

interface PendingPurchase {
  purchase_id: string;
  landlord_user_id: string;
  landlord_name: string;
  landlord_id_code: string;
  pending_count: number;
  purchased_at: string;
  card_ids: string[];
}

const RegulatorRentCards = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [purchases, setPurchases] = useState<PendingPurchase[]>([]);
  const [searched, setSearched] = useState(false);

  const [officeName, setOfficeName] = useState("");
  const [serialInput, setSerialInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [stockCount, setStockCount] = useState<number | null>(null);

  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignedSerials, setAssignedSerials] = useState<Record<string, string[]>>({});

  // Fetch available stock count for the office
  const fetchStockCount = async (office: string) => {
    if (!office) { setStockCount(null); return; }
    const { count } = await supabase
      .from("rent_card_serial_stock" as any)
      .select("id", { count: "exact", head: true })
      .eq("office_name", office)
      .eq("status", "available");
    setStockCount(count ?? 0);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);
    setPurchases([]);

    try {
      // Search rent_cards with awaiting_serial status
      let query = supabase
        .from("rent_cards")
        .select("id, purchase_id, landlord_user_id, purchased_at")
        .eq("status", "awaiting_serial");

      // Try matching purchase_id or landlord
      const { data: cards, error } = await query;
      if (error) throw error;

      if (!cards || cards.length === 0) {
        setSearching(false);
        return;
      }

      // Filter by search query (purchase_id or landlord_id)
      const landlordUserIds = [...new Set(cards.map((c: any) => c.landlord_user_id))];

      // Fetch landlord profiles and IDs
      const [profilesRes, landlordsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", landlordUserIds),
        supabase.from("landlords").select("user_id, landlord_id").in("user_id", landlordUserIds),
      ]);

      const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.user_id, p.full_name]));
      const landlordIdMap = new Map((landlordsRes.data || []).map((l: any) => [l.user_id, l.landlord_id]));

      const q = searchQuery.trim().toUpperCase();

      // Group by purchase_id, filter by query
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
    if (!officeName.trim()) {
      toast.error("Please enter your office name first");
      return;
    }

    setAssigning(purchase.purchase_id);

    try {
      const qty = purchase.pending_count;

      // Fetch available serials from office stock
      const { data: availableSerials, error: stockErr } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("id, serial_number")
        .eq("office_name", officeName.trim())
        .eq("status", "available")
        .order("created_at", { ascending: true })
        .limit(qty);

      if (stockErr) throw stockErr;
      if (!availableSerials || availableSerials.length < qty) {
        toast.error(`Not enough serials in stock. Available: ${availableSerials?.length || 0}, needed: ${qty}`);
        setAssigning(null);
        return;
      }

      // Assign each serial to a card
      const assignedList: string[] = [];
      for (let i = 0; i < qty; i++) {
        const serial = (availableSerials as any)[i];
        const cardId = purchase.card_ids[i];

        // Update rent_card with serial and status
        const { error: cardErr } = await supabase
          .from("rent_cards")
          .update({ serial_number: serial.serial_number, status: "valid" } as any)
          .eq("id", cardId);

        if (cardErr) throw cardErr;

        // Mark stock serial as assigned
        const { error: stockUpdateErr } = await supabase
          .from("rent_card_serial_stock" as any)
          .update({ status: "assigned", assigned_to_card_id: cardId, assigned_at: new Date().toISOString() })
          .eq("id", serial.id);

        if (stockUpdateErr) throw stockUpdateErr;

        assignedList.push(serial.serial_number);
      }

      setAssignedSerials(prev => ({ ...prev, [purchase.purchase_id]: assignedList }));

      // Remove from purchases list
      setPurchases(prev => prev.filter(p => p.purchase_id !== purchase.purchase_id));

      // Refresh stock count
      fetchStockCount(officeName.trim());

      toast.success(`${qty} serial(s) assigned successfully!`);
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    }
    setAssigning(null);
  };

  const handleUploadSerials = async () => {
    if (!officeName.trim()) {
      toast.error("Please enter your office name");
      return;
    }
    if (!serialInput.trim()) {
      toast.error("Please enter serial numbers");
      return;
    }

    setUploading(true);
    try {
      // Parse serials: support CSV, newline-separated, or range (RC-001 to RC-010)
      const lines = serialInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const serials: string[] = [];

      for (const line of lines) {
        // Check for range pattern like "RC-20260319-0001 to RC-20260319-0010"
        const rangeMatch = line.match(/^(.+?)(\d+)\s*(?:to|-)\s*\1(\d+)$/i);
        if (rangeMatch) {
          const prefix = rangeMatch[1];
          const start = parseInt(rangeMatch[2]);
          const end = parseInt(rangeMatch[3]);
          const padLen = rangeMatch[2].length;
          for (let i = start; i <= end; i++) {
            serials.push(prefix + String(i).padStart(padLen, "0"));
          }
        } else {
          serials.push(line);
        }
      }

      if (serials.length === 0) {
        toast.error("No valid serials parsed");
        setUploading(false);
        return;
      }

      const rows = serials.map(s => ({
        serial_number: s,
        office_name: officeName.trim(),
        status: "available",
      }));

      const { error } = await supabase.from("rent_card_serial_stock" as any).insert(rows);
      if (error) throw error;

      toast.success(`${serials.length} serial(s) added to ${officeName.trim()} stock`);
      setSerialInput("");
      fetchStockCount(officeName.trim());
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploading(false);
  };

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Rent Card Management</h1>
          <p className="text-muted-foreground mt-1">Assign physical serial numbers to purchased rent cards</p>
        </div>

        {/* Office & Stock Section */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Office Serial Stock
          </h2>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Office Name</Label>
              <Input
                placeholder="e.g. Accra Central Office"
                value={officeName}
                onChange={(e) => {
                  setOfficeName(e.target.value);
                  fetchStockCount(e.target.value.trim());
                }}
              />
            </div>
            {stockCount !== null && (
              <div className="pb-2">
                <Badge variant="outline" className="text-sm px-3 py-1.5">
                  <Hash className="h-3.5 w-3.5 mr-1" />
                  {stockCount} available serial{stockCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            )}
          </div>

          {/* Bulk Upload */}
          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Add Serials to Stock</Label>
            <p className="text-xs text-muted-foreground">
              Enter serial numbers (one per line or comma-separated). Supports ranges like <code>RC-20260319-0001 to RC-20260319-0050</code>.
            </p>
            <Textarea
              rows={3}
              placeholder="RC-20260319-0001, RC-20260319-0002, RC-20260319-0003"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
            />
            <Button onClick={handleUploadSerials} disabled={uploading || !officeName.trim()}>
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? "Uploading..." : "Add to Stock"}
            </Button>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-4">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Find Pending Purchases
          </h2>
          <div className="flex gap-3">
            <Input
              placeholder="Search by Landlord ID or Purchase ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {/* Results */}
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
                disabled={assigning === p.purchase_id || !officeName.trim()}
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

          {/* Show recently assigned */}
          {Object.entries(assignedSerials).map(([purchaseId, serials]) => (
            <div key={purchaseId} className="border border-success/30 bg-success/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <p className="font-semibold text-success text-sm">Successfully assigned — {purchaseId}</p>
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
    </PageTransition>
  );
};

export default RegulatorRentCards;

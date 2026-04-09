import { useState, useEffect, useMemo, useRef } from "react";
import { ArrowRightLeft, Building2, Download, Pencil, RotateCcw, Search, Trash2, PlusCircle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS_OFFICES } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";
import jsPDF from "jspdf";

interface AllocationHistoryItem {
  id: string;
  office_name: string;
  quantity: number;
  allocation_mode: string;
  start_serial: string | null;
  end_serial: string | null;
  created_at: string;
}

interface QuotaUsage {
  office_id: string;
  office_name: string;
  total_quota: number;
  used: number;
  remaining: number;
}

interface Props {
  onStockChanged: () => void;
}

type TransferSubMode = "next_available" | "by_number" | "by_range";

/* ─── Serial Search Picker ─── */
const SerialSearchPicker = ({
  serials,
  value,
  onChange,
  placeholder,
}: {
  serials: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) => {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return serials.slice(0, 50);
    const q = query.toLowerCase();
    return serials.filter(s => s.toLowerCase().includes(q)).slice(0, 50);
  }, [serials, query]);

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
        <Input
          className="w-44 h-8 text-xs pl-6"
          placeholder={placeholder}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-56 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map(s => (
            <button
              key={s}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono hover:bg-accent ${s === value ? "bg-accent/60 font-semibold" : ""}`}
              onClick={() => { onChange(s); setQuery(s); setOpen(false); }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const OfficeAllocation = ({ onStockChanged }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regionalAvailable, setRegionalAvailable] = useState(0);
  const [officeAllocated, setOfficeAllocated] = useState(0);
  const [allocMode, setAllocMode] = useState<"transfer" | "quota">("transfer");
  const [transferSubMode, setTransferSubMode] = useState<TransferSubMode>("next_available");
  const [officeQuantities, setOfficeQuantities] = useState<Record<string, number>>({});
  const [officeRanges, setOfficeRanges] = useState<Record<string, { start: string; end: string }>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [history, setHistory] = useState<AllocationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage[]>([]);
  const [editingQuota, setEditingQuota] = useState<Record<string, number>>({});
  const [updatingQuota, setUpdatingQuota] = useState<string | null>(null);
  const [resetQuotaTarget, setResetQuotaTarget] = useState<{ office_id: string; office_name: string; used: number } | null>(null);
  const [regionalSerials, setRegionalSerials] = useState<string[]>([]);

  // Inventory adjustment state
  const [adjRegion, setAdjRegion] = useState("");
  const [adjOfficeId, setAdjOfficeId] = useState("");
  const [adjType, setAdjType] = useState<"increase" | "decrease">("increase");
  const [adjQuantity, setAdjQuantity] = useState(0);
  const [adjReason, setAdjReason] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjReferenceId, setAdjReferenceId] = useState("");
  const [adjCorrectionTag, setAdjCorrectionTag] = useState("");
  const [showAdjPassword, setShowAdjPassword] = useState(false);

  const adjRegionData = GHANA_REGIONS_OFFICES.find(r => r.region === adjRegion);
  const adjOffices = adjRegionData?.offices || [];
  const adjOfficeName = adjOffices.find(o => o.id === adjOfficeId)?.name || "";

  const regionData = GHANA_REGIONS_OFFICES.find(r => r.region === selectedRegion);
  const offices = regionData?.offices || [];

  // Fetch available regional serials for range mode
  useEffect(() => {
    if (!selectedRegion || transferSubMode !== "by_range") { setRegionalSerials([]); return; }
    const fetchSerials = async () => {
      const { data } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("serial_number")
        .eq("region", selectedRegion)
        .eq("stock_type", "regional")
        .eq("status", "available")
        .eq("pair_index", 1)
        .order("serial_number")
        .limit(5000);
      setRegionalSerials((data || []).map((d: any) => d.serial_number));
    };
    fetchSerials();
  }, [selectedRegion, transferSubMode]);

  useEffect(() => {
    if (!selectedRegion) return;
    const fetchStock = async () => {
      const [regionalRes, officeRes] = await Promise.all([
        supabase
          .from("rent_card_serial_stock" as any)
          .select("id", { count: "exact", head: true })
          .eq("region", selectedRegion)
          .eq("stock_type", "regional")
          .eq("status", "available")
          .eq("pair_index", 1),
        supabase
          .from("rent_card_serial_stock" as any)
          .select("id", { count: "exact", head: true })
          .eq("region", selectedRegion)
          .eq("stock_type", "office")
          .eq("status", "available")
          .eq("pair_index", 1),
      ]);
      setRegionalAvailable(regionalRes.count ?? 0);
      setOfficeAllocated(officeRes.count ?? 0);
    };
    fetchStock();

    setLoadingHistory(true);
    supabase
      .from("office_allocations" as any)
      .select("id, office_name, office_id, quantity, allocation_mode, quota_limit, start_serial, end_serial, created_at")
      .eq("region", selectedRegion)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory((data || []) as any[]);
        setLoadingHistory(false);
        computeQuotaUsage(data || []);
      });
  }, [selectedRegion]);

  const computeQuotaUsage = async (allocationData: any[]) => {
    const quotaEntries = allocationData.filter((d: any) => d.allocation_mode === "quota" || d.allocation_mode === "quantity_transfer");
    if (quotaEntries.length === 0) { setQuotaUsage([]); return; }

    const officeQuotaTotals = new Map<string, { office_name: string; total: number }>();
    for (const entry of quotaEntries) {
      const existing = officeQuotaTotals.get(entry.office_id) || { office_name: entry.office_name, total: 0 };
      existing.total += entry.quota_limit || entry.quantity || 0;
      officeQuotaTotals.set(entry.office_id, existing);
    }

    const officeIds = [...officeQuotaTotals.keys()];
    const { data: assignments } = await supabase
      .from("serial_assignments" as any)
      .select("office_id, card_count")
      .in("office_id", officeIds);

    const usageMap = new Map<string, number>();
    for (const a of (assignments || []) as any[]) {
      usageMap.set(a.office_id, (usageMap.get(a.office_id) || 0) + (a.card_count || 0));
    }
    const usage: QuotaUsage[] = [];
    for (const [oid, info] of officeQuotaTotals) {
      const used = usageMap.get(oid) || 0;
      usage.push({
        office_id: oid,
        office_name: info.office_name,
        total_quota: info.total,
        used,
        remaining: Math.max(0, info.total - used),
      });
    }
    setQuotaUsage(usage);
  };

  // Compute range quantities from actual serial data
  const rangeQuantities: Record<string, number> = {};
  for (const [officeId, range] of Object.entries(officeRanges)) {
    const s = range.start.trim();
    const e = range.end.trim();
    if (s && e && s <= e) {
      const count = regionalSerials.filter(sn => sn >= s && sn <= e).length;
      if (count > 0) rangeQuantities[officeId] = count;
    }
  }

  const totalTransferQty = transferSubMode === "by_range"
    ? Object.values(rangeQuantities).reduce((a, b) => a + b, 0)
    : Object.values(officeQuantities).reduce((a, b) => a + (b || 0), 0);

  const canAllocate = selectedRegion && (
    allocMode === "transfer"
      ? transferSubMode === "by_range"
        ? Object.keys(rangeQuantities).length > 0 && totalTransferQty <= regionalAvailable
        : totalTransferQty > 0 && (transferSubMode === "by_number" || totalTransferQty <= regionalAvailable)
      : Object.values(officeQuantities).some(v => v > 0)
  );

  const handleAllocate = () => {
    if (!canAllocate) { toast.error("Invalid allocation"); return; }
    setShowPassword(true);
  };

  const handleConfirm = async (password: string, reason: string) => {
    setAllocating(true);
    try {
      if (allocMode === "transfer") {
        if (transferSubMode === "by_range") {
          // Range transfer mode
          for (const office of offices) {
            const range = officeRanges[office.id];
            if (!range || !rangeQuantities[office.id]) continue;

            const { data, error } = await supabase.functions.invoke("admin-action", {
              body: {
                action: "allocate_to_office",
                target_id: `RANGE-${office.id}-${Date.now()}`,
                reason,
                password,
                extra: {
                  region: selectedRegion,
                  office_id: office.id,
                  office_name: office.name,
                  quantity: rangeQuantities[office.id],
                  allocation_mode: "range_transfer",
                  start_serial: range.start.trim(),
                  end_serial: range.end.trim(),
                },
              },
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);
          }
          toast.success(`Transferred ${totalTransferQty} serial pairs (by range) to ${Object.keys(rangeQuantities).length} office(s)`);
        } else {
          const mode = transferSubMode === "by_number" ? "quantity_transfer" : "transfer";
          for (const office of offices) {
            const qty = officeQuantities[office.id] || 0;
            if (qty <= 0) continue;

            const { data, error } = await supabase.functions.invoke("admin-action", {
              body: {
                action: "allocate_to_office",
                target_id: `${mode === "quantity_transfer" ? "QTYXFR" : "ALLOC"}-${office.id}-${Date.now()}`,
                reason,
                password,
                extra: {
                  region: selectedRegion,
                  office_id: office.id,
                  office_name: office.name,
                  quantity: qty,
                  allocation_mode: mode,
                  ...(mode === "quantity_transfer" ? { quota_limit: qty } : {}),
                },
              },
            });
            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);
          }
          const label = transferSubMode === "by_number" ? "Allocated (by number)" : "Transferred";
          toast.success(`${label} ${totalTransferQty} serial pairs to ${Object.values(officeQuantities).filter(v => v > 0).length} office(s)`);
        }
      } else {
        // Quota mode — set new quotas
        for (const office of offices) {
          const qty = officeQuantities[office.id] || 0;
          if (qty <= 0) continue;

          const { data, error } = await supabase.functions.invoke("admin-action", {
            body: {
              action: "allocate_to_office",
              target_id: `QUOTA-${office.id}-${Date.now()}`,
              reason,
              password,
              extra: {
                region: selectedRegion,
                office_id: office.id,
                office_name: office.name,
                quantity: qty,
                allocation_mode: "quota",
                quota_limit: qty,
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
        }
        toast.success(`Set quotas for ${Object.values(officeQuantities).filter(v => v > 0).length} office(s)`);
      }

      setOfficeQuantities({});
      setOfficeRanges({});
      onStockChanged();
      refreshRegion();
    } catch (err: any) {
      throw err;
    } finally {
      setAllocating(false);
    }
  };

  const refreshRegion = () => {
    const r = selectedRegion;
    setSelectedRegion("");
    setTimeout(() => setSelectedRegion(r), 100);
  };

  const handleUpdateQuota = async (officeId: string, officeName: string) => {
    const newTotal = editingQuota[officeId];
    if (newTotal === undefined || newTotal === null) return;

    const current = quotaUsage.find(q => q.office_id === officeId);
    if (current && newTotal < current.used) {
      toast.error(`Cannot reduce below used count (${current.used})`);
      return;
    }
    if (current && newTotal === current.total_quota) {
      toast.info("No change");
      return;
    }

    setUpdatingQuota(officeId);
    try {
      // We need password for this, use the edge function
      const password = prompt("Enter admin password to confirm quota change:");
      if (!password) { setUpdatingQuota(null); return; }

      const { data, error } = await supabase.functions.invoke("admin-action", {
        body: {
          action: "adjust_office_quota",
          target_id: `QUOTA-ADJ-${officeId}-${Date.now()}`,
          reason: `Quota adjusted to ${newTotal}`,
          password,
          extra: {
            office_id: officeId,
            office_name: officeName,
            region: selectedRegion,
            new_quota: newTotal,
          },
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success(`Quota updated to ${newTotal} for ${officeName}`);
      setEditingQuota(prev => { const n = { ...prev }; delete n[officeId]; return n; });
      refreshRegion();
      onStockChanged();
    } catch (err: any) {
      toast.error(err.message || "Failed to update quota");
    }
    setUpdatingQuota(null);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" /> Office Allocation
        </h2>
        <p className="text-sm text-muted-foreground">
          Transfer serials from regional stock to specific offices, or set priority quotas.
        </p>

        <div className="space-y-2">
          <Label>Region</Label>
          <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setOfficeQuantities({}); setEditingQuota({}); }}>
            <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
            <SelectContent>
              {GHANA_REGIONS_OFFICES.map(r => (
                <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRegion && (
          <>
            {/* Regional Stock Summary */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">Regional Stock (Available Pairs)</p>
                <p className="text-2xl font-bold text-primary">{regionalAvailable.toLocaleString()}</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border">
                <p className="text-xs text-muted-foreground">Already in Office Stock</p>
                <p className="text-2xl font-bold text-card-foreground">{officeAllocated.toLocaleString()}</p>
              </div>
            </div>

            {/* Allocation Mode Tabs */}
            <Tabs value={allocMode} onValueChange={v => { setAllocMode(v as "transfer" | "quota"); setOfficeQuantities({}); }}>
              <TabsList>
                <TabsTrigger value="transfer">Transfer to Office</TabsTrigger>
                <TabsTrigger value="quota">Priority Quota</TabsTrigger>
              </TabsList>

              <TabsContent value="transfer" className="space-y-3">
                {/* Sub-mode toggle */}
                <RadioGroup
                  value={transferSubMode}
                  onValueChange={v => { setTransferSubMode(v as TransferSubMode); setOfficeQuantities({}); setOfficeRanges({}); }}
                  className="flex flex-wrap gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="next_available" id="sub-next" />
                    <Label htmlFor="sub-next" className="cursor-pointer text-sm">Next Available Serials</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="by_number" id="sub-number" />
                    <Label htmlFor="sub-number" className="cursor-pointer text-sm">Transfer by Number Only</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="by_range" id="sub-range" />
                    <Label htmlFor="sub-range" className="cursor-pointer text-sm">Assign by Manual Range</Label>
                  </div>
                </RadioGroup>

                <p className="text-xs text-muted-foreground">
                  {transferSubMode === "next_available"
                    ? "Physically moves next available serials from regional stock to each office."
                    : transferSubMode === "by_number"
                    ? "Allocates a quantity to the office. Office staff draw from the regional pool until the quantity is exhausted."
                    : "Enter a start and end serial number. All serials in that range are transferred from regional stock to the office."}
                </p>

                <div className="border border-border rounded-lg divide-y divide-border">
                  {offices.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-card-foreground truncate">{o.name}</span>
                      </div>
                      {transferSubMode === "by_range" ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <SerialSearchPicker
                            serials={regionalSerials}
                            value={officeRanges[o.id]?.start || ""}
                            onChange={v => setOfficeRanges(prev => ({
                              ...prev,
                              [o.id]: { start: v, end: prev[o.id]?.end || "" },
                            }))}
                            placeholder="Start serial..."
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <SerialSearchPicker
                            serials={regionalSerials}
                            value={officeRanges[o.id]?.end || ""}
                            onChange={v => setOfficeRanges(prev => ({
                              ...prev,
                              [o.id]: { start: prev[o.id]?.start || "", end: v },
                            }))}
                            placeholder="End serial..."
                          />
                          {rangeQuantities[o.id] && (
                            <Badge variant="secondary" className="text-[10px] whitespace-nowrap">{rangeQuantities[o.id]} pairs</Badge>
                          )}
                        </div>
                      ) : (
                        <Input
                          type="number"
                          min={0}
                          className="w-24 h-8 text-xs"
                          placeholder="0"
                          value={officeQuantities[o.id] || ""}
                          onChange={e => setOfficeQuantities(prev => ({ ...prev, [o.id]: parseInt(e.target.value) || 0 }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
                {totalTransferQty > 0 && (
                  <p className="text-sm text-card-foreground">
                    Total to {transferSubMode === "next_available" ? "transfer" : transferSubMode === "by_range" ? "transfer (range)" : "allocate"}: <strong>{totalTransferQty}</strong> pair(s)
                    {(transferSubMode === "next_available" || transferSubMode === "by_range") && totalTransferQty > regionalAvailable && (
                      <span className="text-destructive ml-2">(exceeds available stock!)</span>
                    )}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="quota" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Set a quota per office. Staff can assign from the full regional pool until their quota is reached. No specific serials are reserved — the system tracks usage.
                </p>

                {/* Current Quota Usage — Editable */}
                {quotaUsage.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-card-foreground">Current Quota Status</p>
                    <div className="border border-border rounded-lg divide-y divide-border">
                      {quotaUsage.map(q => (
                        <div key={q.office_id} className="px-4 py-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-card-foreground">{q.office_name}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground">Used: <strong className="text-primary">{q.used}</strong></span>
                              <Badge variant={q.remaining > 0 ? "default" : "destructive"} className="text-[10px]">
                                {q.remaining > 0 ? `${q.remaining} remaining` : "Exhausted"}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Total Quota:</Label>
                            <Input
                              type="number"
                              min={q.used}
                              className="w-24 h-7 text-xs"
                              value={editingQuota[q.office_id] ?? q.total_quota}
                              onChange={e => setEditingQuota(prev => ({ ...prev, [q.office_id]: parseInt(e.target.value) || 0 }))}
                            />
                            {(editingQuota[q.office_id] !== undefined && editingQuota[q.office_id] !== q.total_quota) && (
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                disabled={updatingQuota === q.office_id || (editingQuota[q.office_id] < q.used)}
                                onClick={() => handleUpdateQuota(q.office_id, q.office_name)}
                              >
                                <Pencil className="h-3 w-3 mr-1" />
                                {updatingQuota === q.office_id ? "Saving…" : "Update"}
                              </Button>
                            )}
                            {q.used > 0 && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => setResetQuotaTarget({ office_id: q.office_id, office_name: q.office_name, used: q.used })}
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Reset Used
                              </Button>
                            )}
                            {editingQuota[q.office_id] !== undefined && editingQuota[q.office_id] < q.used && (
                              <span className="text-destructive text-[10px]">Min: {q.used}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add New Quota */}
                <p className="text-xs font-medium text-card-foreground pt-2">Add Quota</p>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {offices.map(o => {
                    const existing = quotaUsage.find(q => q.office_id === o.id);
                    if (existing) return null; // Already has quota, editable above
                    return (
                      <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-card-foreground">{o.name}</span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          className="w-24 h-8 text-xs"
                          placeholder="Quota"
                          value={officeQuantities[o.id] || ""}
                          onChange={e => setOfficeQuantities(prev => ({ ...prev, [o.id]: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    );
                  })}
                  {offices.every(o => quotaUsage.some(q => q.office_id === o.id)) && (
                    <p className="text-xs text-muted-foreground text-center py-3">All offices have quotas. Use the edit controls above to adjust.</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleAllocate} disabled={!canAllocate || allocating}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              {allocating ? "Allocating..." :
                allocMode === "transfer"
                  ? `${transferSubMode === "next_available" ? "Transfer" : transferSubMode === "by_range" ? "Transfer Range" : "Allocate"} ${totalTransferQty} Pair(s)`
                  : "Set Quotas"}
            </Button>

            {/* Allocation History */}
            <div className="space-y-2 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">Allocation History</p>
                {history.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const doc = new jsPDF();
                        doc.setFontSize(14);
                        doc.text(`Allocation History — ${selectedRegion}`, 14, 20);
                        doc.setFontSize(9);
                        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

                        let y = 38;
                        doc.setFontSize(8);
                        doc.setFont("helvetica", "bold");
                        doc.text("Office", 14, y);
                        doc.text("Mode", 80, y);
                        doc.text("Qty", 120, y);
                        doc.text("Start", 140, y);
                        doc.text("End", 165, y);
                        doc.text("Date", 185, y);
                        y += 6;
                        doc.setFont("helvetica", "normal");

                        history.forEach(h => {
                          if (y > 280) { doc.addPage(); y = 20; }
                          doc.text(h.office_name, 14, y);
                          doc.text(h.allocation_mode, 80, y);
                          doc.text(String(h.quantity), 120, y);
                          doc.text(h.start_serial || "—", 140, y);
                          doc.text(h.end_serial || "—", 165, y);
                          doc.text(new Date(h.created_at).toLocaleDateString(), 185, y);
                          y += 5;
                        });
                        doc.save(`allocation-history-${selectedRegion}-${Date.now()}.pdf`);
                        toast.success("Report downloaded");
                      }}
                    >
                      <Download className="h-3 w-3 mr-1" /> Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-destructive/30"
                      onClick={() => setClearHistoryOpen(true)}
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  </div>
                )}
              </div>
              {loadingHistory ? (
                <p className="text-xs text-muted-foreground">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No allocations yet for this region.</p>
              ) : (
                <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto">
                  {history.map(h => (
                    <div key={h.id} className="flex items-center justify-between px-4 py-2 text-xs">
                      <div>
                        <span className="text-card-foreground font-medium">{h.office_name}</span>
                        <Badge variant="outline" className="ml-2 text-[10px]">{h.allocation_mode}</Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-primary font-bold">{h.quantity}</span>
                        <span className="text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Inventory Adjustment Tool ─── */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          {adjType === "increase" ? <PlusCircle className="h-5 w-5 text-success" /> : <MinusCircle className="h-5 w-5 text-destructive" />}
          Inventory Adjustment
        </h2>
        <p className="text-sm text-muted-foreground">
          Post auditable corrections to office available stock without changing the original allocation quota.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Region</Label>
            <Select value={adjRegion} onValueChange={v => { setAdjRegion(v); setAdjOfficeId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
              <SelectContent>
                {GHANA_REGIONS_OFFICES.map(r => (
                  <SelectItem key={r.region} value={r.region}>{r.region}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {adjRegion && (
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={adjOfficeId} onValueChange={setAdjOfficeId}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {adjOffices.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Adjustment Type</Label>
            <RadioGroup value={adjType} onValueChange={v => setAdjType(v as "increase" | "decrease")} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="increase" id="adj-inc" />
                <Label htmlFor="adj-inc" className="cursor-pointer text-sm text-success">Increase (+)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="decrease" id="adj-dec" />
                <Label htmlFor="adj-dec" className="cursor-pointer text-sm text-destructive">Decrease (−)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>Quantity (pairs)</Label>
            <Input type="number" min={1} value={adjQuantity || ""} onChange={e => setAdjQuantity(parseInt(e.target.value) || 0)} placeholder="e.g. 149" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Reason <span className="text-destructive">*</span></Label>
          <Input value={adjReason} onChange={e => setAdjReason(e.target.value)} placeholder="e.g. Reconciliation correction — physical count exceeded system count" />
        </div>
        <div className="space-y-2">
          <Label>Note (optional)</Label>
          <Textarea value={adjNote} onChange={e => setAdjNote(e.target.value)} placeholder="Additional context..." rows={2} />
        </div>

        <Button
          disabled={!adjOfficeId || !adjQuantity || !adjReason.trim()}
          onClick={() => setShowAdjPassword(true)}
          variant={adjType === "increase" ? "default" : "destructive"}
        >
          {adjType === "increase" ? <PlusCircle className="h-4 w-4 mr-1" /> : <MinusCircle className="h-4 w-4 mr-1" />}
          Post {adjType === "increase" ? "+" : "−"}{adjQuantity} Pair Adjustment
        </Button>
      </div>

      <AdminPasswordConfirm
        open={showAdjPassword}
        onOpenChange={setShowAdjPassword}
        title={`Post Inventory ${adjType === "increase" ? "Increase" : "Decrease"}`}
        description={`This will ${adjType === "increase" ? "add" : "remove"} ${adjQuantity} pairs ${adjType === "increase" ? "to" : "from"} ${adjOfficeName} available stock. This is recorded as an auditable inventory adjustment.`}
        actionLabel={`${adjType === "increase" ? "+" : "−"}${adjQuantity} Pairs`}
        onConfirm={async (password, reason) => {
          const { data, error } = await supabase.functions.invoke("admin-action", {
            body: {
              action: "inventory_adjustment",
              target_id: `ADJ-${adjOfficeId}-${Date.now()}`,
              reason: reason || adjReason,
              password,
              extra: {
                office_id: adjOfficeId,
                office_name: adjOfficeName,
                region: adjRegion,
                adjustment_type: adjType,
                quantity: adjQuantity,
                note: adjNote || null,
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          toast.success(`Inventory adjustment posted: ${adjType === "increase" ? "+" : "−"}${adjQuantity} pairs to ${adjOfficeName}`);
          setAdjQuantity(0);
          setAdjReason("");
          setAdjNote("");
          onStockChanged();
        }}
      />

      <AdminPasswordConfirm
        open={showPassword}
        onOpenChange={setShowPassword}
        title={allocMode === "transfer"
          ? (transferSubMode === "next_available" ? "Confirm Office Transfer" : transferSubMode === "by_range" ? "Confirm Range Transfer" : "Confirm Quantity Allocation")
          : "Confirm Quota Assignment"}
        description={allocMode === "transfer"
          ? (transferSubMode === "next_available"
              ? `Transfer ${totalTransferQty} serial pair(s) from regional stock to office stock. This action is logged.`
              : transferSubMode === "by_range"
              ? `Transfer ${totalTransferQty} serial pair(s) by manual range from regional stock to office stock. The system will validate all serials in the range exist and are available. This action is logged.`
              : `Allocate ${totalTransferQty} pair(s) by number to office(s). Staff will draw from regional stock. This action is logged.`)
          : `Set priority quotas for offices in ${selectedRegion}. This action is logged.`}
        actionLabel={allocMode === "transfer"
          ? (transferSubMode === "next_available" || transferSubMode === "by_range" ? "Transfer" : "Allocate")
          : "Set Quotas"}
        onConfirm={handleConfirm}
      />

      <AdminPasswordConfirm
        open={!!resetQuotaTarget}
        onOpenChange={() => setResetQuotaTarget(null)}
        title="Reset Used Quota"
        description={`This will reset the used quota count (${resetQuotaTarget?.used || 0}) for "${resetQuotaTarget?.office_name}". All serial assignment records for this office will be deleted. This action is logged and cannot be undone.`}
        actionLabel="Reset Used Quota"
        onConfirm={async (password, reason) => {
          const { data, error } = await supabase.functions.invoke("admin-action", {
            body: {
              action: "reset_office_quota_usage",
              target_id: `QUOTA-RESET-${resetQuotaTarget!.office_id}-${Date.now()}`,
              reason,
              password,
              extra: {
                office_id: resetQuotaTarget!.office_id,
                office_name: resetQuotaTarget!.office_name,
                region: selectedRegion,
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          toast.success(`Used quota reset for ${resetQuotaTarget!.office_name}`);
          setResetQuotaTarget(null);
          refreshRegion();
          onStockChanged();
        }}
      />

      <AdminPasswordConfirm
        open={clearHistoryOpen}
        onOpenChange={setClearHistoryOpen}
        title="Clear Allocation History"
        description={`This will permanently delete all allocation history records for ${selectedRegion}. This action is logged and cannot be undone.`}
        actionLabel="Clear History"
        onConfirm={async (password, reason) => {
          const { data, error } = await supabase.functions.invoke("admin-action", {
            body: {
              action: "clear_allocation_history",
              target_id: `ALLOC-CLEAR-${selectedRegion}-${Date.now()}`,
              reason,
              password,
              extra: { region: selectedRegion },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
          toast.success("Allocation history cleared");
          setClearHistoryOpen(false);
          refreshRegion();
        }}
      />
    </div>
  );
};

export default OfficeAllocation;

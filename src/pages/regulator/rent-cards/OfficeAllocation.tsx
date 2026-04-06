import { useState, useEffect } from "react";
import { ArrowRightLeft, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { GHANA_REGIONS_OFFICES } from "@/hooks/useAdminProfile";
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

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

type TransferSubMode = "next_available" | "by_number";

const OfficeAllocation = ({ onStockChanged }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regionalAvailable, setRegionalAvailable] = useState(0);
  const [officeAllocated, setOfficeAllocated] = useState(0);
  const [allocMode, setAllocMode] = useState<"transfer" | "quota">("transfer");
  const [transferSubMode, setTransferSubMode] = useState<TransferSubMode>("next_available");
  const [officeQuantities, setOfficeQuantities] = useState<Record<string, number>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [history, setHistory] = useState<AllocationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage[]>([]);
  const [editingQuota, setEditingQuota] = useState<Record<string, number>>({});
  const [updatingQuota, setUpdatingQuota] = useState<string | null>(null);

  const regionData = GHANA_REGIONS_OFFICES.find(r => r.region === selectedRegion);
  const offices = regionData?.offices || [];

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

    // Fetch history and quota usage
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

  const totalTransferQty = Object.values(officeQuantities).reduce((a, b) => a + (b || 0), 0);
  const canAllocate = selectedRegion && (
    allocMode === "transfer"
      ? totalTransferQty > 0 && (transferSubMode === "by_number" || totalTransferQty <= regionalAvailable)
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
                  onValueChange={v => { setTransferSubMode(v as TransferSubMode); setOfficeQuantities({}); }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="next_available" id="sub-next" />
                    <Label htmlFor="sub-next" className="cursor-pointer text-sm">Next Available Serials</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="by_number" id="sub-number" />
                    <Label htmlFor="sub-number" className="cursor-pointer text-sm">Transfer by Number Only</Label>
                  </div>
                </RadioGroup>

                <p className="text-xs text-muted-foreground">
                  {transferSubMode === "next_available"
                    ? "Physically moves next available serials from regional stock to each office."
                    : "Allocates a quantity to the office. Office staff draw from the regional pool until the quantity is exhausted."}
                </p>

                <div className="border border-border rounded-lg divide-y divide-border">
                  {offices.map(o => (
                    <div key={o.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-card-foreground">{o.name}</span>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        className="w-24 h-8 text-xs"
                        placeholder="0"
                        value={officeQuantities[o.id] || ""}
                        onChange={e => setOfficeQuantities(prev => ({ ...prev, [o.id]: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
                {totalTransferQty > 0 && (
                  <p className="text-sm text-card-foreground">
                    Total to {transferSubMode === "next_available" ? "transfer" : "allocate"}: <strong>{totalTransferQty}</strong> pair(s)
                    {transferSubMode === "next_available" && totalTransferQty > regionalAvailable && (
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
                          <div className="flex items-center gap-2">
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
                  ? `${transferSubMode === "next_available" ? "Transfer" : "Allocate"} ${totalTransferQty} Pair(s)`
                  : "Set Quotas"}
            </Button>

            {/* Allocation History */}
            <div className="space-y-2 pt-4 border-t border-border">
              <p className="text-sm font-medium text-card-foreground">Allocation History</p>
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

      <AdminPasswordConfirm
        open={showPassword}
        onOpenChange={setShowPassword}
        title={allocMode === "transfer"
          ? (transferSubMode === "next_available" ? "Confirm Office Transfer" : "Confirm Quantity Allocation")
          : "Confirm Quota Assignment"}
        description={allocMode === "transfer"
          ? (transferSubMode === "next_available"
              ? `Transfer ${totalTransferQty} serial pair(s) from regional stock to office stock. This action is logged.`
              : `Allocate ${totalTransferQty} pair(s) by number to office(s). Staff will draw from regional stock. This action is logged.`)
          : `Set priority quotas for offices in ${selectedRegion}. This action is logged.`}
        actionLabel={allocMode === "transfer"
          ? (transferSubMode === "next_available" ? "Transfer" : "Allocate")
          : "Set Quotas"}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default OfficeAllocation;

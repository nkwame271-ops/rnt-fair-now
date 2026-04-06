import { useState, useEffect } from "react";
import { ArrowRightLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const OfficeAllocation = ({ onStockChanged }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regionalAvailable, setRegionalAvailable] = useState(0);
  const [officeAllocated, setOfficeAllocated] = useState(0);
  const [allocMode, setAllocMode] = useState<"transfer" | "quota">("transfer");
  const [officeQuantities, setOfficeQuantities] = useState<Record<string, number>>({});
  const [officeQuotas, setOfficeQuotas] = useState<Record<string, number>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [allocating, setAllocating] = useState(false);
  const [history, setHistory] = useState<AllocationHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

    // Fetch history
    setLoadingHistory(true);
    supabase
      .from("office_allocations" as any)
      .select("id, office_name, quantity, allocation_mode, start_serial, end_serial, created_at")
      .eq("region", selectedRegion)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setHistory((data || []) as any[]);
        setLoadingHistory(false);
      });
  }, [selectedRegion]);

  const totalTransferQty = Object.values(officeQuantities).reduce((a, b) => a + (b || 0), 0);
  const canAllocate = selectedRegion && (
    allocMode === "transfer" ? totalTransferQty > 0 && totalTransferQty <= regionalAvailable :
    Object.values(officeQuotas).some(v => v > 0)
  );

  const handleAllocate = () => {
    if (!canAllocate) {
      toast.error("Invalid allocation");
      return;
    }
    setShowPassword(true);
  };

  const handleConfirm = async (password: string, reason: string) => {
    setAllocating(true);
    try {
      if (allocMode === "transfer") {
        // Transfer serials for each office that has a quantity
        for (const office of offices) {
          const qty = officeQuantities[office.id] || 0;
          if (qty <= 0) continue;

          const { data, error } = await supabase.functions.invoke("admin-action", {
            body: {
              action: "allocate_to_office",
              target_id: `ALLOC-${office.id}-${Date.now()}`,
              reason,
              password,
              extra: {
                region: selectedRegion,
                office_id: office.id,
                office_name: office.name,
                quantity: qty,
                allocation_mode: "transfer",
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
        }
        toast.success(`Transferred ${totalTransferQty} serial pairs to ${Object.values(officeQuantities).filter(v => v > 0).length} office(s)`);
      } else {
        // Quota mode — set quotas for each office
        for (const office of offices) {
          const quota = officeQuotas[office.id] || 0;
          if (quota <= 0) continue;

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
                quantity: quota,
                allocation_mode: "quota",
                quota_limit: quota,
              },
            },
          });
          if (error) throw new Error(error.message);
          if (data?.error) throw new Error(data.error);
        }
        toast.success(`Set quotas for ${Object.values(officeQuotas).filter(v => v > 0).length} office(s)`);
      }

      setOfficeQuantities({});
      setOfficeQuotas({});
      onStockChanged();
      // Refresh
      setSelectedRegion(prev => { const r = prev; setSelectedRegion(""); setTimeout(() => setSelectedRegion(r), 100); return prev; });
    } catch (err: any) {
      throw err;
    } finally {
      setAllocating(false);
    }
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
          <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setOfficeQuantities({}); setOfficeQuotas({}); }}>
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
            <Tabs value={allocMode} onValueChange={v => setAllocMode(v as "transfer" | "quota")}>
              <TabsList>
                <TabsTrigger value="transfer">Transfer to Office</TabsTrigger>
                <TabsTrigger value="quota">Priority Quota</TabsTrigger>
              </TabsList>

              <TabsContent value="transfer" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Explicitly transfer serials from regional stock to each office. Auto-selects next available serials.
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
                    Total to transfer: <strong>{totalTransferQty}</strong> pair(s)
                    {totalTransferQty > regionalAvailable && (
                      <span className="text-destructive ml-2">(exceeds available stock!)</span>
                    )}
                  </p>
                )}
              </TabsContent>

              <TabsContent value="quota" className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Set a quota per office. Staff can assign from regional stock until their office quota is reached. Reports calculate from office allocation.
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
                        placeholder="Quota"
                        value={officeQuotas[o.id] || ""}
                        onChange={e => setOfficeQuotas(prev => ({ ...prev, [o.id]: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleAllocate} disabled={!canAllocate || allocating}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              {allocating ? "Allocating..." : allocMode === "transfer" ? `Transfer ${totalTransferQty} Pair(s)` : "Set Quotas"}
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
        title={allocMode === "transfer" ? "Confirm Office Transfer" : "Confirm Quota Assignment"}
        description={allocMode === "transfer"
          ? `Transfer ${totalTransferQty} serial pair(s) from regional stock to office stock. This action is logged.`
          : `Set priority quotas for offices in ${selectedRegion}. This action is logged.`}
        actionLabel={allocMode === "transfer" ? "Transfer" : "Set Quotas"}
        onConfirm={handleConfirm}
      />
    </div>
  );
};

export default OfficeAllocation;

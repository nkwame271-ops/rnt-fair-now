import { useState, useEffect } from "react";
import { Package, Hash, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AdminProfile, GHANA_OFFICES } from "@/hooks/useAdminProfile";

interface StockSummary {
  total: number;
  available: number;
  assigned: number;
  revoked: number;
}

interface SerialRange {
  batch_label: string;
  first_serial: string;
  last_serial: string;
  count: number;
  available: number;
  assigned: number;
  revoked: number;
}

interface Props {
  profile: AdminProfile | null;
  refreshKey: number;
}

const OfficeSerialStock = ({ profile, refreshKey }: Props) => {
  const [selectedOfficeId, setSelectedOfficeId] = useState(profile?.officeId || "");
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const officeName = GHANA_OFFICES.find(o => o.id === selectedOfficeId)?.name || "";

  useEffect(() => {
    if (profile && !profile.isMainAdmin && profile.officeId) {
      setSelectedOfficeId(profile.officeId);
    }
  }, [profile]);

  const [ranges, setRanges] = useState<SerialRange[]>([]);

  useEffect(() => {
    if (!officeName) { setStock(null); setRanges([]); return; }
    const fetchStock = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("serial_number, status, batch_label")
        .eq("office_name", officeName)
        .order("serial_number", { ascending: true });

      const items = (data || []) as any[];
      setStock({
        total: items.length,
        available: items.filter(i => i.status === "available").length,
        assigned: items.filter(i => i.status === "assigned").length,
        revoked: items.filter(i => i.status === "revoked").length,
      });

      // Group by batch_label for range view
      const batchMap = new Map<string, any[]>();
      for (const item of items) {
        const key = item.batch_label || "Unbatched";
        if (!batchMap.has(key)) batchMap.set(key, []);
        batchMap.get(key)!.push(item);
      }

      const rangeList: SerialRange[] = [];
      for (const [batch_label, batchItems] of batchMap) {
        const sorted = batchItems.sort((a: any, b: any) => a.serial_number.localeCompare(b.serial_number));
        rangeList.push({
          batch_label,
          first_serial: sorted[0].serial_number,
          last_serial: sorted[sorted.length - 1].serial_number,
          count: sorted.length,
          available: sorted.filter((i: any) => i.status === "available").length,
          assigned: sorted.filter((i: any) => i.status === "assigned").length,
          revoked: sorted.filter((i: any) => i.status === "revoked").length,
        });
      }
      setRanges(rangeList);
      setLoading(false);
    };
    fetchStock();
  }, [officeName, refreshKey]);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Office Serial Stock
        </h2>

        <div className="flex items-end gap-4 flex-wrap">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>Office</Label>
            {profile?.isMainAdmin ? (
              <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                <SelectContent>
                  {GHANA_OFFICES.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted/30">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-card-foreground">{officeName || "No office assigned"}</span>
              </div>
            )}
          </div>
        </div>

        {stock && !loading && (
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div className="rounded-lg border border-border p-4 text-center">
              <p className="text-2xl font-bold text-card-foreground">{stock.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Serials</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
              <p className="text-2xl font-bold text-success">{stock.available}</p>
              <p className="text-xs text-muted-foreground mt-1">Available</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-2xl font-bold text-primary">{stock.assigned}</p>
              <p className="text-xs text-muted-foreground mt-1">Assigned</p>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Loading stock...</p>}
        {!officeName && <p className="text-sm text-muted-foreground py-4 text-center">Select an office to view stock</p>}
      </div>
    </div>
  );
};

export default OfficeSerialStock;

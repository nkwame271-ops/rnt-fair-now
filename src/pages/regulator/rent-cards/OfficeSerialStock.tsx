import { useState, useEffect } from "react";
import { Package, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { AdminProfile, GHANA_REGIONS, getOfficesForRegion, getRegionForOffice } from "@/hooks/useAdminProfile";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2 } from "lucide-react";

interface StockSummary {
  total: number;
  available: number;
  assigned: number;
  revoked: number;
  sold: number;
  spoilt: number;
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

// Fetches serials allocated to office (stock_type = 'office' only)
async function fetchAllSerials(officeName: string, _officeRegion: string | null) {
  let allData: any[] = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from("rent_card_serial_stock")
      .select("serial_number, status, batch_label, region")
      .eq("office_name", officeName)
      .eq("stock_type", "office")
      .order("serial_number", { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return allData;
}

const OfficeSerialStock = ({ profile, refreshKey }: Props) => {
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedOfficeId, setSelectedOfficeId] = useState(profile?.officeId || "");
  const [stock, setStock] = useState<StockSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [ranges, setRanges] = useState<SerialRange[]>([]);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);
  const [deleteCount, setDeleteCount] = useState(0);
  const [deleting, setDeleting] = useState(false);

  const regionOffices = selectedRegion ? getOfficesForRegion(selectedRegion) : [];
  const selectedOffice = regionOffices.find(o => o.id === selectedOfficeId);
  const officeName = selectedOffice?.name || "";
  const isMain = !profile || profile.isMainAdmin;

  // For sub-admins, auto-set region from their office
  useEffect(() => {
    if (profile && !profile.isMainAdmin && profile.officeId) {
      setSelectedOfficeId(profile.officeId);
      const region = getRegionForOffice(profile.officeId);
      if (region) setSelectedRegion(region);
    }
  }, [profile]);

  const officeRegion = selectedOfficeId ? getRegionForOffice(selectedOfficeId) : null;

  useEffect(() => {
    if (!officeName) { setStock(null); setRanges([]); return; }
    const fetchStock = async () => {
      setLoading(true);
      try {
        const items = await fetchAllSerials(officeName, officeRegion);
        setStock({
          total: items.length,
          available: items.filter((i: any) => i.status === "available").length,
          assigned: items.filter((i: any) => i.status === "assigned").length,
          revoked: items.filter((i: any) => i.status === "revoked").length,
          sold: items.filter((i: any) => i.status === "sold").length,
          spoilt: items.filter((i: any) => i.status === "spoilt").length,
        });

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
      } catch (err: any) {
        toast.error(err.message || "Failed to load stock");
      }
      setLoading(false);
    };
    fetchStock();
  }, [officeName, officeRegion, refreshKey]);

  const handleDeleteBatch = async () => {
    if (!deletingBatch || !officeName) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("rent_card_serial_stock")
        .delete()
        .eq("batch_label", deletingBatch)
        .eq("office_name", officeName)
        .eq("status", "available");

      if (error) throw error;
      toast.success(`Deleted ${deleteCount} available serial(s) from batch "${deletingBatch}"`);
      setDeletingBatch(null);
      // Refresh
      setLoading(true);
      const items = await fetchAllSerials(officeName, officeRegion);
      setStock({
        total: items.length,
        available: items.filter((i: any) => i.status === "available").length,
        assigned: items.filter((i: any) => i.status === "assigned").length,
        revoked: items.filter((i: any) => i.status === "revoked").length,
        sold: items.filter((i: any) => i.status === "sold").length,
        spoilt: items.filter((i: any) => i.status === "spoilt").length,
      });
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
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
    setDeleting(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" /> Office Serial Stock
        </h2>

        <div className="flex items-end gap-4 flex-wrap">
          {isMain ? (
            <>
              <div className="space-y-2 flex-1 min-w-[180px]">
                <Label>Region</Label>
                <Select value={selectedRegion} onValueChange={v => { setSelectedRegion(v); setSelectedOfficeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select region..." /></SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedRegion && (
                <div className="space-y-2 flex-1 min-w-[180px]">
                  <Label>Office</Label>
                  <Select value={selectedOfficeId} onValueChange={setSelectedOfficeId}>
                    <SelectTrigger><SelectValue placeholder="Select office..." /></SelectTrigger>
                    <SelectContent>
                      {regionOffices.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2 flex-1 min-w-[200px]">
              <Label>Office</Label>
              <div className="flex items-center gap-2 h-10 px-3 border border-border rounded-md bg-muted/30">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-card-foreground">{officeName || "No office assigned"}</span>
              </div>
            </div>
          )}
        </div>

        {stock && !loading && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-2">
              <div className="rounded-lg border border-success/30 bg-success/5 p-4 text-center">
                <p className="text-2xl font-bold text-success">{Math.floor(stock.available / 2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Opening Rent Card Pairs</p>
                <p className="text-[10px] text-muted-foreground">{stock.available} serials</p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
                <p className="text-2xl font-bold text-primary">{Math.floor(stock.assigned / 2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Assigned Rent Card Pairs</p>
                <p className="text-[10px] text-muted-foreground">{stock.assigned} serials</p>
              </div>
              <div className="rounded-lg border border-info/30 bg-info/5 p-4 text-center">
                <p className="text-2xl font-bold text-info">{Math.floor(stock.sold / 2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Sold Rent Card Pairs</p>
                <p className="text-[10px] text-muted-foreground">{stock.sold} serials</p>
              </div>
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-center">
                <p className="text-2xl font-bold text-warning">{Math.floor(stock.spoilt / 2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Spoilt Rent Card Pairs</p>
                <p className="text-[10px] text-muted-foreground">{stock.spoilt} serials</p>
              </div>
              <div className="rounded-lg border border-border p-4 text-center">
                <p className="text-2xl font-bold text-card-foreground">{Math.floor((stock.available) / 2)}</p>
                <p className="text-xs text-muted-foreground mt-1">Closing Rent Card Pairs</p>
                <p className="text-[10px] text-muted-foreground">{stock.total} total serials • {stock.revoked} revoked</p>
              </div>
            </div>

            {ranges.length > 0 && (
              <div className="space-y-3 pt-4">
                <h3 className="text-sm font-semibold text-card-foreground">Serial Ranges by Batch</h3>
                {ranges.map((r) => (
                  <div key={r.batch_label} className="border border-border rounded-lg p-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-mono text-xs font-bold text-card-foreground">{r.first_serial} → {r.last_serial}</p>
                      <p className="text-xs text-muted-foreground">Batch: {r.batch_label} • {r.count} serials</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2 text-xs">
                        <span className="text-success">{r.available} avail</span>
                        <span className="text-primary">{r.assigned} assigned</span>
                        {r.revoked > 0 && <span className="text-destructive">{r.revoked} revoked</span>}
                      </div>
                      {isMain && r.available > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setDeletingBatch(r.batch_label);
                            setDeleteCount(r.available);
                          }}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Delete ({r.available})
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {loading && <p className="text-sm text-muted-foreground py-4 text-center">Loading stock...</p>}
        {!officeName && <p className="text-sm text-muted-foreground py-4 text-center">Select a region and office to view stock</p>}
      </div>

      <AlertDialog open={!!deletingBatch} onOpenChange={open => { if (!open) setDeletingBatch(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Available Serials</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteCount}</strong> available (unassigned) serial(s) from batch "<strong>{deletingBatch}</strong>".
              Assigned serials will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteBatch} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Deleting…</> : `Delete ${deleteCount} serial(s)`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OfficeSerialStock;

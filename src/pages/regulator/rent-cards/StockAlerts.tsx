import { useState, useEffect } from "react";
import { AlertTriangle, Bell, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { GHANA_REGIONS_OFFICES } from "@/hooks/useAdminProfile";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface OfficeStock {
  officeName: string;
  available: number;
}

interface RegionGroup {
  region: string;
  offices: OfficeStock[];
  totalAvailable: number;
}

interface Props {
  refreshKey: number;
  threshold: number;
}

const CRITICAL_THRESHOLD = 10;

const StockAlerts = ({ refreshKey, threshold }: Props) => {
  const [regions, setRegions] = useState<RegionGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRegions, setOpenRegions] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      // Server-side aggregated counts (was: full-table scan of 261K rows)
      const { data } = await supabase.rpc("rcss_office_summary" as any);

      const summary = (data || []) as Array<{ office_name: string; available_pairs: number }>;
      const countByOffice = new Map<string, number>();
      summary.forEach(s => countByOffice.set(s.office_name, Number(s.available_pairs) || 0));

      const regionGroups: RegionGroup[] = GHANA_REGIONS_OFFICES.map(r => {
        const offices = r.offices
          .map(o => ({ officeName: o.name, available: countByOffice.get(o.name) || 0 }))
          .sort((a, b) => a.available - b.available);

        return {
          region: r.region,
          offices,
          totalAvailable: offices.reduce((sum, o) => sum + o.available, 0),
        };
      });

      // Auto-open regions that have alerts
      const alertRegions = new Set<string>();
      regionGroups.forEach(rg => {
        if (rg.offices.some(o => o.available < threshold)) {
          alertRegions.add(rg.region);
        }
      });
      setOpenRegions(alertRegions);
      setRegions(regionGroups);
      setLoading(false);
    };
    fetch();
  }, [refreshKey, threshold]);

  const getLevel = (count: number): "critical" | "low" | "normal" => {
    if (count < CRITICAL_THRESHOLD) return "critical";
    if (count < threshold) return "low";
    return "normal";
  };

  const getLevelStyle = (level: "critical" | "low" | "normal") => {
    switch (level) {
      case "critical": return "border-destructive/40 bg-destructive/5";
      case "low": return "border-amber-500/40 bg-amber-500/5";
      case "normal": return "border-border bg-card";
    }
  };

  const getBadgeVariant = (level: "critical" | "low" | "normal") => {
    if (level === "critical") return "destructive" as const;
    if (level === "low") return "secondary" as const;
    return "outline" as const;
  };

  const toggleRegion = (region: string) => {
    setOpenRegions(prev => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region); else next.add(region);
      return next;
    });
  };

  const alertCount = regions.reduce(
    (sum, rg) => sum + rg.offices.filter(o => o.available < threshold).length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Stock Alerts (Office Level)
          <Badge variant="outline" className="ml-auto text-xs">Threshold: {threshold}</Badge>
        </h2>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-destructive/30 border border-destructive/50" /> Critical (&lt;{CRITICAL_THRESHOLD})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50" /> Low (&lt;{threshold})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-emerald-500/30 border border-emerald-500/50" /> Normal
          </span>
        </div>

        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>}

        {!loading && alertCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            All offices have sufficient office stock (≥{threshold} pairs).
          </p>
        )}

        {!loading && (
          <div className="space-y-2">
            {regions.map(rg => {
              const hasAlerts = rg.offices.some(o => o.available < threshold);
              const isOpen = openRegions.has(rg.region);

              return (
                <Collapsible key={rg.region} open={isOpen} onOpenChange={() => toggleRegion(rg.region)}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="text-sm font-medium text-card-foreground">{rg.region}</span>
                      {hasAlerts && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{rg.offices.length} office(s)</span>
                      <Badge variant="outline" className="text-xs">{rg.totalAvailable} total</Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 pt-2 pl-6">
                      {rg.offices.map(o => {
                        const level = getLevel(o.available);
                        return (
                          <div key={o.officeName} className={`rounded-lg border p-3 ${getLevelStyle(level)}`}>
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-card-foreground truncate">{o.officeName}</p>
                              {level === "critical" && <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />}
                            </div>
                            <Badge variant={getBadgeVariant(level)} className="text-sm mt-1">
                              {o.available}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground mt-0.5">available pair{o.available !== 1 ? "s" : ""}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StockAlerts;

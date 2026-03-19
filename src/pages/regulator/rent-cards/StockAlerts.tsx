import { useState, useEffect } from "react";
import { AlertTriangle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { GHANA_OFFICES } from "@/hooks/useAdminProfile";

interface OfficeStock {
  officeName: string;
  available: number;
}

interface Props {
  refreshKey: number;
  threshold: number;
}

const StockAlerts = ({ refreshKey, threshold }: Props) => {
  const [offices, setOffices] = useState<OfficeStock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("rent_card_serial_stock" as any)
        .select("office_name, status");

      const items = (data || []) as any[];
      const officeMap = new Map<string, number>();

      // Initialize all offices with 0
      GHANA_OFFICES.forEach(o => officeMap.set(o.name, 0));

      items.forEach(item => {
        if (item.status === "available") {
          officeMap.set(item.office_name, (officeMap.get(item.office_name) || 0) + 1);
        }
      });

      const allOffices = Array.from(officeMap.entries())
        .map(([officeName, available]) => ({ officeName, available }))
        .filter(o => o.available < threshold)
        .sort((a, b) => a.available - b.available);

      setOffices(allOffices);
      setLoading(false);
    };
    fetch();
  }, [refreshKey, threshold]);

  const getColor = (count: number) => {
    if (count < 10) return "border-destructive/40 bg-destructive/5";
    if (count < threshold) return "border-amber-500/40 bg-amber-500/5";
    return "border-success/40 bg-success/5";
  };

  const getBadgeVariant = (count: number) => {
    if (count < 10) return "destructive" as const;
    return "secondary" as const;
  };

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Stock Alerts
          <Badge variant="outline" className="ml-auto text-xs">Threshold: {threshold}</Badge>
        </h2>

        {loading && <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>}

        {!loading && offices.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            All offices have sufficient stock (≥{threshold} serials).
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offices.map(o => (
            <div key={o.officeName} className={`rounded-lg border p-4 ${getColor(o.available)}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-card-foreground">{o.officeName}</p>
                {o.available < 10 && <AlertTriangle className="h-4 w-4 text-destructive" />}
              </div>
              <p className="text-2xl font-bold mt-1">
                <Badge variant={getBadgeVariant(o.available)} className="text-lg px-2 py-0.5">
                  {o.available}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground mt-1">available serial{o.available !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StockAlerts;

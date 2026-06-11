import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Orphan {
  id: string;
  reference: string;
  total_amount: number;
  created_at: string;
  user_id: string;
  related_property_id: string | null;
  landlord_name?: string;
  landlord_phone?: string;
  property_name?: string;
}

/**
 * Lists "existing_tenancy_bundle" escrows that are completed but never produced
 * a tenancy for the paying landlord. Lets admins see the impact and nudge the
 * landlord (SMS) so they can resume the declaration without paying again.
 */
export default function OrphanBundlesTile() {
  const [rows, setRows] = useState<Orphan[]>([]);
  const [loading, setLoading] = useState(false);
  const [nudging, setNudging] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: paid } = await supabase
        .from("escrow_transactions")
        .select("id, reference, total_amount, created_at, user_id, related_property_id")
        .eq("payment_type", "existing_tenancy_bundle")
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!paid || paid.length === 0) { setRows([]); return; }

      // Group payments by landlord and check for matching tenancies (within 30 min after payment)
      const userIds = Array.from(new Set(paid.map((p: any) => p.user_id)));
      const propIds = Array.from(new Set(paid.map((p: any) => p.related_property_id).filter(Boolean)));

      const [{ data: tenancies }, { data: profiles }, { data: properties }] = await Promise.all([
        supabase
          .from("tenancies")
          .select("landlord_user_id, created_at")
          .in("landlord_user_id", userIds)
          .gte("created_at", paid[paid.length - 1].created_at),
        supabase.from("profiles").select("user_id, full_name, phone").in("user_id", userIds),
        propIds.length > 0
          ? supabase.from("properties").select("id, property_name, address").in("id", propIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const tenancyByLandlord: Record<string, number[]> = {};
      for (const t of tenancies || []) {
        (tenancyByLandlord[(t as any).landlord_user_id] ||= []).push(new Date((t as any).created_at).getTime());
      }
      const profById: Record<string, any> = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p]));
      const propById: Record<string, any> = Object.fromEntries((properties || []).map((p: any) => [p.id, p]));

      const orphans = paid.filter((p: any) => {
        const pt = new Date(p.created_at).getTime();
        const times = tenancyByLandlord[p.user_id] || [];
        return !times.some((tt) => tt >= pt && tt - pt < 30 * 60_000);
      }).map((p: any) => ({
        ...p,
        landlord_name: profById[p.user_id]?.full_name,
        landlord_phone: profById[p.user_id]?.phone,
        property_name: p.related_property_id ? (propById[p.related_property_id]?.property_name || propById[p.related_property_id]?.address) : undefined,
      }));

      setRows(orphans);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const nudge = async (o: Orphan) => {
    if (!o.landlord_phone) { toast.error("Landlord has no phone on file"); return; }
    setNudging(o.id);
    try {
      await supabase.functions.invoke("send-sms", {
        body: {
          phone: o.landlord_phone,
          message: `Hello ${o.landlord_name || "landlord"}, your existing tenancy payment (GHS ${Number(o.total_amount).toLocaleString()}) was received but the declaration was not completed. Please log in to RentControlGhana and visit Declare Existing Tenancy to finish — you will NOT be charged again. Ref: ${o.reference}`,
        },
      });
      toast.success("Reminder SMS sent to landlord");
    } catch (e: any) {
      toast.error(e?.message || "Failed to send SMS");
    } finally {
      setNudging(null);
    }
  };

  return (
    <Card className="p-4 space-y-3 border-amber-500/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <h2 className="font-semibold">Orphan Paid Bundles</h2>
          <Badge variant={rows.length > 0 ? "destructive" : "secondary"}>{rows.length}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Landlords whose Existing Tenancy payment was received but the tenancy/agreement was never created.
        They can resume the declaration without paying again.
      </p>

      {rows.length === 0 ? (
        <div className="text-xs text-muted-foreground py-4 text-center">No orphan bundles — all paid declarations completed cleanly.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1">Landlord</th>
                <th>Property</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Reference</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">
                    <div>{r.landlord_name || "—"}</div>
                    <div className="text-muted-foreground">{r.landlord_phone || ""}</div>
                  </td>
                  <td>{r.property_name || "—"}</td>
                  <td>GHS {Number(r.total_amount).toLocaleString()}</td>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td className="font-mono">{r.reference}</td>
                  <td>
                    <Button size="sm" variant="outline" disabled={nudging === r.id} onClick={() => nudge(r)}>
                      {nudging === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Nudge"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

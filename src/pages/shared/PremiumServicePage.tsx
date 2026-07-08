import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Crown, Loader2, ShieldCheck, UserCog } from "lucide-react";
import Seo from "@/components/Seo";
import { formatGHS } from "@/lib/formatters";

const YEARLY_FEE = 600; // default Premium Service fee (GHS/year/property)

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    active: "bg-success/10 text-success",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

interface Props {
  variant: "landlord" | "tenant";
}

/**
 * Premium Service — per-property yearly subscription.
 * Landlords and tenants can subscribe individual properties, with an assigned
 * agent, expiry date, and management support toggle.
 */
const PremiumServicePage = ({ variant }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    let propQuery;
    if (variant === "landlord") {
      propQuery = supabase.from("properties").select("id,address").eq("landlord_user_id", user.id);
    } else {
      const { data: ts } = await supabase.from("tenancies").select("property_id").eq("tenant_user_id", user.id);
      const ids = [...new Set((ts || []).map((t: any) => t.property_id).filter(Boolean))];
      propQuery = ids.length
        ? supabase.from("properties").select("id,address").in("id", ids)
        : Promise.resolve({ data: [] as any[] });
    }
    const [{ data: props }, { data: subRows }] = await Promise.all([
      propQuery as any,
      supabase
        .from("premium_subscriptions")
        .select("*")
        .eq("subscriber_user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setProperties(props || []);
    setSubs(subRows || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, variant]);

  const subscribe = async () => {
    if (!propertyId) { toast.error("Select a property"); return; }
    setSubmitting(true);
    const now = new Date();
    const expires = new Date(now); expires.setFullYear(expires.getFullYear() + 1);
    const { error } = await supabase.from("premium_subscriptions").insert({
      property_id: propertyId,
      subscriber_user_id: user!.id,
      subscriber_role: variant,
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
      yearly_fee: YEARLY_FEE,
      status: "pending",
      management_enabled: true,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Premium subscription created. Complete payment to activate.");
    setPropertyId("");
    load();
  };

  const cancel = async (id: string) => {
    const { error } = await supabase
      .from("premium_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Subscription cancelled");
    load();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const propAddr = (id: string) => properties.find((p) => p.id === id)?.address || id.slice(0, 8);
  const availableProps = properties.filter((p) => !subs.some((s) => s.property_id === p.id && ["active", "pending"].includes(s.status)));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Seo
        title="Premium Service | Rent Control"
        description="Per-property yearly premium management with an assigned agent."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-7 w-7 text-primary" /> Premium Service
        </h1>
        <p className="text-muted-foreground mt-1">
          Add full property-management support per property. Yearly subscription with an assigned agent, renewal reminders and priority handling.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-bold">Subscribe a property</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Property</Label>
            <Select value={propertyId} onValueChange={setPropertyId}>
              <SelectTrigger><SelectValue placeholder="Choose a property" /></SelectTrigger>
              <SelectContent>
                {availableProps.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Yearly fee</Label>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm">{formatGHS(YEARLY_FEE)} / year / property</div>
          </div>
        </div>
        <Button onClick={subscribe} disabled={submitting || availableProps.length === 0}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Subscribe
        </Button>
        {availableProps.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {variant === "landlord"
              ? "All your properties are already on Premium — or no properties registered yet."
              : "You must be linked to a tenancy to subscribe. All your properties may already be on Premium."}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> My subscriptions</h2>
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No premium subscriptions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {subs.map((s) => (
              <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{propAddr(s.property_id)}</p>
                  <p className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>Expires {format(new Date(s.expires_at), "dd MMM yyyy")}</span>
                    <span>Fee {formatGHS(Number(s.yearly_fee))}</span>
                    <span className="flex items-center gap-1"><UserCog className="h-3 w-3" /> Agent: {s.assigned_agent_user_id ? s.assigned_agent_user_id.slice(0, 8) : "Unassigned"}</span>
                    <span>Management: {s.management_enabled ? "On" : "Off"}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusBadge(s.status)}>{s.status}</Badge>
                  {s.status !== "cancelled" && s.status !== "expired" && (
                    <Button size="sm" variant="outline" onClick={() => cancel(s.id)}>Cancel</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumServicePage;

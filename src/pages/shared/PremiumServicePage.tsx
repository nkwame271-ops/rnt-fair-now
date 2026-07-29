import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Crown, Loader2, ShieldCheck, UserCog, Phone, Mail, MessageSquare, BadgeCheck, CalendarClock, Building2, HeartHandshake, UserX, RefreshCw } from "lucide-react";
import Seo from "@/components/Seo";
import { formatGHS } from "@/lib/formatters";
import { startBrandedCheckout } from "@/lib/payments/brandedCheckout";

interface Props {
  variant: "landlord" | "tenant";
}

const statusBadge = (s: string) => {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    active: "bg-success/10 text-success",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
  };
  return map[s] || "bg-muted text-muted-foreground";
};

const PremiumServicePage = ({ variant }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [properties, setProperties] = useState<any[]>([]);
  const [subs, setSubs] = useState<any[]>([]);
  const [agents, setAgents] = useState<Record<string, any>>({});
  const [propertyId, setPropertyId] = useState("");
  const [flag, setFlag] = useState<any>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let props: any[] = [];
    if (variant === "landlord") {
      const { data } = await supabase.from("properties").select("id,address,property_name,region").eq("landlord_user_id", user.id);
      props = data || [];
    } else {
      const { data: ts } = await supabase.from("tenancies").select("property_id").eq("tenant_user_id", user.id);
      const ids = [...new Set((ts || []).map((t: any) => t.property_id).filter(Boolean))];
      if (ids.length) {
        const { data } = await supabase.from("properties").select("id,address,property_name,region").in("id", ids);
        props = data || [];
      }
    }

    const [{ data: subRows }, { data: flagRow }] = await Promise.all([
      supabase
        .from("premium_subscriptions")
        .select("*")
        .eq("subscriber_user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("feature_flags")
        .select("fee_amount, fee_enabled, billing_frequency")
        .eq("feature_key", "premium_service_subscription")
        .maybeSingle(),
    ]);

    // Load agent details for assigned subscriptions
    const agentIds = [...new Set((subRows || []).map((s: any) => s.assigned_agent_user_id).filter(Boolean))];
    let agentMap: Record<string, any> = {};
    if (agentIds.length) {
      const { data: agentRows } = await supabase
        .from("agent_staff")
        .select("user_id, full_name, email, phone, professional_photo_url, region, operating_area")
        .in("user_id", agentIds);
      (agentRows || []).forEach((a: any) => { agentMap[a.user_id] = a; });
    }

    setProperties(props);
    setSubs(subRows || []);
    setAgents(agentMap);
    setFlag(flagRow || { fee_amount: 100, fee_enabled: true, billing_frequency: "monthly" });
    setLoading(false);
  }, [user, variant]);

  useEffect(() => { load(); }, [load]);

  const subscribe = async () => {
    if (!propertyId) { toast.error("Select a property"); return; }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("premium-checkout", {
        body: { property_id: propertyId, subscriber_role: variant },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      startBrandedCheckout({
        ...(data as any),
        confirmationPath: "/premium/confirm",
        callbackPath: window.location.pathname,
      } as any);
      setPropertyId("");
    } catch (e: any) {
      toast.error(e.message || "Could not start subscription");
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this Premium Service subscription? Your assigned agent will be unassigned.")) return;
    const { error } = await supabase
      .from("premium_subscriptions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Subscription cancelled");
    load();
  };

  const requestService = async (sub: any) => {
    if (!sub.assigned_agent_user_id) { toast.error("No agent assigned yet"); return; }
    const note = window.prompt("Describe the service you need from your agent:");
    if (!note || !note.trim()) return;
    const { data, error } = await supabase.functions.invoke("premium-service-request", {
      body: { subscription_id: sub.id, request_type: "landlord_request", note: note.trim() },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message || "Could not send request"); return; }
    toast.success("Request sent to your agent");
  };

  const revokeAgent = async (sub: any) => {
    if (!sub.assigned_agent_user_id) return;
    if (!confirm("Revoke this agent's access to your account? You can request a new agent afterwards.")) return;
    const prevAgent = sub.assigned_agent_user_id;
    const { error } = await supabase
      .from("premium_subscriptions")
      .update({ assigned_agent_user_id: null })
      .eq("id", sub.id);
    if (error) { toast.error(error.message); return; }
    try {
      await (supabase as any).from("agent_assignments")
        .update({ active: false })
        .eq("agent_user_id", prevAgent)
        .eq("owner_user_id", user!.id);
      await (supabase as any).from("notifications").insert({
        user_id: prevAgent, title: "Premium client access revoked",
        message: "A Premium client has revoked your access to their account.",
        type: "agent_revoked",
      });
    } catch { /* non-fatal */ }
    toast.success("Agent access revoked");
    load();
  };

  const requestChange = async (sub: any) => {
    const reason = window.prompt("Why do you want to change your assigned agent? (This is sent to Rent Control admin)");
    if (!reason || !reason.trim()) return;
    try {
      await (supabase as any).from("notifications").insert({
        user_id: user!.id, title: "Agent change request submitted",
        message: `Your request to change agent has been received. Reason: ${reason.trim()}`,
        type: "premium_agent_change_request",
      });
      toast.success("Change request submitted — admin will follow up");
    } catch (e: any) {
      toast.error(e.message || "Could not submit request");
    }
  };


  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const propLabel = (id: string) => {
    const p = properties.find((x) => x.id === id);
    return p?.property_name || p?.address || id.slice(0, 8);
  };
  const availableProps = properties.filter((p) => !subs.some((s) => s.property_id === p.id && ["active", "pending"].includes(s.status)));
  const feeAmount = Number(flag?.fee_amount || 0);
  const frequency = flag?.billing_frequency || "monthly";
  const freqLabel = frequency === "monthly" ? "month" : frequency === "yearly" ? "year" : frequency;

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 md:p-6">
      <Seo
        title="Premium Service | Rent Control"
        description="Per-property premium management with an assigned agent."
        canonicalPath={typeof window !== "undefined" ? window.location.pathname : "/"}
      />
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-7 w-7 text-primary" /> Premium Service
        </h1>
        <p className="text-muted-foreground mt-1">
          Full property-management support per property. {frequency === "monthly" ? "Monthly" : "Recurring"} subscription with a dedicated agent, renewal reminders and priority handling.
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
                  <SelectItem key={p.id} value={p.id}>{p.property_name || p.address}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fee</Label>
            <div className="h-10 rounded-md border border-input bg-muted/40 px-3 flex items-center text-sm">
              {formatGHS(feeAmount)} / {freqLabel} / property
            </div>
          </div>
        </div>
        <Button onClick={subscribe} disabled={submitting || availableProps.length === 0}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Subscribe & Pay
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
          <div className="space-y-4">
            {subs.map((s) => {
              const agent = s.assigned_agent_user_id ? agents[s.assigned_agent_user_id] : null;
              return (
                <div key={s.id} className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="font-semibold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> {propLabel(s.property_id)}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> Expires {format(new Date(s.expires_at), "dd MMM yyyy")}</span>
                        <span>{formatGHS(Number(s.fee_amount ?? s.yearly_fee))} / {(s.billing_frequency === "monthly" ? "month" : s.billing_frequency === "yearly" ? "year" : s.billing_frequency || "cycle")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusBadge(s.status)}>{s.status}</Badge>
                      {s.status !== "cancelled" && s.status !== "expired" && (
                        <Button size="sm" variant="outline" onClick={() => cancel(s.id)}>Cancel</Button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/40 p-3">
                    <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2"><UserCog className="h-3 w-3" /> ASSIGNED AGENT</p>
                    {agent ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          {agent.professional_photo_url ? (
                            <img src={agent.professional_photo_url} alt={agent.full_name} className="h-14 w-14 rounded-full object-cover" />
                          ) : (
                            <div className="h-14 w-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                              {(agent.full_name || "A").slice(0, 1)}
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <p className="font-medium truncate flex items-center gap-1">
                              {agent.full_name}
                              <BadgeCheck className="h-4 w-4 text-primary" />
                            </p>
                             <p className="text-[11px] text-muted-foreground font-mono">Agent ID: {String(agent.id || s.assigned_agent_user_id).slice(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-muted-foreground truncate">{agent.operating_area || agent.region || "—"}</p>
                            {agent.phone && <p className="text-xs text-muted-foreground truncate">📞 {agent.phone}</p>}
                            {agent.email && <p className="text-xs text-muted-foreground truncate">✉️ {agent.email}</p>}
                             <div className="flex flex-wrap gap-1 pt-1">
                               <Badge variant="outline">Service: {s.management_enabled ? "Active" : "Standard"}</Badge>
                               <Badge variant="outline">Subscription: {s.status}</Badge>
                             </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {agent.phone && (
                            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                              <a href={`tel:${agent.phone}`}><Phone className="h-3 w-3 mr-1" /> Call</a>
                            </Button>
                          )}
                          {agent.phone && (
                            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                              <a href={`sms:${agent.phone}`}><MessageSquare className="h-3 w-3 mr-1" /> SMS</a>
                            </Button>
                          )}
                          {agent.email && (
                            <Button asChild size="sm" variant="outline" className="h-8 text-xs">
                              <a href={`mailto:${agent.email}`}><Mail className="h-3 w-3 mr-1" /> Email</a>
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => requestService(s)}>
                            <HeartHandshake className="h-3 w-3 mr-1" /> Request Service
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => requestChange(s)}>
                            <RefreshCw className="h-3 w-3 mr-1" /> Request Change
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs text-destructive hover:text-destructive" onClick={() => revokeAgent(s)}>
                            <UserX className="h-3 w-3 mr-1" /> Revoke Access
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Awaiting agent assignment…</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumServicePage;

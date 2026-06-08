import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Building2, UserCheck, Send, MessageCircle } from "lucide-react";
import PropertyManagementToggle from "@/components/PropertyManagementToggle";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ManagedProp {
  id: string;
  property_name: string | null;
  property_code: string;
  address: string;
  area: string;
  region: string;
  management_enabled: boolean;
  management_assigned_office_id: string | null;
  management_assigned_staff_id: string | null;
  openTasks: number;
}

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: "buy_rent_card", label: "Buy Rent Card" },
  { value: "rent_card_delivery", label: "Rent Card Delivery" },
  { value: "onboard_new_tenant", label: "Onboard New Tenant" },
  { value: "inquiry", label: "General Inquiry" },
  { value: "other_request", label: "Other" },
];

const LandlordManagementSupport = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<ManagedProp[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestFor, setRequestFor] = useState<ManagedProp | null>(null);
  const [reqType, setReqType] = useState<string>("buy_rent_card");
  const [reqNotes, setReqNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: props } = await supabase
      .from("properties")
      .select("id, property_name, property_code, address, area, region, management_enabled, management_assigned_office_id, management_assigned_staff_id" as any)
      .eq("landlord_user_id", user.id)
      .neq("property_status", "archived");

    const items: ManagedProp[] = [];
    for (const p of (props || []) as any[]) {
      const { count } = await supabase
        .from("management_task_assignments" as any)
        .select("id", { count: "exact", head: true })
        .eq("property_id", p.id)
        .in("status", ["open", "in_progress"]);
      items.push({ ...p, openTasks: count || 0 });
    }
    setRows(items);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [user]);

  const submitRequest = async () => {
    if (!requestFor || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("management_task_assignments" as any).insert({
        property_id: requestFor.id,
        task_type: reqType,
        status: "open",
        assigned_office_id: requestFor.management_assigned_office_id,
        assigned_staff_id: requestFor.management_assigned_staff_id,
        notes: reqNotes,
        created_by: user.id,
      });
      if (error) throw error;
      toast.success("Request submitted — your management team will follow up.");
      setRequestFor(null); setReqNotes(""); setReqType("buy_rent_card");
      fetchData();
    } catch (e: any) {
      toast.error(e.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  };


  const managed = rows.filter(r => r.management_enabled);
  const selfManaged = rows.filter(r => !r.management_enabled);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-600" /> Management Support
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Hand off day-to-day tenant interactions to platform staff. You still own each property and receive rent payments through the standard settlement workflow.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total properties</div><div className="text-2xl font-bold">{rows.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Managed by platform</div><div className="text-2xl font-bold text-amber-600">{managed.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Self-managed</div><div className="text-2xl font-bold">{selfManaged.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Open platform tasks</div><div className="text-2xl font-bold">{managed.reduce((s, r) => s + r.openTasks, 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Your properties</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!loading && rows.length === 0 && (
            <div className="text-sm text-muted-foreground">
              You haven't registered any properties yet. <Link to="/landlord/register-property" className="underline">Register a property</Link>.
            </div>
          )}
          {rows.map(p => (
            <div key={p.id} className="border border-border rounded-lg p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{p.property_name || p.property_code}</span>
                    {p.management_enabled
                      ? <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px]">Managed by Platform</Badge>
                      : <Badge variant="outline" className="text-[10px]">Self-managed</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.address}, {p.area}, {p.region}</div>
                  {p.management_enabled && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" /> {p.management_assigned_staff_id ? "Assigned to platform staff" : "Awaiting staff assignment"}</span>
                      <span>Open tasks: <strong>{p.openTasks}</strong></span>
                    </div>
                  )}
                  {p.management_enabled && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { setRequestFor(p); setReqType("buy_rent_card"); setReqNotes(""); }}>
                        <Send className="h-3 w-3 mr-1" /> Submit Request
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
                        <Link to="/landlord/messages"><MessageCircle className="h-3 w-3 mr-1" /> Message Team</Link>
                      </Button>
                    </div>
                  )}
                </div>
                <div className="min-w-[260px]">
                  <PropertyManagementToggle
                    propertyId={p.id}
                    enabled={p.management_enabled}
                    onChange={(v) => setRows(prev => prev.map(x => x.id === p.id ? { ...x, management_enabled: v } : x))}
                    compact
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={!!requestFor} onOpenChange={(o) => !o && setRequestFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Submit Management Request</DialogTitle></DialogHeader>
          {requestFor && (
            <div className="space-y-3">
              <div className="text-sm">
                <strong>{requestFor.property_name || requestFor.property_code}</strong>
                <div className="text-xs text-muted-foreground">{requestFor.address}, {requestFor.area}</div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Request type</label>
                <Select value={reqType} onValueChange={setReqType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">Details</label>
                <Textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Add context for the management team…" className="min-h-[100px]" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setRequestFor(null)}>Cancel</Button>
                <Button onClick={submitRequest} disabled={submitting}>{submitting ? "Submitting…" : "Submit"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
          <p><strong>What happens when Management Support is on?</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Tenant inquiries, viewing requests, onboarding and compliance tasks route to assigned platform staff.</li>
            <li>Your contact details are hidden from prospective tenants on the marketplace.</li>
            <li>Rent payments continue to flow to you through the normal settlement workflow — no extra cost to tenants.</li>
            <li>You can turn it off at any time. Open tasks remain visible to platform staff until resolved.</li>
          </ul>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm"><Link to="/landlord/my-properties">Back to My Properties</Link></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandlordManagementSupport;

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, ShieldAlert, Network } from "lucide-react";
import { toast } from "sonner";
import { formatGHS } from "@/lib/format";

interface Channel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  default_office_id: string | null;
  is_active: boolean;
}

interface ChannelSplit {
  id?: string;
  channel_id: string;
  recipient: "igf" | "platform" | "admin";
  amount_type: "percent" | "flat";
  amount: number;
  sort_order: number;
}

const RECIPIENTS: Array<{ key: ChannelSplit["recipient"]; label: string; sort: number }> = [
  { key: "igf", label: "IGF", sort: 1 },
  { key: "platform", label: "Platform / Center", sort: 2 },
  { key: "admin", label: "Admin / Other", sort: 3 },
];

export default function SalesChannelsManager() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [splitsByChannel, setSplitsByChannel] = useState<Record<string, ChannelSplit[]>>({});
  const [offices, setOffices] = useState<Array<{ id: string; office_name: string }>>([]);
  const [creating, setCreating] = useState(false);
  const [newChannel, setNewChannel] = useState({ code: "", name: "", description: "", default_office_id: "" });
  const [stockSummary, setStockSummary] = useState<Record<string, number>>({});
  const [salesSummary, setSalesSummary] = useState<
    Record<string, { txns: number; gross: number; igf: number; platform: number; admin: number }>
  >({});

  const loadAll = async () => {
    setLoading(true);
    const [{ data: chans }, { data: splits }, { data: offs }] = await Promise.all([
      supabase.from("rent_card_sales_channels").select("*").order("name"),
      supabase.from("rent_card_channel_splits").select("*").order("sort_order"),
      supabase.from("offices").select("id, office_name").order("office_name"),
    ]);
    const chanList = (chans || []) as any as Channel[];
    setChannels(chanList);
    setOffices((offs || []) as any);
    const grouped: Record<string, ChannelSplit[]> = {};
    for (const c of chanList) {
      grouped[c.id] = RECIPIENTS.map(r => {
        const existing = (splits || []).find((s: any) => s.channel_id === c.id && s.recipient === r.key);
        return existing
          ? { ...(existing as any) }
          : { channel_id: c.id, recipient: r.key, amount_type: "percent" as const, amount: 0, sort_order: r.sort };
      });
    }
    setSplitsByChannel(grouped);

    // Stock summary per channel
    const ids = chanList.map(c => c.id);
    if (ids.length > 0) {
      const { data: stock } = await supabase
        .from("rent_card_serial_stock")
        .select("sales_channel_id, status")
        .in("sales_channel_id", ids);
      const stk: Record<string, number> = {};
      for (const r of (stock || []) as any[]) {
        if (r.status === "available") stk[r.sales_channel_id] = (stk[r.sales_channel_id] || 0) + 1;
      }
      setStockSummary(stk);

      // Sales summary
      const { data: txns } = await supabase
        .from("escrow_transactions")
        .select("id, sales_channel_id, total_amount, status, escrow_splits(recipient, amount)")
        .in("sales_channel_id", ids)
        .eq("status", "completed");
      const sales: typeof salesSummary = {};
      for (const t of (txns || []) as any[]) {
        const cid = t.sales_channel_id;
        const bucket = sales[cid] || { txns: 0, gross: 0, igf: 0, platform: 0, admin: 0 };
        bucket.txns += 1;
        bucket.gross += Number(t.total_amount || 0);
        for (const s of t.escrow_splits || []) {
          if (s.recipient === "igf") bucket.igf += Number(s.amount || 0);
          else if (s.recipient === "platform") bucket.platform += Number(s.amount || 0);
          else if (s.recipient === "admin") bucket.admin += Number(s.amount || 0);
        }
        sales[cid] = bucket;
      }
      setSalesSummary(sales);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const createChannel = async () => {
    if (!newChannel.code || !newChannel.name) {
      toast.error("Code and name are required");
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from("rent_card_sales_channels")
      .insert({
        code: newChannel.code.trim().toLowerCase().replace(/\s+/g, "_"),
        name: newChannel.name.trim(),
        description: newChannel.description.trim() || null,
        default_office_id: newChannel.default_office_id || null,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data) {
      // Seed default splits
      await supabase.from("rent_card_channel_splits").insert(
        RECIPIENTS.map(r => ({
          channel_id: (data as any).id,
          recipient: r.key,
          amount_type: "percent",
          amount: r.key === "igf" ? 50 : r.key === "platform" ? 30 : 20,
          sort_order: r.sort,
        })),
      );
    }
    toast.success("Sales channel created");
    setNewChannel({ code: "", name: "", description: "", default_office_id: "" });
    loadAll();
  };

  const toggleActive = async (c: Channel) => {
    const { error } = await supabase
      .from("rent_card_sales_channels")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${c.name} ${!c.is_active ? "activated" : "deactivated"}`);
      loadAll();
    }
  };

  const updateSplitField = (channelId: string, recipient: string, field: keyof ChannelSplit, value: any) => {
    setSplitsByChannel(prev => ({
      ...prev,
      [channelId]: prev[channelId].map(s =>
        s.recipient === recipient ? { ...s, [field]: field === "amount" ? Number(value) : value } : s,
      ),
    }));
  };

  const saveSplits = async (channelId: string) => {
    const rows = splitsByChannel[channelId] || [];
    const allPercent = rows.every(r => r.amount_type === "percent");
    if (allPercent) {
      const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      if (Math.abs(total - 100) > 0.01) {
        toast.error(`Percent splits must total 100% (currently ${total}%)`);
        return;
      }
    }
    const payload = rows.map(r => ({
      channel_id: channelId,
      recipient: r.recipient,
      amount_type: r.amount_type,
      amount: Number(r.amount) || 0,
      sort_order: r.sort_order,
    }));
    const { error } = await supabase
      .from("rent_card_channel_splits")
      .upsert(payload, { onConflict: "channel_id,recipient" });
    if (error) toast.error(error.message);
    else toast.success("Splits saved");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/40 bg-amber-50/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            Super Admin Only — Sales Channel Attribution Layer
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sales Channels are a hidden attribution layer. Office reporting and reconciliation stay unchanged for normal
          admins. Channel-level platform allocations and split breakdowns are visible only here.
        </CardContent>
      </Card>

      <Tabs defaultValue="channels">
        <TabsList>
          <TabsTrigger value="channels">Channels & Splits</TabsTrigger>
          <TabsTrigger value="report">Sales Report</TabsTrigger>
        </TabsList>

        <TabsContent value="channels" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create Sales Channel
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Code (slug)</Label>
                <Input
                  value={newChannel.code}
                  onChange={e => setNewChannel(p => ({ ...p, code: e.target.value }))}
                  placeholder="e.g. field_agent"
                />
              </div>
              <div>
                <Label>Name</Label>
                <Input
                  value={newChannel.name}
                  onChange={e => setNewChannel(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Field Agent Channel"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={newChannel.description}
                  onChange={e => setNewChannel(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div>
                <Label>Default office (optional)</Label>
                <Select
                  value={newChannel.default_office_id || "none"}
                  onValueChange={v => setNewChannel(p => ({ ...p, default_office_id: v === "none" ? "" : v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {offices.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.office_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Button onClick={createChannel} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Channel
                </Button>
              </div>
            </CardContent>
          </Card>

          {channels.map(c => {
            const rows = splitsByChannel[c.id] || [];
            const total = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
            const allPercent = rows.every(r => r.amount_type === "percent");
            return (
              <Card key={c.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Network className="h-4 w-4 text-primary" />
                        {c.name}
                        <Badge variant={c.is_active ? "default" : "secondary"}>
                          {c.is_active ? "Active" : "Disabled"}
                        </Badge>
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Code: <code>{c.code}</code>
                        {c.description ? ` — ${c.description}` : ""}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Available stock allocated: <strong>{stockSummary[c.id] || 0}</strong> serials
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rows.map(r => (
                      <div key={r.recipient} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4 text-sm font-medium">
                          {RECIPIENTS.find(x => x.key === r.recipient)?.label}
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={r.amount_type}
                            onValueChange={v => updateSplitField(c.id, r.recipient, "amount_type", v)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percent">Percent (%)</SelectItem>
                              <SelectItem value="flat">Flat (GHS)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-3">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={r.amount}
                            onChange={e => updateSplitField(c.id, r.recipient, "amount", e.target.value)}
                          />
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground">
                          {r.amount_type === "percent" ? "%" : "GHS"}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        {allPercent
                          ? <>Total: <strong className={Math.abs(total - 100) > 0.01 ? "text-destructive" : "text-foreground"}>{total}%</strong> (must equal 100%)</>
                          : "Mixed/flat splits — totals are not validated"}
                      </div>
                      <Button size="sm" onClick={() => saveSplits(c.id)}>
                        <Save className="h-4 w-4 mr-2" /> Save Splits
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-Channel Sales (Completed Transactions)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr className="text-left text-muted-foreground">
                      <th className="py-2 pr-3">Channel</th>
                      <th className="py-2 pr-3 text-right">Txns</th>
                      <th className="py-2 pr-3 text-right">Gross</th>
                      <th className="py-2 pr-3 text-right">IGF</th>
                      <th className="py-2 pr-3 text-right">Platform</th>
                      <th className="py-2 pr-3 text-right">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {channels.map(c => {
                      const s = salesSummary[c.id] || { txns: 0, gross: 0, igf: 0, platform: 0, admin: 0 };
                      return (
                        <tr key={c.id} className="border-b">
                          <td className="py-2 pr-3 font-medium">{c.name}</td>
                          <td className="py-2 pr-3 text-right">{s.txns}</td>
                          <td className="py-2 pr-3 text-right">{formatGHS(s.gross)}</td>
                          <td className="py-2 pr-3 text-right">{formatGHS(s.igf)}</td>
                          <td className="py-2 pr-3 text-right">{formatGHS(s.platform)}</td>
                          <td className="py-2 pr-3 text-right">{formatGHS(s.admin)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Includes Platform allocations — visible to Super Admin only. Office and IGF reporting elsewhere remains
                unchanged.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

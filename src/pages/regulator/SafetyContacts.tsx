import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const CONTACT_TYPES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "safety_admin", label: "Safety Admin" },
  { value: "nugs_desk", label: "NUGS Safety Desk" },
  { value: "campus_security", label: "Campus Security" },
  { value: "user_emergency_contact", label: "User Emergency Contact" },
  { value: "other", label: "Other" },
];

const SafetyContacts = () => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", contact_type: "safety_admin", scope: "global", scope_value: "" });

  const load = async () => {
    const { data } = await supabase.from("safety_contacts").select("*").order("created_at", { ascending: false });
    setContacts(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.name || !form.phone) return toast.error("Name and phone required");
    const { error } = await supabase.from("safety_contacts").insert(form as any);
    if (error) return toast.error(error.message);
    toast.success("Contact added");
    setForm({ name: "", phone: "", email: "", contact_type: "safety_admin", scope: "global", scope_value: "" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("safety_contacts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("safety_contacts").update({ active }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <h1 className="text-2xl font-bold">Safety Alert Contacts</h1>
      <p className="text-sm text-muted-foreground">
        These contacts receive SMS alerts when new safety reports or panic emergencies are submitted.
      </p>

      <Card>
        <CardHeader><CardTitle className="text-base">Add Contact</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <div>
            <Label>Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Phone *</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="233XXXXXXXXX" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Contact Type</Label>
            <Select value={form.contact_type} onValueChange={(v) => setForm({ ...form, contact_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Scope</Label>
            <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="region">Region</SelectItem>
                <SelectItem value="school">School</SelectItem>
                <SelectItem value="office">Office</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.scope !== "global" && (
            <div>
              <Label>Scope Value</Label>
              <Input value={form.scope_value} onChange={(e) => setForm({ ...form, scope_value: e.target.value })} />
            </div>
          )}
          <div className="col-span-2">
            <Button onClick={add}>Add</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">All Contacts ({contacts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between p-2 rounded border">
              <div>
                <p className="text-sm font-medium">{c.name} <Badge variant="outline" className="ml-2">{c.contact_type}</Badge></p>
                <p className="text-xs text-muted-foreground">{c.phone} · {c.scope}{c.scope_value ? `: ${c.scope_value}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.active} onCheckedChange={(v) => toggle(c.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {contacts.length === 0 && <p className="text-sm text-muted-foreground">No contacts configured yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

export default SafetyContacts;

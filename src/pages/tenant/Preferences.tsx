import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Loader2, Save, MapPin, Home, Wallet, Calendar } from "lucide-react";
import { regions } from "@/data/dummyData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const propertyTypes = ["Single Room", "Chamber & Hall", "1-Bedroom", "2-Bedroom", "3-Bedroom", "Self-Contained"];

const Preferences = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    current_location: "",
    preferred_location: "",
    property_type: "",
    min_budget: "",
    max_budget: "",
    preferred_move_in_date: "",
  });

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("tenant_preferences")
        .select("*")
        .eq("tenant_user_id", user.id)
        .maybeSingle();
      if (data) {
        setForm({
          current_location: data.current_location || "",
          preferred_location: data.preferred_location || "",
          property_type: data.property_type || "",
          min_budget: data.min_budget?.toString() || "",
          max_budget: data.max_budget?.toString() || "",
          preferred_move_in_date: data.preferred_move_in_date || "",
        });
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        tenant_user_id: user.id,
        current_location: form.current_location || null,
        preferred_location: form.preferred_location || null,
        property_type: form.property_type || null,
        min_budget: form.min_budget ? parseFloat(form.min_budget) : null,
        max_budget: form.max_budget ? parseFloat(form.max_budget) : null,
        preferred_move_in_date: form.preferred_move_in_date || null,
      };

      const { data: existing } = await supabase
        .from("tenant_preferences")
        .select("id")
        .eq("tenant_user_id", user.id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("tenant_preferences")
          .update(payload)
          .eq("tenant_user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tenant_preferences").insert(payload);
        if (error) throw error;
      }

      toast.success("Preferences saved! You'll be notified when matching properties are listed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
          <Bell className="h-7 w-7 text-primary" /> Property Preferences
        </h1>
        <p className="text-muted-foreground mt-1">Set your preferences to get notified when matching properties are listed</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Location</CardTitle>
          <CardDescription>Where are you now and where do you want to live?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Current Location</Label>
              <Input value={form.current_location} onChange={(e) => setForm(f => ({ ...f, current_location: e.target.value }))} placeholder="e.g. Madina, Accra" />
            </div>
            <div className="space-y-2">
              <Label>Preferred Rental Location</Label>
              <Input value={form.preferred_location} onChange={(e) => setForm(f => ({ ...f, preferred_location: e.target.value }))} placeholder="e.g. East Legon, Spintex" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Home className="h-5 w-5 text-primary" /> Property Type</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={form.property_type} onValueChange={(v) => setForm(f => ({ ...f, property_type: v }))}>
            <SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger>
            <SelectContent>
              {propertyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Budget Range (GH₵/month)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Minimum</Label>
              <Input type="number" value={form.min_budget} onChange={(e) => setForm(f => ({ ...f, min_budget: e.target.value }))} placeholder="e.g. 200" />
            </div>
            <div className="space-y-2">
              <Label>Maximum</Label>
              <Input type="number" value={form.max_budget} onChange={(e) => setForm(f => ({ ...f, max_budget: e.target.value }))} placeholder="e.g. 1500" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Calendar className="h-5 w-5 text-primary" /> Preferred Move-in Date</CardTitle>
        </CardHeader>
        <CardContent>
          <Input type="date" value={form.preferred_move_in_date} onChange={(e) => setForm(f => ({ ...f, preferred_move_in_date: e.target.value }))} />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Save Preferences
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        When a new listing matches your preferences, you'll receive an in-app notification automatically.
      </p>
    </div>
  );
};

export default Preferences;

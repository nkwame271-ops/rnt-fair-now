import { useState, useEffect } from "react";
import { Globe, Save, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RegionCode {
  id: string;
  region: string;
  code: string;
}

const RegionCodeManager = () => {
  const [codes, setCodes] = useState<RegionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCodes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("region_codes" as any)
      .select("id, region, code")
      .order("region");
    setCodes((data || []) as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleSave = async (id: string) => {
    if (!editValue.trim()) {
      toast.error("Code cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("region_codes" as any)
      .update({ code: editValue.trim().toUpperCase(), updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message.includes("unique") ? "Code already exists" : error.message);
    } else {
      toast.success("Region code updated");
      setEditingId(null);
      fetchCodes();
    }
    setSaving(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 space-y-4">
      <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
        <Globe className="h-5 w-5 text-primary" /> Region Codes
      </h2>
      <p className="text-sm text-muted-foreground">
        Region codes are used in serial number formatting (e.g. RCD-2026-<strong>GAR</strong>-0001). Only Main Admin can edit these.
      </p>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading...</p>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2 bg-muted/50 text-xs font-medium text-muted-foreground">
            <span>Region</span>
            <span>Code</span>
            <span />
          </div>
          <div className="divide-y divide-border">
            {codes.map(rc => (
              <div key={rc.id} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-2.5">
                <span className="text-sm text-card-foreground">{rc.region}</span>
                {editingId === rc.id ? (
                  <Input
                    className="w-20 h-8 text-xs font-mono uppercase"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    maxLength={5}
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && handleSave(rc.id)}
                  />
                ) : (
                  <Badge variant="outline" className="font-mono">{rc.code}</Badge>
                )}
                {editingId === rc.id ? (
                  <Button size="sm" onClick={() => handleSave(rc.id)} disabled={saving}>
                    <Save className="h-3.5 w-3.5 mr-1" /> Save
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => { setEditingId(rc.id); setEditValue(rc.code); }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RegionCodeManager;

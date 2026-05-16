import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface LinkedPropertySelection {
  property_id: string | null;
  unit_id: string | null;
  address: string;
  region: string;
  rent: number | null;
}

interface Props {
  partyUserId: string | null;
  partyRole: "tenant" | "landlord" | null;
  onChange: (sel: LinkedPropertySelection | null) => void;
}

const LinkedPropertyPicker = ({ partyUserId, partyRole, onChange }: Props) => {
  const [properties, setProperties] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [propertyId, setPropertyId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");

  useEffect(() => {
    if (!partyUserId) { setProperties([]); return; }
    (async () => {
      let propIds: string[] = [];
      if (partyRole === "landlord") {
        const { data } = await supabase
          .from("properties")
          .select("id, address, region, area, approved_rent")
          .eq("landlord_user_id", partyUserId);
        setProperties(data || []);
        return;
      }
      if (partyRole === "tenant") {
        const { data: tens } = await supabase
          .from("tenancies")
          .select("unit_id, units!inner(property_id, properties!inner(id, address, region, area, approved_rent))")
          .eq("tenant_user_id", partyUserId)
          .in("status", ["active", "renewal_window", "existing_declared", "pending"]);
        const props = (tens || []).map((t: any) => t.units.properties).filter(Boolean);
        const unique = Array.from(new Map(props.map((p: any) => [p.id, p])).values());
        setProperties(unique);
      }
    })();
  }, [partyUserId, partyRole]);

  useEffect(() => {
    if (!propertyId) { setUnits([]); return; }
    (async () => {
      const { data } = await supabase
        .from("units")
        .select("id, unit_name, unit_type, monthly_rent")
        .eq("property_id", propertyId);
      setUnits(data || []);
    })();
  }, [propertyId]);

  useEffect(() => {
    if (!propertyId) { onChange(null); return; }
    const prop = properties.find((p) => p.id === propertyId);
    const unit = units.find((u) => u.id === unitId);
    if (!prop) return;
    onChange({
      property_id: propertyId,
      unit_id: unitId || null,
      address: prop.address,
      region: prop.region,
      rent: unit?.monthly_rent ?? prop.approved_rent ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, unitId]);

  if (!partyUserId || !partyRole) return null;
  if (properties.length === 0) {
    return <p className="text-xs text-muted-foreground">No registered properties found for this party.</p>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1">
        <label className="text-sm font-medium">Property</label>
        <Select value={propertyId} onValueChange={(v) => { setPropertyId(v); setUnitId(""); }}>
          <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.address?.slice(0, 60)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {units.length > 0 && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Unit</label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue placeholder="Whole property / select unit" /></SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.unit_name} — GHS {Number(u.monthly_rent).toLocaleString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
};

export default LinkedPropertyPicker;

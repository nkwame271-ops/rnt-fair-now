import { useEffect, useState } from "react";
import { Building2, Users, MapPin, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Unit {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  status: string;
}

interface Property {
  id: string;
  property_name: string | null;
  property_code: string;
  address: string;
  region: string;
  area: string;
  units: Unit[];
  tenancyCount: number;
}

const MyProperties = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      const { data: props } = await supabase
        .from("properties")
        .select("*, units(*)")
        .eq("landlord_user_id", user.id);

      if (!props) { setLoading(false); return; }

      // Get tenancy counts
      const { data: tenancies } = await supabase
        .from("tenancies")
        .select("unit_id")
        .eq("landlord_user_id", user.id)
        .in("status", ["active", "pending"]);

      const tenancyUnitIds = new Set((tenancies || []).map(t => t.unit_id));

      setProperties(props.map(p => ({
        ...p,
        units: (p.units || []) as Unit[],
        tenancyCount: (p.units || []).filter((u: any) => tenancyUnitIds.has(u.id)).length,
      })));
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">My Properties</h1>
          <p className="text-muted-foreground mt-1">Overview of all registered properties</p>
        </div>
        <Link to="/landlord/add-tenant">
          <Button><UserPlus className="h-4 w-4 mr-1" /> Add Tenant</Button>
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="bg-card rounded-xl p-8 text-center border border-border">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-card-foreground">No properties yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Register your first property to get started.</p>
          <Link to="/landlord/register-property">
            <Button className="mt-4">Register Property</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {properties.map((p) => (
            <div key={p.id} className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
              <div className="gradient-hero p-5 text-primary-foreground">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{p.property_name || "Unnamed Property"}</h2>
                    <div className="flex items-center gap-1 text-sm text-primary-foreground/80 mt-1">
                      <MapPin className="h-3.5 w-3.5" /> {p.address}
                    </div>
                  </div>
                  <span className="text-xs bg-primary-foreground/20 px-2.5 py-1 rounded-full font-semibold">
                    {p.property_code}
                  </span>
                </div>
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {p.units.length} units</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.tenancyCount} tenants</span>
                </div>
              </div>
              <div className="p-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-muted-foreground text-xs border-b border-border">
                      <th className="text-left pb-2 font-medium">Unit</th>
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-left pb-2 font-medium">Rent</th>
                      <th className="text-left pb-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.units.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-medium text-card-foreground">{u.unit_name}</td>
                        <td className="py-3 text-muted-foreground">{u.unit_type}</td>
                        <td className="py-3 font-semibold text-card-foreground">GH₵ {u.monthly_rent}</td>
                        <td className="py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            u.status === "occupied" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}>
                            {u.status === "occupied" ? "Occupied" : "Vacant"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyProperties;

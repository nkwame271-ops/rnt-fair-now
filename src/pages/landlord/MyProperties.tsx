import { useEffect, useState } from "react";
import { Building2, Users, MapPin, UserPlus, Loader2, Droplets, Zap, ChefHat, Bath, CircleDot, Pencil, Trash2, Store, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Unit {
  id: string;
  unit_name: string;
  unit_type: string;
  monthly_rent: number;
  status: string;
  has_toilet_bathroom: boolean | null;
  has_kitchen: boolean | null;
  water_available: boolean | null;
  electricity_available: boolean | null;
  has_borehole: boolean | null;
  has_polytank: boolean | null;
  amenities: string[] | null;
  custom_amenities: string | null;
}

interface Property {
  id: string;
  property_name: string | null;
  property_code: string;
  address: string;
  region: string;
  area: string;
  gps_location: string | null;
  property_condition: string | null;
  listed_on_marketplace: boolean;
  units: Unit[];
  tenancyCount: number;
}

const facilityIcons: Record<string, { icon: React.ReactNode; label: string }> = {
  has_toilet_bathroom: { icon: <Bath className="h-3 w-3" />, label: "Toilet/Bath" },
  has_kitchen: { icon: <ChefHat className="h-3 w-3" />, label: "Kitchen" },
  water_available: { icon: <Droplets className="h-3 w-3" />, label: "Water" },
  electricity_available: { icon: <Zap className="h-3 w-3" />, label: "Electricity" },
  has_borehole: { icon: <CircleDot className="h-3 w-3" />, label: "Borehole" },
  has_polytank: { icon: <Droplets className="h-3 w-3" />, label: "Polytank" },
};

const MyProperties = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchProps = async () => {
      const { data: props } = await supabase
        .from("properties")
        .select("*, units(*)")
        .eq("landlord_user_id", user.id);

      if (!props) { setLoading(false); return; }

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
    fetchProps();
  }, [user]);

  const handleDelete = async (propertyId: string) => {
    setDeletingId(propertyId);
    // Delete units first, then property
    await supabase.from("units").delete().eq("property_id", propertyId);
    await supabase.from("property_images").delete().eq("property_id", propertyId);
    const { error } = await supabase.from("properties").delete().eq("id", propertyId).eq("landlord_user_id", user!.id);
    if (error) {
      toast.error(error.message);
    } else {
      setProperties(prev => prev.filter(p => p.id !== propertyId));
      toast.success("Property deleted");
    }
    setDeletingId(null);
  };

  const handleToggleListing = async (property: Property) => {
    if (property.listed_on_marketplace) {
      // Delist
      setListingId(property.id);
      const { error } = await supabase.from("properties").update({ listed_on_marketplace: false }).eq("id", property.id);
      if (error) { toast.error(error.message); }
      else {
        setProperties(prev => prev.map(p => p.id === property.id ? { ...p, listed_on_marketplace: false } : p));
        toast.success("Property delisted from marketplace");
      }
      setListingId(null);
    } else {
      // List → pay listing fee via Paystack
      setListingId(property.id);
      try {
        const { data, error } = await supabase.functions.invoke("paystack-checkout", {
          body: { type: "listing_fee", propertyId: property.id },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        if (data?.authorization_url) {
          window.location.href = data.authorization_url;
        } else {
          throw new Error("No checkout URL received");
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to initiate listing payment");
        setListingId(null);
      }
    }
  };

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
                      <MapPin className="h-3.5 w-3.5" /> {p.address}, {p.area}, {p.region}
                    </div>
                    {p.gps_location && (
                      <div className="text-xs text-primary-foreground/60 mt-0.5">GPS: {p.gps_location}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.listed_on_marketplace && (
                      <Badge className="bg-success/80 text-success-foreground text-xs">Listed</Badge>
                    )}
                    <span className="text-xs bg-primary-foreground/20 px-2.5 py-1 rounded-full font-semibold">
                      {p.property_code}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {p.units.length} units</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.tenancyCount} tenants</span>
                </div>
                {p.property_condition && (
                  <div className="text-xs text-primary-foreground/70 mt-2">Condition: {p.property_condition}</div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); navigate(`/landlord/edit-property/${p.id}`); }}
                    className="text-xs"
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={(e) => { e.stopPropagation(); handleToggleListing(p); }}
                    disabled={listingId === p.id}
                    className="text-xs"
                  >
                    <Store className="h-3 w-3 mr-1" />
                    {listingId === p.id ? "Processing..." : p.listed_on_marketplace ? "Delist" : "List on Marketplace"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Property?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete "{p.property_name || p.property_code}" and all its units. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deletingId === p.id ? "Deleting..." : "Delete Property"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {p.units.map((u) => (
                  <div key={u.id} className="bg-muted/50 rounded-lg p-4 space-y-3 border border-border/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-card-foreground">{u.unit_name}</span>
                        <span className="text-muted-foreground ml-2 text-sm">({u.unit_type})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-card-foreground">GH₵ {u.monthly_rent.toLocaleString()}/mo</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.status === "occupied" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                        }`}>
                          {u.status === "occupied" ? "Occupied" : "Vacant"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(facilityIcons).map(([key, { icon, label }]) => {
                        const hasIt = (u as any)[key];
                        if (!hasIt) return null;
                        return (
                          <Badge key={key} variant="secondary" className="text-xs gap-1 font-normal">
                            {icon} {label}
                          </Badge>
                        );
                      })}
                    </div>

                    {((u.amenities && u.amenities.length > 0) || u.custom_amenities) && (
                      <div className="flex flex-wrap gap-1.5">
                        {(u.amenities || []).map((a) => (
                          <Badge key={a} variant="outline" className="text-xs font-normal">{a}</Badge>
                        ))}
                        {u.custom_amenities && u.custom_amenities.split(",").map((a) => (
                          <Badge key={a.trim()} variant="outline" className="text-xs font-normal">{a.trim()}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyProperties;

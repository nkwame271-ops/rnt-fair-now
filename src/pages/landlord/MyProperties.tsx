import { useEffect, useState } from "react";
import { Building2, Users, MapPin, UserPlus, Loader2, Droplets, Zap, ChefHat, Bath, CircleDot, Pencil, Store, Archive, TrendingUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import AdminPasswordConfirm from "@/components/AdminPasswordConfirm";

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
  ghana_post_gps: string | null;
  property_condition: string | null;
  property_category: string;
  assessment_status: string;
  property_status: string;
  listed_on_marketplace: boolean;
  approved_rent: number | null;
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

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_identity_review: "bg-orange-100 text-orange-700 border-orange-200",
  pending_assessment: "bg-warning/10 text-warning border-warning/30",
  approved: "bg-success/10 text-success border-success/20",
  live: "bg-primary/10 text-primary border-primary/20",
  occupied: "bg-info/10 text-info border-info/20",
  off_market: "bg-muted text-muted-foreground border-border",
  pending_rent_review: "bg-warning/10 text-warning border-warning/30",
  suspended: "bg-destructive/10 text-destructive border-destructive/20",
  archived: "bg-muted text-muted-foreground border-border",
  needs_update: "bg-orange-100 text-orange-700 border-orange-200",
};

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_identity_review: "Identity Review",
  pending_assessment: "Under Assessment",
  approved: "Approved",
  live: "Live on Marketplace",
  occupied: "Occupied",
  off_market: "Off Market",
  pending_rent_review: "Rent Review",
  suspended: "Suspended",
  archived: "Archived",
  needs_update: "Needs Update",
};

const MyProperties = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<string | null>(null);
  const [archivePassword, setArchivePassword] = useState("");
  const [listingId, setListingId] = useState<string | null>(null);

  const fetchProps = async () => {
    if (!user) return;
    const { data: props } = await supabase
      .from("properties")
      .select("*, units(*)")
      .eq("landlord_user_id", user.id)
      .neq("property_status", "archived");

    if (!props) { setLoading(false); return; }

    const { data: tenancies } = await supabase
      .from("tenancies")
      .select("unit_id")
      .eq("landlord_user_id", user.id)
      .in("status", ["active", "pending"]);

    const tenancyUnitIds = new Set((tenancies || []).map(t => t.unit_id));

    setProperties(props.map(p => ({
      ...p,
      property_status: (p as any).property_status || "pending_assessment",
      units: (p.units || []) as Unit[],
      tenancyCount: (p.units || []).filter((u: any) => tenancyUnitIds.has(u.id)).length,
    })));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchProps();

    const params = new URLSearchParams(window.location.search);
    const payStatus = params.get("status");
    const ref = params.get("reference") || params.get("trxref") || sessionStorage.getItem("pendingPaymentReference");
    if (ref) sessionStorage.removeItem("pendingPaymentReference");

    if (ref || payStatus === "listed") {
      window.history.replaceState({}, "", window.location.pathname);
      if (ref) {
        supabase.functions.invoke("verify-payment", { body: { reference: ref } })
          .then(({ data }) => {
            if (data?.verified) toast.success("Property listed on marketplace successfully!");
            else toast.info("Payment is being processed. Your listing will appear shortly.");
            fetchProps();
          })
          .catch(() => { toast.info("Payment is being processed."); fetchProps(); });
      } else {
        toast.success("Property listed on marketplace successfully!");
        fetchProps();
      }
    } else if (payStatus === "cancelled" || payStatus === "failed") {
      toast.error("Listing payment was not completed.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [user]);

  const handleArchive = async (propertyId: string) => {
    if (!archiveReason.trim()) {
      toast.error("Please provide a reason for archiving");
      return;
    }
    setArchivingId(propertyId);
    try {
      const { error } = await supabase.from("properties").update({
        property_status: "archived",
        archived_at: new Date().toISOString(),
        archived_reason: archiveReason,
        listed_on_marketplace: false,
      } as any).eq("id", propertyId).eq("landlord_user_id", user!.id);

      if (error) throw error;

      // Log the archive event
      await supabase.from("property_events").insert({
        property_id: propertyId,
        event_type: "archive",
        old_value: {},
        new_value: { status: "archived", reason: archiveReason },
        performed_by: user!.id,
        reason: archiveReason,
      } as any);

      setProperties(prev => prev.filter(p => p.id !== propertyId));
      toast.success("Property archived. Its history is preserved and can be restored by an administrator.");
      setShowArchiveConfirm(null);
      setArchiveReason("");
    } catch (err: any) {
      toast.error(err.message || "Failed to archive property");
    }
    setArchivingId(null);
  };

  const handleToggleListing = async (property: Property) => {
    if (property.listed_on_marketplace) {
      // Delist flow — guard against occupied units
      const hasOccupiedUnit = property.units.some(u => u.status === "occupied");
      if (hasOccupiedUnit) {
        toast.error("Occupied properties cannot be delisted. All units must be vacant first.");
        return;
      }
      setListingId(property.id);
      const { error } = await supabase.from("properties").update({
        listed_on_marketplace: false,
        property_status: "off_market",
      } as any).eq("id", property.id);
      if (error) toast.error(error.message);
      else {
        await supabase.from("property_events").insert({
          property_id: property.id,
          event_type: "delisting",
          old_value: { status: "live" },
          new_value: { status: "off_market" },
          performed_by: user!.id,
          reason: "Landlord delisted property",
        } as any);
        setProperties(prev => prev.map(p => p.id === property.id ? { ...p, listed_on_marketplace: false, property_status: "off_market" } : p));
        toast.success("Property delisted from marketplace");
      }
      setListingId(null);
    } else {
      // Compliance checks before listing
      const complianceErrors: string[] = [];

      if (!property.ghana_post_gps) {
        complianceErrors.push("Ghana Post GPS code is required");
      }
      if (!property.gps_location) {
        complianceErrors.push("Map location pin is required");
      }
      if (property.units.length === 0) {
        complianceErrors.push("At least one unit must be registered");
      }
      if (property.property_status === "pending_assessment") {
        complianceErrors.push("Property is awaiting Rent Control assessment. Listing will be available after approval.");
      } else if (property.property_status === "pending_identity_review") {
        complianceErrors.push("Identity review is pending. Listing will be available after approval.");
      } else if (!["approved", "off_market", "live"].includes(property.property_status)) {
        complianceErrors.push("Property must be approved before listing");
      }
      const hasVacantUnit = property.units.some(u => u.status === "vacant");
      if (property.units.length > 0 && !hasVacantUnit) {
        complianceErrors.push("At least one unit must be vacant to list on the marketplace");
      }

      // Check if KYC is verified for this landlord
      const { data: kyc } = await supabase
        .from("kyc_verifications")
        .select("status")
        .eq("user_id", user!.id)
        .eq("status", "verified")
        .limit(1);

      if (!kyc || kyc.length === 0) {
        complianceErrors.push("Ownership identity verification (KYC) is required");
      }

      // Check if property was previously listed at a higher rent (anti-evasion relist check)
      if (property.property_status === "off_market" && (property as any).approved_rent) {
        const currentMaxRent = Math.max(...property.units.map(u => u.monthly_rent));
        const approvedRent = Number((property as any).approved_rent);
        if (currentMaxRent > approvedRent) {
          // Check if there's an approved rent increase request
          const { data: approvedIncrease } = await supabase
            .from("rent_increase_requests")
            .select("id")
            .eq("property_id", property.id)
            .eq("status", "approved")
            .gte("reviewed_at", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString())
            .limit(1);

          if (!approvedIncrease || approvedIncrease.length === 0) {
            complianceErrors.push("Unit rent exceeds previously approved rent. Submit a Rent Increase Request first.");
          }
        }
      }

      if (complianceErrors.length > 0) {
        toast.error(
          `Cannot list property:\n• ${complianceErrors.join("\n• ")}`,
          { duration: 6000 }
        );
        return;
      }

      // Proceed with listing
      setListingId(property.id);
      try {
        const { data, error } = await supabase.functions.invoke("paystack-checkout", {
          body: { type: "listing_fee", propertyId: property.id },
        });
        if (error) throw new Error(error.message);
        if (data?.ok === false) throw new Error(data.error || "Listing payment failed");
        if (data?.error) throw new Error(data.error);

        if (data?.skipped) {
          const { error: updateErr } = await supabase.from("properties").update({
            listed_on_marketplace: true,
            property_status: "live",
          } as any).eq("id", property.id);
          if (updateErr) throw new Error(updateErr.message);

          // Log listing event
          await supabase.from("property_events").insert({
            property_id: property.id,
            event_type: "listing",
            old_value: { status: property.property_status },
            new_value: { status: "live" },
            performed_by: user!.id,
            reason: "Property listed on marketplace (fee waived)",
          } as any);

          setProperties(prev => prev.map(p => p.id === property.id ? { ...p, listed_on_marketplace: true, property_status: "live" } : p));
          toast.success(data.message || "Property listed on marketplace!");
          setListingId(null);
          return;
        }

        if (data?.authorization_url) {
          if (data?.reference) sessionStorage.setItem("pendingPaymentReference", data.reference);
          window.location.href = data.authorization_url;
        } else {
          if (data && !data.error) {
            const { error: updateErr } = await supabase.from("properties").update({
              listed_on_marketplace: true,
              property_status: "live",
            } as any).eq("id", property.id);
            if (updateErr) throw new Error(updateErr.message);
            setProperties(prev => prev.map(p => p.id === property.id ? { ...p, listed_on_marketplace: true, property_status: "live" } : p));
            toast.success("Property listed on marketplace!");
            setListingId(null);
            return;
          }
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
        <div className="flex gap-2">
          <Link to="/landlord/rent-increase-request">
            <Button variant="outline" size="sm"><TrendingUp className="h-4 w-4 mr-1" /> Rent Increase</Button>
          </Link>
          <Link to="/landlord/add-tenant">
            <Button><UserPlus className="h-4 w-4 mr-1" /> Add Tenant</Button>
          </Link>
        </div>
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
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <Badge variant="outline" className="text-xs capitalize bg-primary-foreground/10 text-primary-foreground border-primary-foreground/20">
                      {p.property_category || "residential"}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${statusColors[p.property_status] || "text-muted-foreground"}`}>
                      {statusLabels[p.property_status] || p.property_status}
                    </Badge>
                    <span className="text-xs bg-primary-foreground/20 px-2.5 py-1 rounded-full font-semibold">
                      {p.property_code}
                    </span>
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-sm">
                  {p.property_category === "hostel" ? (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> {p.units.length} bed-spaces ({p.tenancyCount} occupied)
                    </span>
                  ) : (
                    <>
                      <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {p.units.length} units</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {p.tenancyCount} tenants</span>
                    </>
                  )}
                </div>

                <div className="flex gap-2 mt-3 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/landlord/edit-property/${p.id}`)} className="text-xs">
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm" variant="secondary"
                    onClick={() => handleToggleListing(p)}
                    disabled={
                      listingId === p.id ||
                      (!p.listed_on_marketplace && (
                        ["pending_assessment", "pending_identity_review"].includes(p.property_status) ||
                        !["approved", "off_market", "live"].includes(p.property_status)
                      ))
                    }
                    className="text-xs"
                  >
                    <Store className="h-3 w-3 mr-1" />
                    {listingId === p.id ? "Processing..." : p.listed_on_marketplace ? "Delist" : !["approved", "off_market"].includes(p.property_status) ? "Awaiting Approval" : "List on Marketplace"}
                  </Button>

                  {/* Archive button */}
                  <AlertDialog open={showArchiveConfirm === p.id} onOpenChange={(open) => { if (!open) { setShowArchiveConfirm(null); setArchiveReason(""); } }}>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive" className="text-xs" onClick={(e) => { e.stopPropagation(); setShowArchiveConfirm(p.id); }}>
                        <Archive className="h-3 w-3 mr-1" /> Archive
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive Property?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove "{p.property_name || p.property_code}" from active listings. The property record and its history will be preserved. Future relisting will require re-assessment and may incur fees.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <div className="space-y-3 py-2">
                        <div className="space-y-2">
                          <Label className="text-sm">Reason for archiving *</Label>
                          <Textarea
                            value={archiveReason}
                            onChange={(e) => setArchiveReason(e.target.value)}
                            placeholder="e.g. Property sold, no longer renting, renovation planned..."
                            rows={3}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">Confirm your password *</Label>
                          <Input
                            type="password"
                            value={archivePassword}
                            onChange={(e) => setArchivePassword(e.target.value)}
                            placeholder="Enter your password to confirm"
                          />
                        </div>
                      </div>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleArchive(p.id)}
                          disabled={archivingId === p.id || !archiveReason.trim()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {archivingId === p.id ? "Archiving..." : "Archive Property"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Needs Update banner with suggested price */}
              {p.property_status === "needs_update" && (
                <div className="mx-4 mt-0 mb-2 p-3 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Pricing update required</p>
                      {(p as any).suggested_price && (
                        <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                          Admin suggested rent: <strong>GH₵ {Number((p as any).suggested_price).toLocaleString()}/mo</strong>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">Edit your property to adjust pricing, then resubmit for assessment.</p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/landlord/edit-property/${p.id}`)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit Property
                        </Button>
                        <Button size="sm" className="text-xs bg-orange-600 hover:bg-orange-700 text-white" onClick={async () => {
                          const { error } = await supabase.from("properties").update({
                            property_status: "pending_assessment",
                          } as any).eq("id", p.id);
                          if (error) toast.error(error.message);
                          else {
                            setProperties(prev => prev.map(pr => pr.id === p.id ? { ...pr, property_status: "pending_assessment" } : pr));
                            toast.success("Property resubmitted for assessment");
                          }
                        }}>
                          Resubmit for Assessment
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

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

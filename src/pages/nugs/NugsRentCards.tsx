import { useEffect, useState } from "react";
import { CreditCard, Package, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import LogoLoader from "@/components/LogoLoader";
import OfficeSerialStock from "@/pages/regulator/rent-cards/OfficeSerialStock";
import PendingPurchases from "@/pages/regulator/rent-cards/PendingPurchases";
import AssignmentHistory from "@/pages/regulator/rent-cards/AssignmentHistory";
import type { AdminProfile } from "@/hooks/useAdminProfile";

const NugsRentCards = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase.from("nugs_staff") as any)
        .select("assigned_school")
        .eq("user_id", user.id)
        .maybeSingle();
      const school = (data as any)?.assigned_school || "NUGS";
      // Synthesize an AdminProfile so we can reuse regulator rent-card components.
      // Use a deterministic NUGS-prefixed office id so revenue is classified as student revenue.
      const officeId = "nugs_" + String(school).toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
      setProfile({
        adminType: "sub_admin",
        officeId,
        officeName: `NUGS · ${school}`,
        allowedFeatures: ["rent_cards", "rent_card_sales"],
        mutedFeatures: [],
        isMainAdmin: false,
        isSuperAdmin: false,
      });
      setLoading(false);
    })();
  }, [user]);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  if (loading) return <LogoLoader message="Loading rent cards..." />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" /> Rent Card Assignments
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage rent card stock and assign serials for {profile?.officeName}.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="pending" className="gap-1">
            <ShoppingCart className="h-3.5 w-3.5" /> Pending &amp; Assign
          </TabsTrigger>
          <TabsTrigger value="stock" className="gap-1">
            <Package className="h-3.5 w-3.5" /> Stock
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <CreditCard className="h-3.5 w-3.5" /> History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <PendingPurchases profile={profile} onStockChanged={triggerRefresh} />
        </TabsContent>
        <TabsContent value="stock">
          <OfficeSerialStock profile={profile} refreshKey={refreshKey} />
        </TabsContent>
        <TabsContent value="history">
          <AssignmentHistory profile={profile} refreshKey={refreshKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NugsRentCards;

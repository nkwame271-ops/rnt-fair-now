import { useState } from "react";
import { CreditCard } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import SerialBatchUpload from "./rent-cards/SerialBatchUpload";
import OfficeSerialStock from "./rent-cards/OfficeSerialStock";
import PendingPurchases from "./rent-cards/PendingPurchases";
import AssignmentHistory from "./rent-cards/AssignmentHistory";
import StockAlerts from "./rent-cards/StockAlerts";

const RegulatorRentCards = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  const isMain = !profile || profile.isMainAdmin;

  if (profileLoading) return <LogoLoader message="Loading..." />;

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-primary" /> Rent Card Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload serials, manage office stock, assign to purchases, and monitor alerts.
          </p>
        </div>

        <Tabs defaultValue={isMain ? "batch_upload" : "stock"}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {isMain && <TabsTrigger value="batch_upload">Serial Batch Upload</TabsTrigger>}
            <TabsTrigger value="stock">Office Stock</TabsTrigger>
            <TabsTrigger value="pending">Pending & Assign</TabsTrigger>
            <TabsTrigger value="history">Assignment History</TabsTrigger>
            {isMain && <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>}
          </TabsList>

          {isMain && (
            <TabsContent value="batch_upload">
              <SerialBatchUpload onStockChanged={triggerRefresh} />
            </TabsContent>
          )}

          <TabsContent value="stock">
            <OfficeSerialStock profile={profile} refreshKey={refreshKey} />
          </TabsContent>

          <TabsContent value="pending">
            <PendingPurchases profile={profile} onStockChanged={triggerRefresh} />
          </TabsContent>

          <TabsContent value="history">
            <AssignmentHistory profile={profile} refreshKey={refreshKey} />
          </TabsContent>

          {isMain && (
            <TabsContent value="alerts">
              <StockAlerts refreshKey={refreshKey} threshold={50} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default RegulatorRentCards;

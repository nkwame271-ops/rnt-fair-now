import { useState } from "react";
import { CreditCard, ShoppingCart, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminProfile } from "@/hooks/useAdminProfile";
import LogoLoader from "@/components/LogoLoader";
import PageTransition from "@/components/PageTransition";
import SerialBatchUpload from "./rent-cards/SerialBatchUpload";
import SerialGenerator from "./rent-cards/SerialGenerator";
import OfficeSerialStock from "./rent-cards/OfficeSerialStock";
import PendingPurchases from "./rent-cards/PendingPurchases";
import AssignmentHistory from "./rent-cards/AssignmentHistory";
import StockAlerts from "./rent-cards/StockAlerts";
import AdminActions from "./rent-cards/AdminActions";
import DailyReport from "./rent-cards/DailyReport";
import AdminReportView from "./rent-cards/AdminReportView";

const RegulatorRentCards = () => {
  const { profile, loading: profileLoading } = useAdminProfile();
  const [refreshKey, setRefreshKey] = useState(0);
  const triggerRefresh = () => setRefreshKey(k => k + 1);

  const isMain = !profile || profile.isMainAdmin;

  // Permission checks for procurement/sales workspaces
  const hasRentCards = profile?.allowedFeatures?.includes("rent_cards");
  const hasProcurement = isMain || hasRentCards || profile?.allowedFeatures?.includes("rent_card_procurement");
  const hasSales = isMain || hasRentCards || profile?.allowedFeatures?.includes("rent_card_sales");

  if (profileLoading) return <LogoLoader message="Loading..." />;

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-7 w-7 text-primary" /> Rent Card Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Procurement and Sales workspaces for rent card operations.
          </p>
        </div>

        <Tabs defaultValue={hasProcurement ? "procurement" : "sales"}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            {hasProcurement && (
              <TabsTrigger value="procurement" className="gap-1">
                <Package className="h-3.5 w-3.5" /> Procurement
              </TabsTrigger>
            )}
            {hasSales && (
              <TabsTrigger value="sales" className="gap-1">
                <ShoppingCart className="h-3.5 w-3.5" /> Sales
              </TabsTrigger>
            )}
            {isMain && <TabsTrigger value="admin_actions">Admin Actions</TabsTrigger>}
          </TabsList>

          {/* PROCUREMENT WORKSPACE */}
          {hasProcurement && (
            <TabsContent value="procurement">
              <Tabs defaultValue="generate">
                <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                  {isMain && <TabsTrigger value="generate">Generate Serials</TabsTrigger>}
                  {isMain && <TabsTrigger value="batch_upload">Batch Upload</TabsTrigger>}
                  {isMain && <TabsTrigger value="alerts">Stock Alerts</TabsTrigger>}
                </TabsList>

                {isMain && (
                  <TabsContent value="generate">
                    <SerialGenerator onStockChanged={triggerRefresh} />
                  </TabsContent>
                )}
                {isMain && (
                  <TabsContent value="batch_upload">
                    <SerialBatchUpload onStockChanged={triggerRefresh} />
                  </TabsContent>
                )}
                {isMain && (
                  <TabsContent value="alerts">
                    <StockAlerts refreshKey={refreshKey} threshold={50} />
                  </TabsContent>
                )}
              </Tabs>
            </TabsContent>
          )}

          {/* SALES WORKSPACE */}
          {hasSales && (
            <TabsContent value="sales">
              <Tabs defaultValue="stock">
                <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                  <TabsTrigger value="stock">Office Stock</TabsTrigger>
                  <TabsTrigger value="pending">Pending & Assign</TabsTrigger>
                  <TabsTrigger value="history">Assignment History</TabsTrigger>
                  <TabsTrigger value="daily_report">Daily Report</TabsTrigger>
                  {isMain && <TabsTrigger value="admin_reports">Admin Reports</TabsTrigger>}
                </TabsList>

                <TabsContent value="stock">
                  <OfficeSerialStock profile={profile} refreshKey={refreshKey} />
                </TabsContent>
                <TabsContent value="pending">
                  <PendingPurchases profile={profile} onStockChanged={triggerRefresh} />
                </TabsContent>
                <TabsContent value="history">
                  <AssignmentHistory profile={profile} refreshKey={refreshKey} />
                </TabsContent>
                <TabsContent value="daily_report">
                  <DailyReport profile={profile} refreshKey={refreshKey} />
                </TabsContent>
                {isMain && (
                  <TabsContent value="admin_reports">
                    <AdminReportView />
                  </TabsContent>
                )}
              </Tabs>
            </TabsContent>
          )}

          {/* ADMIN ACTIONS (serial-related only) */}
          {isMain && (
            <TabsContent value="admin_actions">
              <AdminActions refreshKey={refreshKey} onStockChanged={triggerRefresh} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </PageTransition>
  );
};

export default RegulatorRentCards;

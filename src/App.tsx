import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleSelect from "./pages/RoleSelect";
import Login from "./pages/Login";
import RegisterTenant from "./pages/RegisterTenant";
import RegisterLandlord from "./pages/RegisterLandlord";
import RegulatorLogin from "./pages/RegulatorLogin";
import TenantLayout from "./components/TenantLayout";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import Marketplace from "./pages/tenant/Marketplace";
import RentChecker from "./pages/tenant/RentChecker";
import FileComplaint from "./pages/tenant/FileComplaint";
import MyCases from "./pages/tenant/MyCases";
import Payments from "./pages/tenant/Payments";
import LegalAssistant from "./pages/tenant/LegalAssistant";
import MyAgreements from "./pages/tenant/MyAgreements";
import LandlordLayout from "./components/LandlordLayout";
import LandlordDashboard from "./pages/landlord/LandlordDashboard";
import MyProperties from "./pages/landlord/MyProperties";
import RegisterProperty from "./pages/landlord/RegisterProperty";
import Agreements from "./pages/landlord/Agreements";
import AddTenant from "./pages/landlord/AddTenant";
import RegulatorLayout from "./components/RegulatorLayout";
import LandlordViewingRequests from "./pages/landlord/ViewingRequests";
import RegulatorDashboard from "./pages/regulator/RegulatorDashboard";
import RegulatorTenants from "./pages/regulator/RegulatorTenants";
import RegulatorLandlords from "./pages/regulator/RegulatorLandlords";
import RegulatorProperties from "./pages/regulator/RegulatorProperties";
import RegulatorComplaints from "./pages/regulator/RegulatorComplaints";
import RegulatorAnalytics from "./pages/regulator/RegulatorAnalytics";
import InviteStaff from "./pages/regulator/InviteStaff";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RoleSelect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register/tenant" element={<RegisterTenant />} />
            <Route path="/register/landlord" element={<RegisterLandlord />} />
            <Route path="/regulator/login" element={<RegulatorLogin />} />

            {/* Tenant Routes */}
            <Route path="/tenant" element={<ProtectedRoute requiredRole="tenant"><TenantLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<TenantDashboard />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="rent-checker" element={<RentChecker />} />
              <Route path="file-complaint" element={<FileComplaint />} />
              <Route path="my-cases" element={<MyCases />} />
              <Route path="payments" element={<Payments />} />
              <Route path="my-agreements" element={<MyAgreements />} />
              <Route path="legal-assistant" element={<LegalAssistant />} />
            </Route>

            {/* Landlord Routes */}
            <Route path="/landlord" element={<ProtectedRoute requiredRole="landlord"><LandlordLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LandlordDashboard />} />
              <Route path="my-properties" element={<MyProperties />} />
              <Route path="register-property" element={<RegisterProperty />} />
              <Route path="agreements" element={<Agreements />} />
              <Route path="add-tenant" element={<AddTenant />} />
              <Route path="viewing-requests" element={<LandlordViewingRequests />} />
            </Route>

            {/* Regulator Routes */}
            <Route path="/regulator" element={<ProtectedRoute requiredRole="regulator"><RegulatorLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RegulatorDashboard />} />
              <Route path="tenants" element={<RegulatorTenants />} />
              <Route path="landlords" element={<RegulatorLandlords />} />
              <Route path="properties" element={<RegulatorProperties />} />
              <Route path="complaints" element={<RegulatorComplaints />} />
              <Route path="analytics" element={<RegulatorAnalytics />} />
              <Route path="invite-staff" element={<InviteStaff />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

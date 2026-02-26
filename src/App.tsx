import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import KycGate from "@/components/KycGate";
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
import LandlordFeedback from "./pages/landlord/LandlordFeedback";
import RegulatorDashboard from "./pages/regulator/RegulatorDashboard";
import RegulatorTenants from "./pages/regulator/RegulatorTenants";
import RegulatorLandlords from "./pages/regulator/RegulatorLandlords";
import RegulatorProperties from "./pages/regulator/RegulatorProperties";
import RegulatorComplaints from "./pages/regulator/RegulatorComplaints";
import RegulatorAgreements from "./pages/regulator/RegulatorAgreements";
import RegulatorAgreementTemplates from "./pages/regulator/RegulatorAgreementTemplates";
import RegulatorAnalytics from "./pages/regulator/RegulatorAnalytics";
import InviteStaff from "./pages/regulator/InviteStaff";
import RegulatorKyc from "./pages/regulator/RegulatorKyc";
import RegulatorFeedback from "./pages/regulator/RegulatorFeedback";
import ProfilePage from "./pages/shared/ProfilePage";
import VerifyRegistration from "./pages/shared/VerifyRegistration";
import NotFound from "./pages/NotFound";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RoleSelect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register/tenant" element={<RegisterTenant />} />
            <Route path="/register/landlord" element={<RegisterLandlord />} />
            <Route path="/regulator/login" element={<RegulatorLogin />} />
            <Route path="/verify/:role/:id" element={<VerifyRegistration />} />

            {/* Tenant Routes */}
            <Route path="/tenant" element={<ProtectedRoute requiredRole="tenant"><TenantLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<TenantDashboard />} />
              <Route path="marketplace" element={<Marketplace />} />
              <Route path="rent-checker" element={<RentChecker />} />
              <Route path="file-complaint" element={<KycGate action="file a complaint"><FileComplaint /></KycGate>} />
              <Route path="my-cases" element={<MyCases />} />
              <Route path="payments" element={<Payments />} />
              <Route path="my-agreements" element={<MyAgreements />} />
              <Route path="legal-assistant" element={<LegalAssistant />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Landlord Routes */}
            <Route path="/landlord" element={<ProtectedRoute requiredRole="landlord"><LandlordLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LandlordDashboard />} />
              <Route path="my-properties" element={<MyProperties />} />
              <Route path="register-property" element={<RouteErrorBoundary routeName="Landlord Register Property"><RegisterProperty /></RouteErrorBoundary>} />
              <Route path="agreements" element={<Agreements />} />
              <Route path="add-tenant" element={<KycGate action="add a tenant"><AddTenant /></KycGate>} />
              <Route path="viewing-requests" element={<LandlordViewingRequests />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="feedback" element={<LandlordFeedback />} />
            </Route>

            {/* Regulator Routes */}
            <Route path="/regulator" element={<ProtectedRoute requiredRole="regulator"><RegulatorLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<RegulatorDashboard />} />
              <Route path="tenants" element={<RegulatorTenants />} />
              <Route path="landlords" element={<RegulatorLandlords />} />
              <Route path="properties" element={<RegulatorProperties />} />
              <Route path="complaints" element={<RegulatorComplaints />} />
              <Route path="agreements" element={<RegulatorAgreements />} />
              <Route path="agreement-templates" element={<RegulatorAgreementTemplates />} />
              <Route path="analytics" element={<RegulatorAnalytics />} />
              <Route path="invite-staff" element={<InviteStaff />} />
              <Route path="kyc" element={<RegulatorKyc />} />
              <Route path="feedback" element={<RegulatorFeedback />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

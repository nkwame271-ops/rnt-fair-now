import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import KycGate from "@/components/KycGate";
import RoleSelect from "./pages/RoleSelect";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
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
import TenantPreferences from "./pages/tenant/Preferences";
import TenantMessages from "./pages/tenant/Messages";
import RequestRenewal from "./pages/tenant/RequestRenewal";
import TenantTerminationRequest from "./pages/tenant/TerminationRequest";
import ReportSidePayment from "./pages/tenant/ReportSidePayment";
import LandlordLayout from "./components/LandlordLayout";
import LandlordDashboard from "./pages/landlord/LandlordDashboard";
import MyProperties from "./pages/landlord/MyProperties";
import RegisterProperty from "./pages/landlord/RegisterProperty";
import EditProperty from "./pages/landlord/EditProperty";
import Agreements from "./pages/landlord/Agreements";
import AddTenant from "./pages/landlord/AddTenant";
import RegulatorLayout from "./components/RegulatorLayout";
import LandlordViewingRequests from "./pages/landlord/ViewingRequests";
import LandlordFeedback from "./pages/landlord/LandlordFeedback";
import LandlordMessages from "./pages/landlord/Messages";
import LandlordApplications from "./pages/landlord/LandlordApplications";
import LandlordComplaints from "./pages/landlord/LandlordComplaints";
import RentalApplications from "./pages/landlord/RentalApplications";
import DeclareExistingTenancy from "./pages/landlord/DeclareExistingTenancy";
import RenewalRequests from "./pages/landlord/RenewalRequests";
import LandlordTerminationRequest from "./pages/landlord/TerminationRequest";
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
import RegulatorSupportChats from "./pages/regulator/RegulatorSupportChats";
import AgencyApiKeys from "./pages/regulator/AgencyApiKeys";
import EngineRoom from "./pages/regulator/EngineRoom";
import RegulatorRentAssessments from "./pages/regulator/RegulatorRentAssessments";
import RegulatorApplications from "./pages/regulator/RegulatorApplications";
import RegulatorTerminations from "./pages/regulator/RegulatorTerminations";
import TenantReceipts from "./pages/tenant/Receipts";
import LandlordPaymentSettings from "./pages/landlord/PaymentSettings";
import LandlordReceipts from "./pages/landlord/Receipts";
import ManageRentCards from "./pages/landlord/ManageRentCards";
import EscrowDashboard from "./pages/regulator/EscrowDashboard";
import RegulatorRentCards from "./pages/regulator/RegulatorRentCards";
import ProfilePage from "./pages/shared/ProfilePage";
import VerifyRegistration from "./pages/shared/VerifyRegistration";
import VerifyTenancy from "./pages/shared/VerifyTenancy";
import VerifyRentCard from "./pages/shared/VerifyRentCard";
import VerifyReceipt from "./pages/shared/VerifyReceipt";
import NotFound from "./pages/NotFound";

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
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-tenancy/:tenancyId" element={<VerifyTenancy />} />
            <Route path="/verify/rent-card/:token" element={<VerifyRentCard />} />
            <Route path="/verify/receipt/:receiptNumber" element={<VerifyReceipt />} />

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
              <Route path="preferences" element={<TenantPreferences />} />
              <Route path="messages" element={<TenantMessages />} />
              <Route path="renewal" element={<RequestRenewal />} />
              <Route path="termination" element={<TenantTerminationRequest />} />
              <Route path="report-side-payment" element={<ReportSidePayment />} />
              <Route path="receipts" element={<TenantReceipts />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            {/* Landlord Routes */}
            <Route path="/landlord" element={<ProtectedRoute requiredRole="landlord"><LandlordLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<LandlordDashboard />} />
              <Route path="my-properties" element={<MyProperties />} />
              <Route path="register-property" element={<ErrorBoundary section="Register Property Page"><RegisterProperty /></ErrorBoundary>} />
              <Route path="edit-property/:id" element={<EditProperty />} />
              <Route path="agreements" element={<Agreements />} />
              <Route path="add-tenant" element={<KycGate action="add a tenant"><AddTenant /></KycGate>} />
              <Route path="declare-existing-tenancy" element={<KycGate action="declare an existing tenancy"><DeclareExistingTenancy /></KycGate>} />
              <Route path="viewing-requests" element={<LandlordViewingRequests />} />
              <Route path="messages" element={<LandlordMessages />} />
              <Route path="rental-applications" element={<RentalApplications />} />
              <Route path="applications" element={<LandlordApplications />} />
              <Route path="complaints" element={<LandlordComplaints />} />
              <Route path="renewal-requests" element={<RenewalRequests />} />
              <Route path="termination" element={<LandlordTerminationRequest />} />
              <Route path="rent-cards" element={<ManageRentCards />} />
              <Route path="payment-settings" element={<LandlordPaymentSettings />} />
              <Route path="receipts" element={<LandlordReceipts />} />
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
              <Route path="applications" element={<RegulatorApplications />} />
              <Route path="agreement-templates" element={<RegulatorAgreementTemplates />} />
              <Route path="analytics" element={<RegulatorAnalytics />} />
              <Route path="escrow" element={<EscrowDashboard />} />
              <Route path="invite-staff" element={<InviteStaff />} />
              <Route path="kyc" element={<RegulatorKyc />} />
              <Route path="feedback" element={<RegulatorFeedback />} />
              <Route path="support-chats" element={<RegulatorSupportChats />} />
              <Route path="api-keys" element={<AgencyApiKeys />} />
              <Route path="engine-room" element={<EngineRoom />} />
              <Route path="rent-assessments" element={<RegulatorRentAssessments />} />
              <Route path="terminations" element={<RegulatorTerminations />} />
              <Route path="rent-cards" element={<RegulatorRentCards />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

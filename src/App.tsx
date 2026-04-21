import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import LogoLoader from "@/components/LogoLoader";

// Layouts loaded eagerly (used on every authenticated page)
import TenantLayout from "./components/TenantLayout";
import LandlordLayout from "./components/LandlordLayout";
import RegulatorLayout from "./components/RegulatorLayout";
import NugsLayout from "./components/NugsLayout";

// Lazy-loaded pages
const RoleSelect = lazy(() => import("./pages/RoleSelect"));
const Login = lazy(() => import("./pages/Login"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const RegisterTenant = lazy(() => import("./pages/RegisterTenant"));
const RegisterLandlord = lazy(() => import("./pages/RegisterLandlord"));
const RegulatorLogin = lazy(() => import("./pages/RegulatorLogin"));
const NotFound = lazy(() => import("./pages/NotFound"));
const VerifyRegistration = lazy(() => import("./pages/shared/VerifyRegistration"));
const VerifyTenancy = lazy(() => import("./pages/shared/VerifyTenancy"));
const VerifyRentCard = lazy(() => import("./pages/shared/VerifyRentCard"));
const VerifyReceipt = lazy(() => import("./pages/shared/VerifyReceipt"));
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));

// Tenant pages
const TenantDashboard = lazy(() => import("./pages/tenant/TenantDashboard"));
const Marketplace = lazy(() => import("./pages/tenant/Marketplace"));
const RentChecker = lazy(() => import("./pages/tenant/RentChecker"));
const FileComplaint = lazy(() => import("./pages/tenant/FileComplaint"));
const MyCases = lazy(() => import("./pages/tenant/MyCases"));
const Payments = lazy(() => import("./pages/tenant/Payments"));
const LegalAssistant = lazy(() => import("./pages/tenant/LegalAssistant"));
const MyAgreements = lazy(() => import("./pages/tenant/MyAgreements"));
const TenantPreferences = lazy(() => import("./pages/tenant/Preferences"));
const TenantMessages = lazy(() => import("./pages/tenant/Messages"));
const RequestRenewal = lazy(() => import("./pages/tenant/RequestRenewal"));
const TenantTerminationRequest = lazy(() => import("./pages/tenant/TerminationRequest"));
const ReportSidePayment = lazy(() => import("./pages/tenant/ReportSidePayment"));
const TenantReceipts = lazy(() => import("./pages/tenant/Receipts"));
const InviteLandlord = lazy(() => import("./pages/tenant/InviteLandlord"));

// Landlord pages
const LandlordDashboard = lazy(() => import("./pages/landlord/LandlordDashboard"));
const MyProperties = lazy(() => import("./pages/landlord/MyProperties"));
const RegisterProperty = lazy(() => import("./pages/landlord/RegisterProperty"));
const EditProperty = lazy(() => import("./pages/landlord/EditProperty"));
const RentIncreaseRequest = lazy(() => import("./pages/landlord/RentIncreaseRequest"));
const Agreements = lazy(() => import("./pages/landlord/Agreements"));
const AddTenant = lazy(() => import("./pages/landlord/AddTenant"));
const LandlordViewingRequests = lazy(() => import("./pages/landlord/ViewingRequests"));
const LandlordFeedback = lazy(() => import("./pages/landlord/LandlordFeedback"));
const LandlordMessages = lazy(() => import("./pages/landlord/Messages"));
const LandlordApplications = lazy(() => import("./pages/landlord/LandlordApplications"));
const LandlordComplaints = lazy(() => import("./pages/landlord/LandlordComplaints"));
const RentalApplications = lazy(() => import("./pages/landlord/RentalApplications"));
const DeclareExistingTenancy = lazy(() => import("./pages/landlord/DeclareExistingTenancy"));
const RenewalRequests = lazy(() => import("./pages/landlord/RenewalRequests"));
const LandlordTerminationRequest = lazy(() => import("./pages/landlord/TerminationRequest"));
const ManageRentCards = lazy(() => import("./pages/landlord/ManageRentCards"));
const LandlordPaymentSettings = lazy(() => import("./pages/landlord/PaymentSettings"));
const LandlordReceipts = lazy(() => import("./pages/landlord/Receipts"));
const InviteTenant = lazy(() => import("./pages/landlord/InviteTenant"));
const MyTenants = lazy(() => import("./pages/landlord/MyTenants"));

// Regulator pages
const RegulatorDashboard = lazy(() => import("./pages/regulator/RegulatorDashboard"));
const RegulatorTenants = lazy(() => import("./pages/regulator/RegulatorTenants"));
const RegulatorLandlords = lazy(() => import("./pages/regulator/RegulatorLandlords"));
const RegulatorProperties = lazy(() => import("./pages/regulator/RegulatorProperties"));
const RegulatorComplaints = lazy(() => import("./pages/regulator/RegulatorComplaints"));
const RegulatorAgreements = lazy(() => import("./pages/regulator/RegulatorAgreements"));
const RegulatorAgreementTemplates = lazy(() => import("./pages/regulator/RegulatorAgreementTemplates"));
const RegulatorAnalytics = lazy(() => import("./pages/regulator/RegulatorAnalytics"));
const InviteStaff = lazy(() => import("./pages/regulator/InviteStaff"));
const RegulatorKyc = lazy(() => import("./pages/regulator/RegulatorKyc"));
const RegulatorFeedback = lazy(() => import("./pages/regulator/RegulatorFeedback"));
const RegulatorSupportChats = lazy(() => import("./pages/regulator/RegulatorSupportChats"));
const AgencyApiKeys = lazy(() => import("./pages/regulator/AgencyApiKeys"));
const EngineRoom = lazy(() => import("./pages/regulator/EngineRoom"));
const RegulatorRentAssessments = lazy(() => import("./pages/regulator/RegulatorRentAssessments"));
const RegulatorApplications = lazy(() => import("./pages/regulator/RegulatorApplications"));
const RegulatorTerminations = lazy(() => import("./pages/regulator/RegulatorTerminations"));
const EscrowDashboard = lazy(() => import("./pages/regulator/EscrowDashboard"));
const RegulatorRentCards = lazy(() => import("./pages/regulator/RegulatorRentCards"));
const SmsBroadcast = lazy(() => import("./pages/regulator/SmsBroadcast"));
const RegulatorRentReviews = lazy(() => import("./pages/regulator/RegulatorRentReviews"));
const OfficeFundRequests = lazy(() => import("./pages/regulator/OfficeFundRequests"));
const OfficePayoutSettings = lazy(() => import("./pages/regulator/OfficePayoutSettings"));
const PaymentErrors = lazy(() => import("./pages/regulator/PaymentErrors"));
const SuperAdminDashboard = lazy(() => import("./pages/regulator/SuperAdminDashboard"));
const RegulatorReceipts = lazy(() => import("./pages/regulator/RegulatorReceipts"));

// NUGS pages (hidden monitoring portal)
const NugsDashboard = lazy(() => import("./pages/nugs/NugsDashboard"));
const NugsStudents = lazy(() => import("./pages/nugs/NugsStudents"));
const NugsComplaints = lazy(() => import("./pages/nugs/NugsComplaints"));
const NugsInstitutions = lazy(() => import("./pages/nugs/NugsInstitutions"));
const NugsMyComplaints = lazy(() => import("./pages/nugs/NugsMyComplaints"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const PageLoader = () => <LogoLoader message="Loading..." />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RoleSelect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register/tenant" element={<RegisterTenant />} />
              <Route path="/register/landlord" element={<RegisterLandlord />} />
              <Route path="/regulator/login" element={<RegulatorLogin />} />
              <Route path="/verify/:role/:id" element={<VerifyRegistration />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/verify-tenancy/:tenancyId" element={<VerifyTenancy />} />
              <Route path="/verify/rent-card/:token" element={<VerifyRentCard />} />
              <Route path="/verify/receipt/:receiptNumber" element={<VerifyReceipt />} />

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
                <Route path="preferences" element={<TenantPreferences />} />
                <Route path="messages" element={<TenantMessages />} />
                <Route path="renewal" element={<RequestRenewal />} />
                <Route path="termination" element={<TenantTerminationRequest />} />
                <Route path="report-side-payment" element={<ReportSidePayment />} />
                <Route path="receipts" element={<TenantReceipts />} />
                <Route path="invite-landlord" element={<InviteLandlord />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              {/* Landlord Routes */}
              <Route path="/landlord" element={<ProtectedRoute requiredRole="landlord"><LandlordLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<LandlordDashboard />} />
                <Route path="my-properties" element={<MyProperties />} />
                <Route path="my-tenants" element={<MyTenants />} />
                <Route path="register-property" element={<ErrorBoundary section="Register Property Page"><RegisterProperty /></ErrorBoundary>} />
                <Route path="edit-property/:id" element={<EditProperty />} />
                <Route path="agreements" element={<Agreements />} />
                <Route path="add-tenant" element={<AddTenant />} />
                <Route path="declare-existing-tenancy" element={<DeclareExistingTenancy />} />
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
                <Route path="invite-tenant" element={<InviteTenant />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="feedback" element={<LandlordFeedback />} />
                <Route path="rent-increase-request" element={<RentIncreaseRequest />} />
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
                <Route path="engine-room" element={<ErrorBoundary section="Engine Room"><EngineRoom /></ErrorBoundary>} />
                <Route path="super-admin" element={<ErrorBoundary section="Super Admin Dashboard"><SuperAdminDashboard /></ErrorBoundary>} />
                <Route path="rent-assessments" element={<RegulatorRentAssessments />} />
                <Route path="terminations" element={<RegulatorTerminations />} />
                <Route path="rent-cards" element={<RegulatorRentCards />} />
                <Route path="sms-broadcast" element={<SmsBroadcast />} />
                <Route path="rent-reviews" element={<RegulatorRentReviews />} />
                <Route path="office-fund-requests" element={<OfficeFundRequests />} />
                <Route path="office-payout-settings" element={<OfficePayoutSettings />} />
                <Route path="payment-errors" element={<PaymentErrors />} />
                <Route path="receipts" element={<RegulatorReceipts />} />
              </Route>

              {/* NUGS Admin Routes — hidden monitoring portal */}
              <Route path="/nugs" element={<ProtectedRoute requiredRole="nugs_admin" allowStudent><NugsLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<NugsDashboard />} />
                <Route path="students" element={<NugsStudents />} />
                <Route path="complaints" element={<NugsComplaints />} />
                <Route path="institutions" element={<NugsInstitutions />} />
                <Route path="my-complaints" element={<NugsMyComplaints />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="file-complaint" element={<FileComplaint />} />
                <Route path="profile" element={<ProfilePage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

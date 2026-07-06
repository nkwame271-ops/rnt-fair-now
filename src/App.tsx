import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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
const VerifyForm = lazy(() => import("./pages/shared/VerifyForm"));
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));
const PaymentConfirm = lazy(() => import("./pages/shared/PaymentConfirm"));

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
const LandlordManagementSupport = lazy(() => import("./pages/landlord/LandlordManagementSupport"));
const RegulatorPropertyManagement = lazy(() => import("./pages/regulator/RegulatorPropertyManagement"));
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
const AdminFileComplaint = lazy(() => import("./pages/regulator/AdminFileComplaint"));
const ComplaintsCommandCenter = lazy(() => import("./pages/regulator/ComplaintsCommandCenter"));
const ComplaintWizard = lazy(() => import("./pages/regulator/ComplaintWizard"));
const ComplaintCaseFile = lazy(() => import("./pages/regulator/ComplaintCaseFile"));
const HearingWorkspace = lazy(() => import("./pages/regulator/HearingWorkspace"));
const ComplaintDocumentEditor = lazy(() => import("./pages/regulator/ComplaintDocumentEditor"));
const HearingSchedule = lazy(() => import("./pages/regulator/HearingSchedule"));
const FormEngine = lazy(() => import("./pages/regulator/FormEngine"));
const FormTemplateEditor = lazy(() => import("./pages/regulator/FormTemplateEditor"));
const FormFill = lazy(() => import("./pages/regulator/FormFill"));
const RegulatorAgreements = lazy(() => import("./pages/regulator/RegulatorAgreements"));
const RegulatorAgreementTemplates = lazy(() => import("./pages/regulator/RegulatorAgreementTemplates"));
const RegulatorAnalytics = lazy(() => import("./pages/regulator/RegulatorAnalytics"));
const InviteStaff = lazy(() => import("./pages/regulator/InviteStaff"));
const RegulatorKyc = lazy(() => import("./pages/regulator/RegulatorKyc"));
const RegulatorFeedback = lazy(() => import("./pages/regulator/RegulatorFeedback"));
const RegulatorSupportChats = lazy(() => import("./pages/regulator/RegulatorSupportChats"));
const AgencyApiKeys = lazy(() => import("./pages/regulator/AgencyApiKeys"));
const ApiAccessRequests = lazy(() => import("./pages/regulator/ApiAccessRequests"));
const DeveloperAccounts = lazy(() => import("./pages/regulator/DeveloperAccounts"));
const PublicApiDocs = lazy(() => import("./pages/developers/ApiDocs"));
const PublicApiPricing = lazy(() => import("./pages/developers/ApiPricing"));
const DevelopersLanding = lazy(() => import("./pages/developers/Landing"));
const DeveloperSignup = lazy(() => import("./pages/developers/Signup"));
const DeveloperLogin = lazy(() => import("./pages/developers/Login"));
const DeveloperDashboardLayout = lazy(() => import("./pages/developers/dashboard/DashboardLayout"));
const DeveloperOverview = lazy(() => import("./pages/developers/dashboard/Overview"));
const DeveloperKeys = lazy(() => import("./pages/developers/dashboard/Keys"));
const DeveloperSandbox = lazy(() => import("./pages/developers/dashboard/Sandbox"));
const DeveloperWebhooks = lazy(() => import("./pages/developers/dashboard/Webhooks"));
const DeveloperUsage = lazy(() => import("./pages/developers/dashboard/Usage"));
const DeveloperBilling = lazy(() => import("./pages/developers/dashboard/Billing"));
const DeveloperDocsPage = lazy(() => import("./pages/developers/dashboard/Docs"));
const DeveloperSettings = lazy(() => import("./pages/developers/dashboard/Settings"));
const DeveloperRequestStatus = lazy(() => import("./pages/developers/dashboard/RequestStatus"));
const RequestAccess = lazy(() => import("./pages/developers/RequestAccess"));
const DeveloperRoute = lazy(() => import("./components/developers/DeveloperRoute"));
// Public docs site
const DocsIntroduction = lazy(() => import("./pages/developers/docs/Introduction"));
const DocsQuickstart = lazy(() => import("./pages/developers/docs/Quickstart"));
const DocsAuth = lazy(() => import("./pages/developers/docs/Auth"));
const DocsEnvironments = lazy(() => import("./pages/developers/docs/Environments"));
const DocsRateLimits = lazy(() => import("./pages/developers/docs/RateLimits"));
const DocsErrors = lazy(() => import("./pages/developers/docs/Errors"));
const DocsTutVerifyLandlord = lazy(() => import("./pages/developers/docs/tutorials/VerifyLandlord"));
const DocsTutCheckTenancy = lazy(() => import("./pages/developers/docs/tutorials/CheckTenancy"));
const DocsTutLookupProperty = lazy(() => import("./pages/developers/docs/tutorials/LookupProperty"));
const DocsTutWebhooks = lazy(() => import("./pages/developers/docs/tutorials/Webhooks"));
const DocsTutPagination = lazy(() => import("./pages/developers/docs/tutorials/Pagination"));
const DocsTutRetries = lazy(() => import("./pages/developers/docs/tutorials/Retries"));
const DocsRefLandlords = lazy(() => import("./pages/developers/docs/reference/Landlords"));
const DocsRefTenants = lazy(() => import("./pages/developers/docs/reference/Tenants"));
const DocsRefProperties = lazy(() => import("./pages/developers/docs/reference/Properties"));
const DocsRefComplaints = lazy(() => import("./pages/developers/docs/reference/Complaints"));
const DocsRefWebhookEvents = lazy(() => import("./pages/developers/docs/reference/WebhookEvents"));
const DocsGoLive = lazy(() => import("./pages/developers/docs/GoLive"));
const DocsDSA = lazy(() => import("./pages/developers/docs/DSA"));
const DocsPricing = lazy(() => import("./pages/developers/docs/Pricing"));
const DocsSupport = lazy(() => import("./pages/developers/docs/Support"));
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
const SuperAdminBackups = lazy(() => import("./pages/super-admin/Backups"));
const ResolutionCentre = lazy(() => import("./pages/regulator/ResolutionCentre"));
const PaymentReconciliationCentre = lazy(() => import("./pages/regulator/PaymentReconciliationCentre"));
const StudentRevenue = lazy(() => import("./pages/regulator/StudentRevenue"));
const EscalatedStudentComplaints = lazy(() => import("./pages/regulator/EscalatedStudentComplaints"));
const RegulatorReceipts = lazy(() => import("./pages/regulator/RegulatorReceipts"));
const ProcessorReconciliation = lazy(() => import("./pages/regulator/ProcessorReconciliation"));
const SafetyEmergencyReports = lazy(() => import("./pages/regulator/SafetyEmergencyReports"));
const SafetyReportDetail = lazy(() => import("./pages/regulator/SafetyReportDetail"));
const SafetyContacts = lazy(() => import("./pages/regulator/SafetyContacts"));

// Shared safety pages per portal
const TenantReportSafety = lazy(() => import("./pages/tenant/ReportSafety"));
const LandlordReportSafety = lazy(() => import("./pages/landlord/ReportSafety"));
const NugsReportSafety = lazy(() => import("./pages/nugs/ReportSafety"));
const MySafetyReports = lazy(() => import("./pages/shared/MySafetyReports"));
const ReportMissingPayment = lazy(() => import("./pages/shared/ReportMissingPayment"));

// NUGS pages (hidden monitoring portal)
const NugsDashboard = lazy(() => import("./pages/nugs/NugsDashboard"));
const NugsStudents = lazy(() => import("./pages/nugs/NugsStudents"));
const NugsComplaints = lazy(() => import("./pages/nugs/NugsComplaints"));
const NugsInstitutions = lazy(() => import("./pages/nugs/NugsInstitutions"));
const NugsMyComplaints = lazy(() => import("./pages/nugs/NugsMyComplaints"));
const NugsRentCards = lazy(() => import("./pages/nugs/NugsRentCards"));
const StudentRentCare = lazy(() => import("./pages/student/RentCare"));
const StudentRentCareApply = lazy(() => import("./pages/student/RentCareApply"));
const StudentRentCareDetail = lazy(() => import("./pages/student/RentCareDetail"));
const RentCareManagement = lazy(() => import("./pages/regulator/RentCareManagement"));
const AccessControlConsole = lazy(() => import("./pages/regulator/AccessControlConsole"));
const StaffFeatureMutes = lazy(() => import("./pages/regulator/StaffFeatureMutes"));

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
        <Toaster />
        <BrowserRouter>
          <BrandedCheckoutHost />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RoleSelect />} />
              <Route path="/payments/confirm" element={<PaymentConfirm />} />
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
              <Route path="/verify/form/:code" element={<VerifyForm />} />
              <Route path="/developers/api" element={<PublicApiDocs />} />
              <Route path="/developers/api/pricing" element={<PublicApiPricing />} />
              <Route path="/developers" element={<DevelopersLanding />} />
              <Route path="/developers/signup" element={<DeveloperSignup />} />
              <Route path="/developers/login" element={<DeveloperLogin />} />
              {/* Public step-by-step docs */}
              <Route path="/developers/docs" element={<DocsIntroduction />} />
              <Route path="/developers/docs/quickstart" element={<DocsQuickstart />} />
              <Route path="/developers/docs/auth" element={<DocsAuth />} />
              <Route path="/developers/docs/environments" element={<DocsEnvironments />} />
              <Route path="/developers/docs/rate-limits" element={<DocsRateLimits />} />
              <Route path="/developers/docs/errors" element={<DocsErrors />} />
              <Route path="/developers/docs/tutorials/verify-landlord" element={<DocsTutVerifyLandlord />} />
              <Route path="/developers/docs/tutorials/check-tenancy" element={<DocsTutCheckTenancy />} />
              <Route path="/developers/docs/tutorials/lookup-property" element={<DocsTutLookupProperty />} />
              <Route path="/developers/docs/tutorials/webhooks" element={<DocsTutWebhooks />} />
              <Route path="/developers/docs/tutorials/pagination" element={<DocsTutPagination />} />
              <Route path="/developers/docs/tutorials/retries" element={<DocsTutRetries />} />
              <Route path="/developers/docs/reference/landlords" element={<DocsRefLandlords />} />
              <Route path="/developers/docs/reference/tenants" element={<DocsRefTenants />} />
              <Route path="/developers/docs/reference/properties" element={<DocsRefProperties />} />
              <Route path="/developers/docs/reference/complaints" element={<DocsRefComplaints />} />
              <Route path="/developers/docs/reference/webhooks" element={<DocsRefWebhookEvents />} />
              <Route path="/developers/docs/go-live" element={<DocsGoLive />} />
              <Route path="/developers/docs/dsa" element={<DocsDSA />} />
              <Route path="/developers/docs/pricing" element={<DocsPricing />} />
              <Route path="/developers/docs/support" element={<DocsSupport />} />
              <Route path="/developers/request-access" element={<DeveloperRoute><RequestAccess /></DeveloperRoute>} />
              <Route path="/developers/dashboard" element={<DeveloperRoute><DeveloperDashboardLayout /></DeveloperRoute>}>
                <Route index element={<DeveloperOverview />} />
                <Route path="keys" element={<DeveloperKeys />} />
                <Route path="request-status" element={<DeveloperRequestStatus />} />
                <Route path="sandbox" element={<DeveloperSandbox />} />
                <Route path="webhooks" element={<DeveloperWebhooks />} />
                <Route path="usage" element={<DeveloperUsage />} />
                <Route path="billing" element={<DeveloperBilling />} />
                <Route path="docs" element={<DeveloperDocsPage />} />
                <Route path="settings" element={<DeveloperSettings />} />
              </Route>


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
                <Route path="report-safety" element={<TenantReportSafety />} />
                <Route path="my-safety-reports" element={<MySafetyReports />} />
                <Route path="report-missing-payment" element={<ReportMissingPayment />} />
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
                <Route path="report-safety" element={<LandlordReportSafety />} />
                <Route path="my-safety-reports" element={<MySafetyReports />} />
                <Route path="report-missing-payment" element={<ReportMissingPayment />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="feedback" element={<LandlordFeedback />} />
                <Route path="rent-increase-request" element={<RentIncreaseRequest />} />
                <Route path="management-support" element={<LandlordManagementSupport />} />
              </Route>

              {/* Regulator Routes */}
              <Route path="/regulator" element={<ProtectedRoute requiredRole="regulator"><RegulatorLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<RegulatorDashboard />} />
                <Route path="tenants" element={<RegulatorTenants />} />
                <Route path="landlords" element={<RegulatorLandlords />} />
                <Route path="properties" element={<RegulatorProperties />} />
                <Route path="complaints" element={<RegulatorComplaints />} />
                <Route path="complaints/command-center" element={<ComplaintsCommandCenter />} />
                <Route path="complaints/schedule" element={<HearingSchedule />} />
                <Route path="complaints/new" element={<ComplaintWizard />} />
                <Route path="complaints/new-simple" element={<AdminFileComplaint />} />
                <Route path="complaints/:id" element={<ComplaintCaseFile />} />
                <Route path="complaints/:id/hearing/:hid" element={<HearingWorkspace />} />
                <Route path="complaints/:id/documents/new" element={<ComplaintDocumentEditor />} />
                <Route path="complaints/:id/documents/:docId" element={<ComplaintDocumentEditor />} />
                <Route path="form-engine" element={<FormEngine />} />
                <Route path="form-engine/:id" element={<FormTemplateEditor />} />
                <Route path="form-engine/:id/fill" element={<FormFill />} />
                <Route path="escalated-student-complaints" element={<ErrorBoundary section="Escalated Student Complaints"><EscalatedStudentComplaints /></ErrorBoundary>} />
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
                <Route path="api-access-requests" element={<ApiAccessRequests />} />
                <Route path="developer-accounts" element={<DeveloperAccounts />} />
                <Route path="engine-room" element={<ErrorBoundary section="Engine Room"><EngineRoom /></ErrorBoundary>} />
                <Route path="rentcare" element={<ErrorBoundary section="RentCare Management"><RentCareManagement /></ErrorBoundary>} />
                <Route path="super-admin" element={<ErrorBoundary section="Super Admin Dashboard"><SuperAdminDashboard /></ErrorBoundary>} />
                <Route path="backups" element={<ErrorBoundary section="System Backups"><SuperAdminBackups /></ErrorBoundary>} />
                <Route path="resolution-centre" element={<ErrorBoundary section="Resolution Centre"><ResolutionCentre /></ErrorBoundary>} />
                <Route path="access-control" element={<ErrorBoundary section="Access Control"><AccessControlConsole /></ErrorBoundary>} />
                <Route path="staff-feature-mutes" element={<ErrorBoundary section="Staff Feature Mutes"><StaffFeatureMutes /></ErrorBoundary>} />
                <Route path="payment-reconciliation" element={<ErrorBoundary section="Payment Reconciliation"><PaymentReconciliationCentre /></ErrorBoundary>} />
                <Route path="student-revenue" element={<ErrorBoundary section="Student Revenue"><StudentRevenue /></ErrorBoundary>} />
                <Route path="rent-assessments" element={<RegulatorRentAssessments />} />
                <Route path="terminations" element={<RegulatorTerminations />} />
                <Route path="rent-cards" element={<RegulatorRentCards />} />
                <Route path="sms-broadcast" element={<SmsBroadcast />} />
                <Route path="rent-reviews" element={<RegulatorRentReviews />} />
                <Route path="office-fund-requests" element={<OfficeFundRequests />} />
                <Route path="office-payout-settings" element={<OfficePayoutSettings />} />
                <Route path="payment-errors" element={<PaymentErrors />} />
                <Route path="property-management" element={<RegulatorPropertyManagement />} />
                <Route path="receipts" element={<RegulatorReceipts />} />
                <Route path="processor-reconciliation" element={<ErrorBoundary section="Processor Reconciliation"><ProcessorReconciliation /></ErrorBoundary>} />
                <Route path="safety" element={<SafetyEmergencyReports />} />
                <Route path="safety/contacts" element={<SafetyContacts />} />
                <Route path="safety/:id" element={<SafetyReportDetail />} />
              </Route>

              {/* NUGS Admin Routes — hidden monitoring portal */}
              <Route path="/nugs" element={<ProtectedRoute requiredRole="nugs_admin" allowStudent><NugsLayout /></ProtectedRoute>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<NugsDashboard />} />
                <Route path="students" element={<NugsStudents />} />
                <Route path="complaints" element={<NugsComplaints />} />
                <Route path="institutions" element={<NugsInstitutions />} />
                <Route path="my-complaints" element={<NugsMyComplaints />} />
                <Route path="rent-cards" element={<NugsRentCards />} />
                <Route path="marketplace" element={<Marketplace />} />
                <Route path="file-complaint" element={<FileComplaint />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="rent-checker" element={<RentChecker />} />
                <Route path="payments" element={<Payments />} />
                <Route path="receipts" element={<TenantReceipts />} />
                <Route path="my-agreements" element={<MyAgreements />} />
                <Route path="legal-assistant" element={<LegalAssistant />} />
                <Route path="renewal" element={<RequestRenewal />} />
                <Route path="termination" element={<TenantTerminationRequest />} />
                <Route path="report-side-payment" element={<ReportSidePayment />} />
                <Route path="preferences" element={<TenantPreferences />} />
                <Route path="messages" element={<TenantMessages />} />
                <Route path="invite-landlord" element={<InviteLandlord />} />
                <Route path="report-safety" element={<NugsReportSafety />} />
                <Route path="my-safety-reports" element={<MySafetyReports />} />
                <Route path="report-missing-payment" element={<ReportMissingPayment />} />
                <Route path="rentcare" element={<ErrorBoundary section="RentCare"><StudentRentCare /></ErrorBoundary>} />
                <Route path="rentcare/new" element={<ErrorBoundary section="RentCare Apply"><StudentRentCareApply /></ErrorBoundary>} />
                <Route path="rentcare/:id" element={<ErrorBoundary section="RentCare Detail"><StudentRentCareDetail /></ErrorBoundary>} />
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

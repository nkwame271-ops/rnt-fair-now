import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import RoleSelect from "./pages/RoleSelect";
import Login from "./pages/Login";
import TenantLayout from "./components/TenantLayout";
import TenantDashboard from "./pages/tenant/TenantDashboard";
import Marketplace from "./pages/tenant/Marketplace";
import RentChecker from "./pages/tenant/RentChecker";
import FileComplaint from "./pages/tenant/FileComplaint";
import MyCases from "./pages/tenant/MyCases";
import Payments from "./pages/tenant/Payments";
import LegalAssistant from "./pages/tenant/LegalAssistant";
import LandlordLayout from "./components/LandlordLayout";
import LandlordDashboard from "./pages/landlord/LandlordDashboard";
import MyProperties from "./pages/landlord/MyProperties";
import RegisterProperty from "./pages/landlord/RegisterProperty";
import Agreements from "./pages/landlord/Agreements";
import AddTenant from "./pages/landlord/AddTenant";
import MyAgreements from "./pages/tenant/MyAgreements";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleSelect />} />
          <Route path="/login" element={<Login />} />

          {/* Tenant Routes */}
          <Route path="/tenant" element={<TenantLayout />}>
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
          <Route path="/landlord" element={<LandlordLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<LandlordDashboard />} />
            <Route path="my-properties" element={<MyProperties />} />
            <Route path="register-property" element={<RegisterProperty />} />
            <Route path="agreements" element={<Agreements />} />
            <Route path="add-tenant" element={<AddTenant />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

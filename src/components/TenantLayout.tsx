import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Calculator,
  FileText,
  Briefcase,
  CreditCard,
  MessageSquare,
  MessageCircle,
  RefreshCw,
  LogOut,
  Shield,
  Menu,
  UserCircle,
  Bell,
  AlertTriangle,
  ShieldAlert,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureLabels } from "@/hooks/useFeatureLabel";
import TourGuide from "@/components/TourGuide";
import { tenantTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";
import CommandSearch from "@/components/CommandSearch";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";

const navItems = [
  { to: "/tenant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tenant/marketplace", label: "Marketplace", icon: Store, featureKey: "marketplace" },
  { to: "/tenant/rent-checker", label: "Rent Checker", icon: Calculator, featureKey: "rent_checker" },
  { to: "/tenant/file-complaint", label: "File Complaint", icon: FileText, featureKey: "complaint_filing" },
  { to: "/tenant/my-cases", label: "My Cases", icon: Briefcase, featureKey: "tenant_cases" },
  { to: "/tenant/payments", label: "Payments", icon: CreditCard, featureKey: "payments" },
  { to: "/tenant/receipts", label: "Receipts", icon: FileText, featureKey: "tenant_receipts" },
  { to: "/tenant/my-agreements", label: "Agreements", icon: FileText, featureKey: "tenant_agreements" },
  { to: "/tenant/legal-assistant", label: "Legal Assistant", icon: MessageSquare, featureKey: "legal_assistant" },
  { to: "/tenant/renewal", label: "Renewal", icon: RefreshCw, featureKey: "renewal" },
  { to: "/tenant/termination", label: "Termination", icon: AlertTriangle, featureKey: "termination" },
  { to: "/tenant/report-side-payment", label: "Report Side Payment", icon: ShieldAlert, featureKey: "report_side_payment" },
  { to: "/tenant/preferences", label: "Preferences", icon: Bell, featureKey: "preferences" },
  { to: "/tenant/messages", label: "Messages", icon: MessageCircle, featureKey: "tenant_messages" },
  { to: "/tenant/invite-landlord", label: "Invite Landlord", icon: UserPlus },
  { to: "/tenant/profile", label: "My Profile", icon: UserCircle },
];

const TenantLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { flags } = useAllFeatureFlags();
  const { getLabel } = useFeatureLabels("tenant");

  const filteredNav = navItems.filter((item) => {
    if (!item.featureKey) return true;
    const flag = flags.find((f) => f.feature_key === item.featureKey);
    if (!flag) return true; // no flag = always show
    return flag.is_enabled;
  });

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative`}
      >
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <Shield className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg">Rent Control</span>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {getLabel(item.featureKey || item.label, item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm lg:hidden">Rent Control</span>
          <div className="flex-1 flex justify-center max-w-md mx-4">
            <CommandSearch items={filteredNav} />
          </div>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
         <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-16">
          <Outlet />
        </main>
        <footer className="border-t border-border bg-card px-4 py-2 flex items-center justify-center gap-2">
          <img src="/cfled-logo.png" alt="CFLED" className="h-5 w-auto opacity-60" />
          <span className="text-muted-foreground text-[10px]">Designed by Center for Financial Literacy, E-Commerce and Digitalization</span>
        </footer>
      </div>
      <TourGuide steps={tenantTourSteps} storageKey="tour_tenant_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default TenantLayout;

import { useNavigate } from "react-router-dom";
import AnimatedNavLink from "@/components/AnimatedNavLink";
import AnimatedOutlet from "@/components/AnimatedOutlet";
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
    <div data-app-shell className="min-h-screen flex bg-transparent">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 glass-sidebar text-sidebar-foreground flex flex-col transition-transform md:translate-x-0 md:m-3 md:rounded-2xl md:inset-y-auto md:h-[calc(100vh-1.5rem)] max-md:w-0 max-md:overflow-hidden ${
          mobileOpen ? "max-md:!w-60 max-md:!overflow-visible translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 overflow-hidden`}
      >
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border/50">
          <Shield className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold text-sm">Rent Control</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => (
            <AnimatedNavLink
              key={item.to}
              to={item.to}
              layoutId="tenant-nav-pill"
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{getLabel(item.featureKey || item.label, item.label)}</span>
            </AnimatedNavLink>
          ))}
        </nav>
        <div className="p-2 border-t border-sidebar-border/50">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 ml-0 w-full">
        <header className="h-14 glass-header flex items-center px-3 sm:px-4 gap-2">
          <button onClick={() => setMobileOpen(true)} className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm hidden sm:inline md:hidden">Rent Control</span>
          <div className="flex-1 min-w-0">
            <CommandSearch items={filteredNav} />
          </div>
          <div className="shrink-0">
            <NotificationBell />
          </div>
        </header>
         <main data-app-main className="flex-1 px-3 sm:px-5 py-4 md:px-7 md:py-6 lg:px-10 lg:py-8 overflow-y-auto overflow-x-hidden pb-16 bg-transparent">
          <div className="mx-auto w-full max-w-[1400px]">
            <AnimatedOutlet />
          </div>
        </main>
        <footer className="border-t border-white/30 bg-transparent px-4 py-2 flex items-center justify-center gap-2">
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

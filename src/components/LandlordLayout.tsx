import { useNavigate } from "react-router-dom";
import AnimatedNavLink from "@/components/AnimatedNavLink";
import AnimatedOutlet from "@/components/AnimatedOutlet";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  FileCheck,
  FileText,
  LogOut,
  Shield,
  Menu,
  Eye,
  UserCircle,
  MessageSquare,
  MessageCircle,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  Gavel,
  CreditCard,
  Wallet,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureLabels } from "@/hooks/useFeatureLabel";
import TourGuide from "@/components/TourGuide";
import { landlordTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";
import CommandSearch from "@/components/CommandSearch";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";

const navItems = [
  { to: "/landlord/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/landlord/my-properties", label: "My Properties", icon: Building2 },
  { to: "/landlord/my-tenants", label: "My Tenants", icon: UserCircle },
  { to: "/landlord/register-property", label: "Register Property", icon: PlusCircle, featureKey: "register_property" },
  { to: "/landlord/add-tenant", label: "Add Tenant", icon: PlusCircle, featureKey: "add_tenant" },
  { to: "/landlord/declare-existing-tenancy", label: "Existing Tenancy", icon: FileCheck, featureKey: "declare_existing_tenancy" },
  { to: "/landlord/agreements", label: "Agreements", icon: FileCheck, featureKey: "agreements" },
  { to: "/landlord/applications", label: "Applications", icon: ClipboardList, featureKey: "landlord_applications" },
  { to: "/landlord/complaints", label: "Complaints", icon: AlertTriangle, featureKey: "landlord_complaints" },
  { to: "/landlord/viewing-requests", label: "Viewing Requests", icon: Eye, featureKey: "viewing_requests" },
  { to: "/landlord/rental-applications", label: "Rental Applications", icon: FileText, featureKey: "rental_applications" },
  { to: "/landlord/renewal-requests", label: "Renewal Requests", icon: RefreshCw, featureKey: "renewal_requests" },
  { to: "/landlord/termination", label: "Ejection Application", icon: Gavel, featureKey: "landlord_ejection" },
  { to: "/landlord/messages", label: "Messages", icon: MessageCircle, featureKey: "landlord_messages" },
  { to: "/landlord/rent-cards", label: "Manage Rent Cards", icon: Wallet, featureKey: "rent_cards" },
  { to: "/landlord/payment-settings", label: "Payment Settings", icon: CreditCard, featureKey: "payment_settings" },
  { to: "/landlord/receipts", label: "Receipts", icon: FileText, featureKey: "landlord_receipts" },
  { to: "/landlord/invite-tenant", label: "Invite Tenant", icon: UserPlus },
  { to: "/landlord/profile", label: "My Profile", icon: UserCircle },
  { to: "/landlord/rent-increase-request", label: "Rent Increase", icon: Wallet, featureKey: "rent_increase" },
  { to: "/landlord/feedback", label: "Beta Feedback", icon: MessageSquare, featureKey: "landlord_feedback" },
];

const LandlordLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { flags } = useAllFeatureFlags();
  const { getLabel } = useFeatureLabels("landlord");

  const filteredNav = navItems.filter((item) => {
    if (!item.featureKey) return true;
    const flag = flags.find((f) => f.feature_key === item.featureKey);
    if (!flag) return true;
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
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-accent-foreground font-semibold ml-auto">
            LANDLORD
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {filteredNav.map((item) => (
            <AnimatedNavLink
              key={item.to}
              to={item.to}
              layoutId="landlord-nav-pill"
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 glass-header flex items-center px-3 sm:px-4 gap-2">
          <button onClick={() => setMobileOpen(true)} className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm hidden sm:inline md:hidden truncate">Landlord</span>
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
      <TourGuide steps={landlordTourSteps} storageKey="tour_landlord_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default LandlordLayout;

import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import TourGuide from "@/components/TourGuide";
import { landlordTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";

const navItems = [
  { to: "/landlord/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/landlord/my-properties", label: "My Properties", icon: Building2 },
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
  { to: "/landlord/profile", label: "My Profile", icon: UserCircle },
  { to: "/landlord/feedback", label: "Beta Feedback", icon: MessageSquare, featureKey: "landlord_feedback" },
];

const LandlordLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { flags } = useAllFeatureFlags();

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
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative`}
      >
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <Shield className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg">Rent Control</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sidebar-primary text-sidebar-primary-foreground font-semibold ml-auto">
            LANDLORD
          </span>
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
              {item.label}
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
          <span className="font-bold text-sm lg:hidden">Rent Control — Landlord</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
         <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto pb-16">
          <Outlet />
        </main>
        <footer className="border-t border-border bg-card px-4 py-2 flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-[10px]">Powered by</span>
          <img src="/cfled-logo.png" alt="CFLED" className="h-5 w-auto opacity-60" />
          <span className="text-muted-foreground text-[10px]">Center for Financial Literacy, E-Commerce & Digitalization</span>
        </footer>
      </div>
      <TourGuide steps={landlordTourSteps} storageKey="tour_landlord_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default LandlordLayout;

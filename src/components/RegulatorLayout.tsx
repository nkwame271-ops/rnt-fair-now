import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  BarChart3,
  LogOut,
  Shield,
  Menu,
  AlertTriangle,
  UserPlus,
  IdCard,
  MessageSquare,
  Settings,
  TrendingUp,
  ClipboardList,
  Gavel,
  Send,
  Crown,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile, getFeatureKeyForRoute } from "@/hooks/useAdminProfile";
import { useFeatureLabels } from "@/hooks/useFeatureLabel";
import TourGuide from "@/components/TourGuide";
import { regulatorTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";
import CommandSearch from "@/components/CommandSearch";

const allNavItems = [
  { to: "/regulator/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/regulator/tenants", label: "Tenants", icon: Users },
  { to: "/regulator/landlords", label: "Landlords", icon: Building2 },
  { to: "/regulator/properties", label: "Properties", icon: Building2 },
  { to: "/regulator/complaints", label: "Complaints", icon: AlertTriangle },
  { to: "/regulator/applications", label: "Applications", icon: ClipboardList },
  { to: "/regulator/agreements", label: "Agreements", icon: FileText },
  { to: "/regulator/agreement-templates", label: "Templates", icon: FileText },
  { to: "/regulator/rent-assessments", label: "Rent Assessments", icon: TrendingUp },
  { to: "/regulator/rent-reviews", label: "Rent Reviews", icon: TrendingUp },
  { to: "/regulator/terminations", label: "Terminations", icon: Gavel },
  { to: "/regulator/rent-cards", label: "Rent Cards", icon: IdCard },
  { to: "/regulator/escrow", label: "Escrow & Revenue", icon: BarChart3 },
  { to: "/regulator/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/regulator/kyc", label: "KYC Verification", icon: IdCard },
  { to: "/regulator/engine-room", label: "Engine Room", icon: Settings },
  { to: "/regulator/invite-staff", label: "Invite Staff", icon: UserPlus },
  { to: "/regulator/feedback", label: "Beta Feedback", icon: MessageSquare },
  { to: "/regulator/support-chats", label: "Support Chats", icon: MessageSquare },
  { to: "/regulator/sms-broadcast", label: "SMS Broadcast", icon: Send },
  { to: "/regulator/api-keys", label: "Agency APIs", icon: Shield },
  { to: "/regulator/office-fund-requests", label: "Office Wallet", icon: BarChart3 },
  { to: "/regulator/office-payout-settings", label: "Payout Settings", icon: Settings },
  { to: "/regulator/payment-errors", label: "Payment Errors", icon: AlertTriangle },
  { to: "/regulator/super-admin", label: "Super Admin", icon: Crown, superAdminOnly: true },
];

const RegulatorLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile } = useAdminProfile();
  const { getLabel } = useFeatureLabels("admin");
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Filter nav items based on admin profile
  const navItems = allNavItems.filter(item => {
    // Super Admin Only items
    if ((item as any).superAdminOnly && !profile?.isSuperAdmin) return false;

    // Main admin or no profile record (legacy/fallback) — show all
    if (!profile) return true;
    if (profile.allowedFeatures.length === 0) return true; // unrestricted admin

    // Sub admin — only show allowed features that aren't muted
    const featureKey = getFeatureKeyForRoute(item.to);
    if (!featureKey) return true; // unknown routes stay visible
    const isAllowed = profile.allowedFeatures.includes(featureKey);
    const isMuted = profile.mutedFeatures.includes(featureKey);
    return isAllowed && !isMuted;
  });

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
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ml-auto ${profile?.isSuperAdmin ? "bg-destructive text-destructive-foreground" : "bg-destructive text-destructive-foreground"}`}>
            {profile?.isSuperAdmin ? "SUPER ADMIN" : profile?.isMainAdmin ? "ADMIN" : profile ? "STAFF" : "ADMIN"}
          </span>
        </div>
        {profile && !profile.isMainAdmin && profile.officeName && (
          <div className="px-5 py-2 border-b border-sidebar-border">
            <p className="text-[10px] uppercase text-sidebar-foreground/50 font-semibold tracking-wider">Office</p>
            <p className="text-xs text-sidebar-foreground/80 truncate">{profile.officeName}</p>
          </div>
        )}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
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
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm lg:hidden">Rent Control — Admin</span>
          <div className="flex-1 flex justify-center max-w-md mx-4">
            <CommandSearch items={navItems} />
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
      <TourGuide steps={regulatorTourSteps} storageKey="tour_regulator_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default RegulatorLayout;

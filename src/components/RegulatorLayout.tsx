import { NavLink, useNavigate } from "react-router-dom";
import AnimatedNavLink from "@/components/AnimatedNavLink";
import AnimatedOutlet from "@/components/AnimatedOutlet";
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
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAdminProfile, getFeatureKeyForRoute } from "@/hooks/useAdminProfile";
import { useFeatureLabels } from "@/hooks/useFeatureLabel";
import TourGuide from "@/components/TourGuide";
import { regulatorTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";
import CommandSearch from "@/components/CommandSearch";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { supabase } from "@/integrations/supabase/client";

// Routes whose first 25 rows we warm on hover.
const PREFETCH_MAP: Record<string, { key: string; fetcher: () => Promise<unknown> }> = {
  "/regulator/tenants": {
    key: "prefetch:tenants",
    fetcher: async () =>
      (await supabase.from("tenants").select("tenant_id, user_id, status, account_status, registration_date, expiry_date").order("created_at", { ascending: false }).range(0, 24)).data,
  },
  "/regulator/landlords": {
    key: "prefetch:landlords",
    fetcher: async () =>
      (await supabase.from("landlords").select("landlord_id, user_id, status, account_status, registration_date, expiry_date").order("created_at", { ascending: false }).range(0, 24)).data,
  },
  "/regulator/properties": {
    key: "prefetch:properties",
    fetcher: async () =>
      (await supabase.from("properties").select("id, property_code, property_name, address, region, area, property_status").order("created_at", { ascending: false }).range(0, 24)).data,
  },
  "/regulator/complaints": {
    key: "prefetch:complaints",
    fetcher: async () =>
      (await supabase.from("complaints").select("id, complaint_code, complaint_type, status, payment_status, tenant_user_id, created_at, office_id").order("created_at", { ascending: false }).range(0, 24)).data,
  },
  "/regulator/agreements": {
    key: "prefetch:agreements",
    fetcher: async () =>
      (await supabase.from("tenancies").select("id, registration_code, status, agreed_rent, start_date, end_date, tenant_user_id, landlord_user_id, unit_id").order("created_at", { ascending: false }).range(0, 24)).data,
  },
  "/regulator/escrow": {
    key: "prefetch:escrow",
    fetcher: async () =>
      (await supabase.from("escrow_transactions").select("id, total_amount, status, payment_type, created_at").order("created_at", { ascending: false }).range(0, 24)).data,
  },
};

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
  { to: "/regulator/receipts", label: "Receipts", icon: FileText },
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
  const queryClient = useQueryClient();
  useActivityTracker();

  const handlePrefetch = (route: string) => {
    const entry = PREFETCH_MAP[route];
    if (!entry) return;
    queryClient.prefetchQuery({
      queryKey: [entry.key],
      queryFn: entry.fetcher,
      staleTime: 5 * 60 * 1000,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Filter nav items based on admin profile
  const navItems = allNavItems.filter(item => {
    // Super Admin Only items
    if ((item as any).superAdminOnly && !profile?.isSuperAdmin) return false;
    // Super admin sees everything
    if (profile?.isSuperAdmin) return true;
    // Main admin or no profile record (legacy/fallback) — show all
    if (!profile || profile.isMainAdmin) return true;
    if (profile.allowedFeatures.length === 0) return true; // unrestricted admin

    // Sub admin — only show allowed features that aren't muted
    const featureKey = getFeatureKeyForRoute(item.to);
    if (!featureKey) return true;
    const isAllowed = profile.allowedFeatures.includes(featureKey);
    const isMuted = profile.mutedFeatures.includes(featureKey);
    return isAllowed && !isMuted;
  });

  return (
    <div data-app-shell className="min-h-screen flex bg-transparent">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 md:w-60 glass-sidebar text-sidebar-foreground flex flex-col transition-transform md:translate-x-0 md:m-3 md:rounded-2xl md:inset-y-auto md:h-[calc(100vh-1.5rem)] max-md:w-0 max-md:overflow-hidden ${
          mobileOpen ? "max-md:!w-60 max-md:!overflow-visible translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 overflow-hidden`}
      >
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border/50">
          <Shield className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold text-sm">Rent Control</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ml-auto ${profile?.isSuperAdmin ? "bg-secondary text-secondary-foreground" : "bg-sidebar-accent text-sidebar-accent-foreground"}`}>
            {profile?.isSuperAdmin ? "SUPER" : profile?.isMainAdmin ? "ADMIN" : profile ? "STAFF" : "ADMIN"}
          </span>
        </div>
        {profile && !profile.isMainAdmin && profile.officeName && (
          <div className="px-4 py-2 border-b border-sidebar-border/50">
            <p className="text-[9px] uppercase text-sidebar-foreground/50 font-semibold tracking-wider">Office</p>
            <p className="text-[11px] text-sidebar-foreground/80 truncate">{profile.officeName}</p>
          </div>
        )}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <AnimatedNavLink
              key={item.to}
              to={item.to}
              layoutId="regulator-nav-pill"
              onClick={() => setMobileOpen(false)}
              onMouseEnter={() => handlePrefetch(item.to)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{getLabel(getFeatureKeyForRoute(item.to) || item.label, item.label)}</span>
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
        <div className="fixed inset-0 z-40 bg-foreground/30 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 glass-header flex items-center px-3 sm:px-4 gap-2">
          <button onClick={() => setMobileOpen(true)} className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <CommandSearch items={navItems} />
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
      <TourGuide steps={regulatorTourSteps} storageKey="tour_regulator_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default RegulatorLayout;

import { useNavigate } from "react-router-dom";
import AnimatedNavLink from "@/components/AnimatedNavLink";
import AnimatedOutlet from "@/components/AnimatedOutlet";
import {
  LayoutDashboard,
  AlertTriangle,
  Users,
  GraduationCap,
  LogOut,
  Menu,
  Shield,
  Store,
  FileText,
  UserCircle,
  Inbox,
  Building2,
  Home,
  Calculator,
  CreditCard,
  MessageSquare,
  MessageCircle,
  RefreshCw,
  Bell,
  ShieldAlert,
  UserPlus,
  Siren,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import FloatingActionHub from "@/components/FloatingActionHub";
import SafetyPanicButton from "@/components/SafetyPanicButton";
import { useAllFeatureFlags } from "@/hooks/useFeatureFlag";

const adminNav = [
  { to: "/nugs/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/nugs/students", label: "Students", icon: GraduationCap },
  { to: "/nugs/complaints", label: "Student Complaints", icon: AlertTriangle },
  { to: "/nugs/institutions", label: "Institutions", icon: Users },
  { to: "/nugs/rent-cards", label: "Rent Cards", icon: CreditCard, featureKey: "nugs_admin_rent_cards" },
];

// Per-feature student keys map nav items to feature_flags entries
const studentNav = [
  { to: "/nugs/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { to: "/nugs/marketplace", label: "Hostel Listings", icon: Store, featureKey: "student_marketplace" },
  { to: "/nugs/rent-checker", label: "Rent Checker", icon: Calculator, featureKey: "student_rent_checker" },
  { to: "/nugs/file-complaint", label: "File a Complaint", icon: AlertTriangle },
  { to: "/nugs/my-complaints", label: "My Complaints", icon: Inbox },
  { to: "/nugs/payments", label: "Payments", icon: CreditCard, featureKey: "student_payments" },
  { to: "/nugs/receipts", label: "Receipts", icon: FileText, featureKey: "student_receipts" },
  { to: "/nugs/my-agreements", label: "Agreements", icon: FileText, featureKey: "student_agreements" },
  { to: "/nugs/legal-assistant", label: "Legal Assistant", icon: MessageSquare, featureKey: "student_legal_assistant" },
  { to: "/nugs/renewal", label: "Renewal", icon: RefreshCw, featureKey: "student_renewal" },
  { to: "/nugs/termination", label: "Termination", icon: AlertTriangle, featureKey: "student_termination" },
  { to: "/nugs/report-side-payment", label: "Report Side Payment", icon: ShieldAlert, featureKey: "student_report_side_payment" },
  { to: "/nugs/preferences", label: "Preferences", icon: Bell, featureKey: "student_preferences" },
  { to: "/nugs/messages", label: "Messages", icon: MessageCircle, featureKey: "student_messages" },
  { to: "/nugs/invite-landlord", label: "Invite Landlord", icon: UserPlus, featureKey: "student_invite_landlord" },
  { to: "/nugs/report-safety", label: "Report Safety Issue", icon: Siren },
  { to: "/nugs/my-safety-reports", label: "My Safety Reports", icon: ShieldAlert },
  { to: "/nugs/report-missing-payment", label: "Payment Help", icon: ShieldAlert },
  { to: "/nugs/profile", label: "My Profile", icon: UserCircle },
];

const NugsLayout = () => {
  const navigate = useNavigate();
  const { signOut, role, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [studentCtx, setStudentCtx] = useState<{ school: string | null; hostel: string | null } | null>(null);
  const { flags } = useAllFeatureFlags();

  const isAdmin = role === "nugs_admin";
  const baseNav = isAdmin ? adminNav : studentNav;
  const navItems = baseNav.filter((item: any) => {
    if (!item.featureKey) return true;
    const flag = flags.find((f) => f.feature_key === item.featureKey);
    return flag?.is_enabled === true;
  });

  useEffect(() => {
    if (isAdmin || !user) return;
    supabase
      .from("tenants")
      .select("school, hostel_or_hall")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setStudentCtx({ school: (data as any).school, hostel: (data as any).hostel_or_hall });
      });
  }, [user, isAdmin]);

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
          <span className="font-semibold text-sm">NUGS</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold ml-auto bg-sidebar-accent text-sidebar-accent-foreground">
            {isAdmin ? "ADMIN" : "STUDENT"}
          </span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <AnimatedNavLink
              key={item.to}
              to={item.to}
              layoutId="nugs-nav-pill"
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
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

      <div className="flex-1 flex flex-col min-w-0 ml-0 w-full">
        <header className="h-14 glass-header flex items-center px-3 sm:px-4 gap-2">
          <button onClick={() => setMobileOpen(true)} className="md:hidden shrink-0">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm truncate">{isAdmin ? "NUGS Monitoring" : "NUGS Student"}</span>
          {!isAdmin && studentCtx && (studentCtx.school || studentCtx.hostel) && (
            <span className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium truncate max-w-[60vw]">
              {studentCtx.school && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Building2 className="h-3 w-3 shrink-0" />
                  <span className="truncate">{studentCtx.school}</span>
                </span>
              )}
              {studentCtx.school && studentCtx.hostel && <span className="opacity-50">·</span>}
              {studentCtx.hostel && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Home className="h-3 w-3 shrink-0" />
                  <span className="truncate">{studentCtx.hostel}</span>
                </span>
              )}
            </span>
          )}
        </header>
        <main data-app-main className="flex-1 px-3 sm:px-5 py-4 md:px-7 md:py-6 lg:px-10 lg:py-8 overflow-y-auto overflow-x-hidden bg-transparent">
          <div className="mx-auto w-full max-w-[1400px]">
            <AnimatedOutlet />
          </div>
        </main>
      </div>
      <FloatingActionHub />
      {!isAdmin && <SafetyPanicButton role="student" />}
    </div>
  );
};

export default NugsLayout;

import { useNavigate } from "react-router-dom";
import AnimatedNavLink from "@/components/AnimatedNavLink";
import AnimatedOutlet from "@/components/AnimatedOutlet";
import { LayoutDashboard, AlertTriangle, Users, GraduationCap, LogOut, Menu, Shield, Store, FileText, UserCircle, Inbox } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const adminNav = [
  { to: "/nugs/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/nugs/students", label: "Students", icon: GraduationCap },
  { to: "/nugs/complaints", label: "Student Complaints", icon: AlertTriangle },
  { to: "/nugs/institutions", label: "Institutions", icon: Users },
];

const studentNav = [
  { to: "/nugs/dashboard", label: "My Dashboard", icon: LayoutDashboard },
  { to: "/nugs/marketplace", label: "Hostel Listings", icon: Store },
  { to: "/nugs/file-complaint", label: "File a Complaint", icon: AlertTriangle },
  { to: "/nugs/my-complaints", label: "My Complaints", icon: Inbox },
  { to: "/nugs/profile", label: "My Profile", icon: UserCircle },
];

const NugsLayout = () => {
  const navigate = useNavigate();
  const { signOut, role } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Tenants who land here are students; nugs_admin gets the monitoring portal
  const isAdmin = role === "nugs_admin";
  const navItems = isAdmin ? adminNav : studentNav;

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
        </header>
        <main data-app-main className="flex-1 px-3 sm:px-5 py-4 md:px-7 md:py-6 lg:px-10 lg:py-8 overflow-y-auto overflow-x-hidden bg-transparent">
          <div className="mx-auto w-full max-w-[1400px]">
            <AnimatedOutlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default NugsLayout;

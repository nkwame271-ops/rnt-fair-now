import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Calculator,
  FileText,
  Briefcase,
  CreditCard,
  MessageSquare,
  LogOut,
  Shield,
  Menu,
  UserCircle,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import TourGuide from "@/components/TourGuide";
import { tenantTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { to: "/tenant/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tenant/marketplace", label: "Marketplace", icon: Store },
  { to: "/tenant/rent-checker", label: "Rent Checker", icon: Calculator },
  { to: "/tenant/file-complaint", label: "File Complaint", icon: FileText },
  { to: "/tenant/my-cases", label: "My Cases", icon: Briefcase },
  { to: "/tenant/payments", label: "Payments", icon: CreditCard },
  { to: "/tenant/my-agreements", label: "Agreements", icon: FileText },
  { to: "/tenant/legal-assistant", label: "Legal Assistant", icon: MessageSquare },
  { to: "/tenant/profile", label: "My Profile", icon: UserCircle },
];

const TenantLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
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

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm lg:hidden">Rent Control</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
      <TourGuide steps={tenantTourSteps} storageKey="tour_tenant_completed" />
      <FloatingActionHub />
    </div>
  );
};

export default TenantLayout;

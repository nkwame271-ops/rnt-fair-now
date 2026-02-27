import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  FileCheck,
  LogOut,
  Shield,
  Menu,
  Eye,
  UserCircle,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import TourGuide from "@/components/TourGuide";
import { landlordTourSteps } from "@/data/tourSteps";
import FloatingActionHub from "@/components/FloatingActionHub";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
  { to: "/landlord/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/landlord/my-properties", label: "My Properties", icon: Building2 },
  { to: "/landlord/register-property", label: "Register Property", icon: PlusCircle },
  { to: "/landlord/add-tenant", label: "Add Tenant", icon: PlusCircle },
  { to: "/landlord/agreements", label: "Agreements", icon: FileCheck },
  { to: "/landlord/viewing-requests", label: "Viewing Requests", icon: Eye },
  { to: "/landlord/profile", label: "My Profile", icon: UserCircle },
  { to: "/landlord/feedback", label: "Beta Feedback", icon: MessageSquare },
];

const LandlordLayout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

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

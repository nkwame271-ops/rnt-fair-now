import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  FileCheck,
  LogOut,
  Shield,
  Menu,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { to: "/landlord/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/landlord/my-properties", label: "My Properties", icon: Building2 },
  { to: "/landlord/register-property", label: "Register Property", icon: PlusCircle },
  { to: "/landlord/agreements", label: "Agreements", icon: FileCheck },
];

const LandlordLayout = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            onClick={() => navigate("/")}
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
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm">Rent Control — Landlord</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default LandlordLayout;

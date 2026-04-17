import { NavLink, Outlet, useNavigate } from "react-router-dom";
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
  { to: "/tenant/marketplace", label: "Hostel Listings", icon: Store },
  { to: "/tenant/file-complaint", label: "File a Complaint", icon: AlertTriangle },
  { to: "/nugs/my-complaints", label: "My Complaints", icon: Inbox },
  { to: "/tenant/profile", label: "My Profile", icon: UserCircle },
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
    <div className="min-h-screen flex bg-background">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:relative`}
      >
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <Shield className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold text-lg">NUGS</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold ml-auto bg-primary text-primary-foreground">
            {isAdmin ? "ADMIN" : "STUDENT"}
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
        <div className="fixed inset-0 z-40 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
          <button onClick={() => setMobileOpen(true)} className="lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <span className="font-bold text-sm">{isAdmin ? "NUGS Monitoring Portal" : "NUGS Student Portal"}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default NugsLayout;

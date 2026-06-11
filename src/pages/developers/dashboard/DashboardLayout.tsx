import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useDeveloperOrg } from "@/hooks/useDeveloperOrg";
import { Button } from "@/components/ui/button";
import { Shield, LayoutDashboard, KeyRound, FlaskConical, Webhook, BarChart3, CreditCard, BookOpen, Settings, LogOut, Loader2, ClipboardCheck } from "lucide-react";

const NAV = [
  { to: "/developers/dashboard", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/developers/dashboard/keys", icon: KeyRound, label: "API Keys" },
  { to: "/developers/dashboard/request-status", icon: ClipboardCheck, label: "Access request" },
  { to: "/developers/dashboard/sandbox", icon: FlaskConical, label: "Sandbox" },
  { to: "/developers/dashboard/webhooks", icon: Webhook, label: "Webhooks" },
  { to: "/developers/dashboard/usage", icon: BarChart3, label: "Usage" },
  { to: "/developers/dashboard/billing", icon: CreditCard, label: "Billing" },
  { to: "/developers/dashboard/docs", icon: BookOpen, label: "Docs" },
  { to: "/developers/dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DeveloperDashboardLayout() {
  const { signOut, user } = useAuth();
  const { data: org, isLoading } = useDeveloperOrg();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold">Developer Portal</span>
            {org && <span className="text-sm text-muted-foreground ml-3 hidden sm:inline">· {org.name}</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut(); navigate("/developers"); }}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 grid grid-cols-12 gap-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-2">
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm ${
                    isActive ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground"
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}

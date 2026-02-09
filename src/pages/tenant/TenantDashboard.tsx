import { motion } from "framer-motion";
import {
  FileText,
  Calculator,
  Store,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { sampleComplaints, tenantPayments } from "@/data/dummyData";

const quickActions = [
  { to: "/tenant/file-complaint", label: "File Complaint", icon: FileText, color: "bg-destructive/10 text-destructive" },
  { to: "/tenant/rent-checker", label: "Check Rent", icon: Calculator, color: "bg-primary/10 text-primary" },
  { to: "/tenant/marketplace", label: "Marketplace", icon: Store, color: "bg-secondary/20 text-secondary-foreground" },
  { to: "/tenant/payments", label: "Pay Rent", icon: CreditCard, color: "bg-info/10 text-info" },
];

const TenantDashboard = () => {
  const activeCases = sampleComplaints.filter((c) => c.status !== "Resolved" && c.status !== "Closed").length;
  const nextPayment = tenantPayments.find((p) => p.status === "Pending");

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Welcome, Kwame 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your rental overview</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active Cases", value: activeCases, icon: AlertTriangle, color: "text-destructive" },
          { label: "Total Cases", value: sampleComplaints.length, icon: FileText, color: "text-primary" },
          { label: "Cases Resolved", value: sampleComplaints.filter((c) => c.status === "Resolved").length, icon: CheckCircle2, color: "text-success" },
          { label: "Next Payment", value: nextPayment ? `GH₵${nextPayment.total}` : "—", icon: Clock, color: "text-info" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="group bg-card rounded-xl p-5 shadow-card border border-border hover:shadow-elevated transition-all"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color} mb-3`}>
                <action.icon className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors">
                {action.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Rental Agreement Summary */}
      <div className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">Your Rental Agreement</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Property</div>
            <div className="font-semibold text-card-foreground">14 Palm St, East Legon</div>
          </div>
          <div>
            <div className="text-muted-foreground">Monthly Rent</div>
            <div className="font-semibold text-card-foreground">GH₵ 2,500</div>
          </div>
          <div>
            <div className="text-muted-foreground">Landlord</div>
            <div className="font-semibold text-card-foreground">Kwame Asante</div>
          </div>
          <div>
            <div className="text-muted-foreground">Agreement Status</div>
            <div className="inline-flex items-center gap-1 text-success font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" /> Registered
            </div>
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Cases</h2>
          <Link to="/tenant/my-cases" className="text-sm text-primary font-medium flex items-center gap-1 hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="space-y-3">
          {sampleComplaints.map((c) => (
            <div key={c.id} className="bg-card rounded-xl p-4 shadow-card border border-border flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm text-card-foreground">{c.type}</div>
                <div className="text-xs text-muted-foreground">{c.id} • {c.dateSubmitted}</div>
              </div>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  c.status === "Resolved"
                    ? "bg-success/10 text-success"
                    : c.status === "Under Review"
                    ? "bg-warning/10 text-warning"
                    : "bg-info/10 text-info"
                }`}
              >
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TenantDashboard;

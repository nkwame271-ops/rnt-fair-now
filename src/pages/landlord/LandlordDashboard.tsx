import { motion } from "framer-motion";
import { Building2, Users, FileCheck, AlertTriangle, PlusCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { sampleProperties } from "@/data/dummyData";

const LandlordDashboard = () => {
  const totalUnits = sampleProperties.reduce((s, p) => s + p.units.length, 0);
  const occupiedUnits = sampleProperties.reduce((s, p) => s + p.units.filter((u) => u.status === "Occupied").length, 0);
  const unregistered = sampleProperties.reduce((s, p) => s + p.units.filter((u) => !u.agreementRegistered && u.tenant).length, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-foreground">Landlord Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your properties and stay compliant</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Properties", value: sampleProperties.length, icon: Building2, color: "text-primary" },
          { label: "Total Units", value: totalUnits, icon: Building2, color: "text-info" },
          { label: "Tenants", value: occupiedUnits, icon: Users, color: "text-success" },
          { label: "Unregistered", value: unregistered, icon: AlertTriangle, color: "text-destructive" },
        ].map((stat) => (
          <div key={stat.label} className="bg-card rounded-xl p-5 shadow-card border border-border">
            <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
            <div className="text-2xl font-bold text-card-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>

      {unregistered > 0 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-foreground text-sm">Compliance Alert</div>
            <p className="text-sm text-muted-foreground">You have {unregistered} tenancy agreement(s) that are not registered. By law (Act 220, Section 4), all agreements must be registered within 14 days.</p>
            <Link to="/landlord/agreements" className="text-sm text-primary font-medium mt-2 inline-flex items-center gap-1 hover:underline">
              Register now <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Link to="/landlord/register-property" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated transition-all">
          <PlusCircle className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">Register New Property</h3>
          <p className="text-sm text-muted-foreground mt-1">Add a new property with units and pricing</p>
        </Link>
        <Link to="/landlord/my-properties" className="group bg-card rounded-xl p-6 shadow-card border border-border hover:shadow-elevated transition-all">
          <Building2 className="h-6 w-6 text-primary mb-3" />
          <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">View Properties</h3>
          <p className="text-sm text-muted-foreground mt-1">Manage existing properties and tenants</p>
        </Link>
      </div>

      {/* Properties List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Your Properties</h2>
        <div className="space-y-4">
          {sampleProperties.map((p) => (
            <div key={p.id} className="bg-card rounded-xl p-5 shadow-card border border-border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-card-foreground">{p.name}</h3>
                  <div className="text-xs text-muted-foreground">{p.code} • {p.address}</div>
                </div>
                <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-semibold">
                  {p.units.length} units
                </span>
              </div>
              <div className="grid gap-2">
                {p.units.map((u) => (
                  <div key={u.id} className="flex items-center justify-between bg-muted rounded-lg px-4 py-2.5 text-sm">
                    <div>
                      <span className="font-medium text-card-foreground">{u.name}</span>
                      <span className="text-muted-foreground"> — {u.type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-card-foreground font-semibold">GH₵ {u.rent}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        u.status === "Occupied" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      }`}>
                        {u.status}
                      </span>
                      {u.tenant && !u.agreementRegistered && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                          Unregistered
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LandlordDashboard;

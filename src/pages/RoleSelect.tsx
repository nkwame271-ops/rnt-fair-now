import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, Shield, ArrowRight } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const RoleSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 gradient-hero opacity-85" />
        <div className="relative z-10 px-4 py-16 sm:py-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-8 w-8 text-secondary" />
              <span className="text-sm font-semibold tracking-widest uppercase text-secondary">
                Ghana Rent Control
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary-foreground mb-4 leading-tight">
              Protecting Tenants.
              <br />
              Empowering Landlords.
            </h1>
            <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8">
              The official digital platform for rent regulation, tenancy agreements,
              and dispute resolution under Act 220.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Role Selection */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid sm:grid-cols-2 gap-6"
        >
          {/* Tenant Card */}
          <button
            onClick={() => navigate("/login?role=tenant")}
            className="group bg-card rounded-2xl p-8 shadow-elevated text-left transition-all hover:shadow-glow hover:-translate-y-1 border border-border"
          >
            <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center mb-5">
              <Users className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground mb-2">
              I'm a Tenant
            </h2>
            <p className="text-muted-foreground mb-6">
              Check rent prices, find a place to rent, file complaints, pay rent, and know your rights.
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>

          {/* Landlord Card */}
          <button
            onClick={() => navigate("/login?role=landlord")}
            className="group bg-card rounded-2xl p-8 shadow-elevated text-left transition-all hover:shadow-glow hover:-translate-y-1 border border-border"
          >
            <div className="w-14 h-14 rounded-xl gradient-gold flex items-center justify-center mb-5">
              <Building2 className="h-7 w-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground mb-2">
              I'm a Landlord
            </h2>
            <p className="text-muted-foreground mb-6">
              Register properties, manage tenants, register agreements, and stay compliant with the law.
            </p>
            <div className="flex items-center gap-2 text-primary font-semibold group-hover:gap-3 transition-all">
              <span>Get Started</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </button>
        </motion.div>

        {/* Features Strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center"
        >
          {[
            { label: "Properties Registered", value: "12,450+" },
            { label: "Active Tenants", value: "34,200+" },
            { label: "Complaints Resolved", value: "8,700+" },
            { label: "Regions Covered", value: "16" },
          ].map((stat) => (
            <div key={stat.label} className="p-4">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelect;

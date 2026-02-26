import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Lock } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import rcdLogo from "@/assets/rcd-logo.png";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";

const RoleSelect = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${heroBg})` }} />
        <div className="absolute inset-0 gradient-hero opacity-85" />
        <div className="relative z-10 px-4 py-16 sm:py-24 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="flex items-center justify-center gap-4 mb-4">
              <div>
                <img src={rcdLogo} alt="RCD Logo" className="h-20 w-20 object-contain drop-shadow-lg" />
              </div>
              <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-20 w-20 object-contain drop-shadow-lg" />
            </div>
            <span className="inline-block text-sm font-semibold tracking-widest uppercase text-secondary mb-2">Republic of Ghana · Rent Control Department</span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-primary-foreground mb-4 leading-tight">
              Protecting Tenants.<br />Empowering Landlords.
            </h1>
            <p className="text-lg sm:text-xl text-primary-foreground/80 max-w-2xl mx-auto mb-8">
              The official digital platform for rent regulation, tenancy agreements, and dispute resolution under Act 220.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Role Selection */}
      <div className="max-w-4xl mx-auto px-4 -mt-8 relative z-20 pb-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }} className="grid sm:grid-cols-2 gap-6">
          {/* Tenant Card */}
          <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border space-y-5">
            <div className="w-14 h-14 rounded-xl gradient-hero flex items-center justify-center">
              <Users className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground">I'm a Tenant</h2>
            <p className="text-muted-foreground">Check rent prices, find a place to rent, file complaints, pay rent, and know your rights.</p>
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 inline-block">
              Registration: <span className="font-semibold text-foreground">GH₵ 50/year</span> · Get your Tenant ID
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate("/register/tenant")}
                className="flex-1 group bg-primary text-primary-foreground rounded-lg py-3 px-4 font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                Register <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/login?role=tenant")}
                className="flex-1 group border border-border rounded-lg py-3 px-4 font-semibold text-sm hover:bg-muted transition-all text-foreground">
                Sign In
              </button>
            </div>
          </div>

          {/* Landlord Card */}
          <div className="bg-card rounded-2xl p-8 shadow-elevated border border-border space-y-5">
            <div className="w-14 h-14 rounded-xl gradient-gold flex items-center justify-center">
              <Building2 className="h-7 w-7 text-accent-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground">I'm a Landlord</h2>
            <p className="text-muted-foreground">Register properties, manage tenants, register agreements, and stay compliant with the law.</p>
            <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 inline-block">
              Registration: <span className="font-semibold text-foreground">GH₵ 50/year</span> · Get your Landlord ID
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigate("/register/landlord")}
                className="flex-1 group bg-primary text-primary-foreground rounded-lg py-3 px-4 font-semibold text-sm hover:opacity-90 transition-all flex items-center justify-center gap-2">
                Register <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/login?role=landlord")}
                className="flex-1 group border border-border rounded-lg py-3 px-4 font-semibold text-sm hover:bg-muted transition-all text-foreground">
                Sign In
              </button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: "Properties Registered", value: "150+" },
            { label: "Active Tenants", value: "320+" },
            { label: "Complaints Resolved", value: "45+" },
            { label: "Digital & Secure", value: "100%" },
          ].map((stat) => (
            <div key={stat.label} className="p-4">
              <div className="text-2xl font-bold text-primary">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Regulator link */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 text-center">
          <button onClick={() => navigate("/regulator/login")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Lock className="h-3.5 w-3.5" />
            Rent Control Office Staff Login
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default RoleSelect;

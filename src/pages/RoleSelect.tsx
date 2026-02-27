import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Building2, Users, ArrowRight, Lock, Shield, Scale, Phone, Mail, MapPin } from "lucide-react";
import LiveChatWidget from "@/components/LiveChatWidget";
import heroBg from "@/assets/hero-bg.jpg";
import rcdLogo from "@/assets/rcd-logo.png";
import coatOfArms from "@/assets/ghana-coat-of-arms.png";
import cfledLogo from "@/assets/cfled-logo.png";

const RoleSelect = () => {
  const navigate = useNavigate();

  const roles = [
    {
      title: "Tenant",
      description: "Find housing, file complaints, manage agreements, and know your rights under Act 220.",
      icon: Users,
      path: "/login?role=tenant",
      color: "from-emerald-500 to-teal-600",
    },
    {
      title: "Landlord",
      description: "Register properties, manage tenancies, handle agreements, and stay compliant.",
      icon: Building2,
      path: "/login?role=landlord",
      color: "from-amber-500 to-orange-600",
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${heroBg})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-background" />

          <div className="relative z-10 max-w-6xl mx-auto px-4 pt-8 pb-24 sm:pt-12 sm:pb-32">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-16">
              <div className="flex items-center gap-3">
                <img src={coatOfArms} alt="Ghana Coat of Arms" className="h-12 w-auto" />
                <div>
                  <h2 className="text-white font-bold text-sm sm:text-base leading-tight">
                    Republic of Ghana
                  </h2>
                  <p className="text-white/70 text-xs">Ministry of Works & Housing</p>
                </div>
              </div>
              <img src={rcdLogo} alt="RCD Logo" className="h-10 w-auto rounded-lg" />
            </div>

            {/* Hero content */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center max-w-3xl mx-auto"
            >
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-4">
                Rent Control
                <span className="block text-amber-400">Department</span>
              </h1>
              <p className="text-white/80 text-base sm:text-lg max-w-xl mx-auto">
                Digital platform for fair, transparent, and regulated rental housing in Ghana — powered by Act 220.
              </p>
            </motion.div>
          </div>
        </div>

        {/* About Us Section */}
        <section className="max-w-6xl mx-auto px-4 py-16 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-12"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">About Us</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-sm sm:text-base">
              The Rent Control Department was established under the Rent Act, 1963 (Act 220) to regulate 
              rents, prevent unlawful ejection, and ensure fair housing practices across Ghana.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Tenant Protection",
                text: "We enforce maximum advance rent of 6 months, proper eviction procedures, and habitable living conditions as mandated by law.",
              },
              {
                icon: Scale,
                title: "Fair Regulation",
                text: "We mediate disputes between landlords and tenants, assess fair rent values, and ensure compliance with housing standards.",
              },
              {
                icon: Building2,
                title: "Property Registration",
                text: "All rental properties and tenancy agreements must be registered with the department to ensure legal protection for all parties.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="bg-card border border-border rounded-xl p-6 text-center"
              >
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-muted-foreground text-sm">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Role Selection */}
        <section className="max-w-6xl mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Get Started</h2>
            <p className="text-muted-foreground text-sm">Select your role to continue</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {roles.map((role, i) => (
              <motion.button
                key={role.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                whileHover={{ y: -4 }}
                onClick={() => navigate(role.path)}
                className="group bg-card border border-border rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
              >
                <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${role.color} flex items-center justify-center mb-4`}>
                  <role.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{role.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{role.description}</p>
                <span className="text-primary text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
                  Continue <ArrowRight className="h-4 w-4" />
                </span>
              </motion.button>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card/50 mt-8">
          <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <img src={coatOfArms} alt="" className="h-8 w-auto" />
                  <span className="font-bold text-foreground text-sm">Rent Control Department</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Ministry of Works & Housing, Republic of Ghana. Regulating rental housing since 1963.
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Contact</h4>
                <div className="space-y-2 text-muted-foreground text-xs">
                  <div className="flex items-center gap-2"><Phone className="h-3 w-3" /> +233 (0) 302 123 456</div>
                  <div className="flex items-center gap-2"><Mail className="h-3 w-3" /> info@rentcontrol.gov.gh</div>
                  <div className="flex items-center gap-2"><MapPin className="h-3 w-3" /> Accra, Greater Accra Region</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-sm mb-3">Legal</h4>
                <div className="space-y-2 text-muted-foreground text-xs">
                  <p>Rent Act, 1963 (Act 220)</p>
                  <p>Rent (Amendment) Decree, 1973</p>
                </div>
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-muted-foreground/50 text-[11px]">© {new Date().getFullYear()} Rent Control Department</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground/50 text-[10px]">Powered by</span>
                <img src={cfledLogo} alt="CFLED" className="h-7 w-auto opacity-60" />
              </div>
              <button
                onClick={() => navigate("/regulator/login")}
                className="text-muted-foreground/40 hover:text-muted-foreground text-[11px] transition-colors"
              >
                Staff Portal
              </button>
            </div>
          </div>
        </footer>
      </div>
      <LiveChatWidget />
    </>
  );
};

export default RoleSelect;
